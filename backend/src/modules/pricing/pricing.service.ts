import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { paginate } from '@common/dto/paginated-response.dto';
import { CreateRateDto } from './dto/create-rate.dto';
import { FilterRatesDto, CurrentRateQueryDto } from './dto/filter-rates.dto';

const RATE_INCLUDE = {
  metalType: { select: { id: true, name: true, code: true } },
  karat: { select: { id: true, label: true, purity: true } },
  category: { select: { id: true, name: true, slug: true, priceMultiplier: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.PriceRateInclude;

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Consultas ──────────────────────────────────────────────────────────────

  /**
   * Lista tarifas con filtros y paginación (incluye históricas).
   */
  async findAll(filters: FilterRatesDto) {
    const { page, limit, metalTypeId, karatId, categoryId, isActive } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.PriceRateWhereInput = {
      ...(metalTypeId && { metalTypeId }),
      ...(karatId && { karatId }),
      ...(categoryId && { categoryId }),
      ...(isActive !== undefined && { isActive }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.priceRate.findMany({
        where,
        include: RATE_INCLUDE,
        orderBy: { validFrom: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.priceRate.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  /**
   * Devuelve la tarifa vigente para una combinación metal+quilataje+categoría.
   * Si no se especifican filtros, devuelve todas las tarifas activas vigentes.
   */
  async findCurrent(query: CurrentRateQueryDto) {
    const now = new Date();

    const where: Prisma.PriceRateWhereInput = {
      isActive: true,
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      ...(query.metalTypeId && { metalTypeId: query.metalTypeId }),
      ...(query.karatId && { karatId: query.karatId }),
      ...(query.categoryId && { categoryId: query.categoryId }),
    };

    const rates = await this.prisma.priceRate.findMany({
      where,
      include: RATE_INCLUDE,
      orderBy: [
        { metalType: { sortOrder: 'asc' } },
        { karat: { sortOrder: 'asc' } },
        { category: { sortOrder: 'asc' } },
      ],
    });

    return rates;
  }

  async findOne(id: string) {
    const rate = await this.prisma.priceRate.findUnique({
      where: { id },
      include: RATE_INCLUDE,
    });
    if (!rate) throw new NotFoundException(`Tarifa con id "${id}" no encontrada`);
    return rate;
  }

  /**
   * Historial de tarifas para una combinación concreta (incluyendo inactivas),
   * ordenado de más reciente a más antigua.
   */
  async findHistory(metalTypeId: string, karatId: string, categoryId: string) {
    return this.prisma.priceRate.findMany({
      where: { metalTypeId, karatId, categoryId },
      include: RATE_INCLUDE,
      orderBy: { validFrom: 'desc' },
    });
  }

  // ── Escritura ──────────────────────────────────────────────────────────────

  /**
   * Crea una nueva tarifa manual.
   * Invalida la tarifa activa anterior para la misma combinación (setea validUntil=ahora).
   */
  async create(dto: CreateRateDto, createdById: string) {
    await this.assertMetalKaratCategoryExist(dto.metalTypeId, dto.karatId, dto.categoryId);

    const pricePerGram = new Decimal(dto.pricePerGram);
    if (pricePerGram.lte(0)) {
      throw new BadRequestException('El precio por gramo debe ser mayor que 0');
    }

    const validFrom = dto.validFrom ? new Date(dto.validFrom) : new Date();
    const validUntil = dto.validUntil ? new Date(dto.validUntil) : null;

    if (validUntil && validUntil <= validFrom) {
      throw new BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio');
    }

    const now = new Date();

    const newRate = await this.prisma.$transaction(async (tx) => {
      // Invalidar tarifas activas anteriores para la misma combinación
      await tx.priceRate.updateMany({
        where: {
          metalTypeId: dto.metalTypeId,
          karatId: dto.karatId,
          categoryId: dto.categoryId,
          isActive: true,
        },
        data: {
          isActive: false,
          validUntil: now,
        },
      });

      return tx.priceRate.create({
        data: {
          metalTypeId: dto.metalTypeId,
          karatId: dto.karatId,
          categoryId: dto.categoryId,
          pricePerGram,
          validFrom,
          validUntil,
          isActive: true,
          createdById,
        },
        include: RATE_INCLUDE,
      });
    });

    this.logger.log(
      `Tarifa manual creada: ${newRate.metalType.code}/${newRate.karat.label}/${newRate.category.slug} = ${pricePerGram.toFixed(2)} €/g`,
    );

    return newRate;
  }

  // ── Generación automática (usada por el cron) ──────────────────────────────

  /**
   * Genera nuevas tarifas para TODAS las combinaciones activas metal+quilataje+categoría,
   * aplicando una variación aleatoria de ±maxVariationPct% sobre el precio anterior.
   * Invalida las tarifas activas anteriores.
   * Devuelve el número de tarifas generadas.
   */
  async generateMarketRates(maxVariationPct = 0.5): Promise<number> {
    const now = new Date();

    // Obtener todas las combinaciones activas con su tarifa actual
    const currentRates = await this.prisma.priceRate.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      },
      select: {
        id: true,
        metalTypeId: true,
        karatId: true,
        categoryId: true,
        pricePerGram: true,
      },
    });

    if (currentRates.length === 0) {
      this.logger.warn('No hay tarifas activas para actualizar');
      return 0;
    }

    const factor = maxVariationPct / 100;

    await this.prisma.$transaction(async (tx) => {
      // 1. Marcar todas las activas como inactivas (validUntil = ahora)
      await tx.priceRate.updateMany({
        where: { id: { in: currentRates.map((r) => r.id) } },
        data: { isActive: false, validUntil: now },
      });

      // 2. Crear nuevas tarifas con precio variado
      await tx.priceRate.createMany({
        data: currentRates.map((rate) => {
          const variation = 1 + (Math.random() * 2 - 1) * factor;
          const newPrice = rate.pricePerGram
            .mul(new Decimal(variation.toFixed(6)))
            .toDecimalPlaces(2);

          return {
            metalTypeId: rate.metalTypeId,
            karatId: rate.karatId,
            categoryId: rate.categoryId,
            pricePerGram: newPrice.lte(0) ? new Decimal('0.01') : newPrice,
            validFrom: now,
            validUntil: null,
            isActive: true,
            createdById: null,
          };
        }),
      });
    });

    return currentRates.length;
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  private async assertMetalKaratCategoryExist(
    metalTypeId: string,
    karatId: string,
    categoryId: string,
  ) {
    const [metal, karat, category] = await Promise.all([
      this.prisma.metalType.findUnique({ where: { id: metalTypeId } }),
      this.prisma.karatCatalog.findUnique({ where: { id: karatId } }),
      this.prisma.clientCategory.findUnique({ where: { id: categoryId } }),
    ]);

    if (!metal || !metal.isActive)
      throw new NotFoundException(`Metal con id "${metalTypeId}" no encontrado o inactivo`);
    if (!karat || !karat.isActive)
      throw new NotFoundException(`Quilataje con id "${karatId}" no encontrado o inactivo`);
    if (karat.metalTypeId !== metalTypeId)
      throw new BadRequestException(`El quilataje "${karat.label}" no pertenece al metal "${metal.name}"`);
    if (!category || !category.isActive)
      throw new NotFoundException(`Categoría con id "${categoryId}" no encontrada o inactiva`);
  }
}
