import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ClosureStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { PricingCalculatorService } from '@domain/pricing-calculator.service';
import { StateMachineService } from '@domain/state-machine.service';
import { ReconciliationService } from '@domain/reconciliation.service';
import { IncidentGeneratorService } from '@domain/incident-generator.service';
import { PdfService } from '@modules/pdf/pdf.service';
import { paginate } from '@common/dto/paginated-response.dto';
import { CreateClosureDto } from './dto/create-closure.dto';
import { UpdateClosureDto } from './dto/update-closure.dto';
import { FilterClosureDto } from './dto/filter-closure.dto';
import { CreateClosureLineDto, UpdateClosureLineDto } from './dto/closure-line.dto';
import { CancelClosureDto } from './dto/cancel-closure.dto';

// ── Includes reutilizables ─────────────────────────────────────────────────────

const LIST_INCLUDE = {
  client: {
    select: { id: true, commercialName: true, taxId: true, type: true },
  },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { lines: true, collections: true, incidents: true } },
} satisfies Prisma.DealClosureInclude;

const DETAIL_INCLUDE = {
  client: {
    include: { category: { select: { id: true, name: true, slug: true } } },
  },
  createdBy: { select: { id: true, name: true } },
  confirmedBy: { select: { id: true, name: true } },
  cancelledBy: { select: { id: true, name: true } },
  lines: {
    include: {
      metalType: { select: { id: true, name: true, code: true } },
      karat: { select: { id: true, label: true, purity: true } },
    },
    orderBy: { sortOrder: 'asc' as const },
  },
  advance: {
    include: { authorizedBy: { select: { id: true, name: true } } },
  },
  deliveryNote: { select: { id: true, code: true, status: true, filePath: true } },
  collections: {
    include: {
      collector: { select: { id: true, name: true } },
      lines: {
        include: {
          metalType: { select: { id: true, name: true, code: true } },
          karat: { select: { id: true, label: true, purity: true } },
        },
        orderBy: { createdAt: 'asc' as const },
      },
    },
    orderBy: { collectedAt: 'desc' as const },
  },
  incidents: {
    where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
    select: { id: true, type: true, status: true, reason: true, createdAt: true },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.DealClosureInclude;

@Injectable()
export class ClosuresService {
  private readonly logger = new Logger(ClosuresService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingCalculator: PricingCalculatorService,
    private readonly stateMachine: StateMachineService,
    private readonly reconciliation: ReconciliationService,
    private readonly incidentGenerator: IncidentGeneratorService,
    private readonly pdfService: PdfService,
  ) {}

  // ── CRUD básico ────────────────────────────────────────────────────────────

  async findAll(filters: FilterClosureDto) {
    const {
      page, limit, status, clientId, createdById,
      dateFrom, dateTo, sortBy = 'createdAt', sortOrder = 'desc',
    } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.DealClosureWhereInput = {
      deletedAt: null,
      ...(status && { status }),
      ...(clientId && { clientId }),
      ...(createdById && { createdById }),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.dealClosure.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.dealClosure.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const closure = await this.prisma.dealClosure.findFirst({
      where: { id, deletedAt: null },
      include: DETAIL_INCLUDE,
    });
    if (!closure) throw new NotFoundException(`Cierre con id "${id}" no encontrado`);
    return closure;
  }

  async create(dto: CreateClosureDto, userId: string) {
    // Verificar que el cliente existe y está activo
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, deletedAt: null, isActive: true },
    });
    if (!client) throw new NotFoundException(`Cliente con id "${dto.clientId}" no encontrado o inactivo`);

    const year = new Date().getFullYear();
    const yy = String(year).slice(-2);

    // Generar código secuencial dentro de una transacción serializable
    const closure = await this.prisma.$transaction(
      async (tx) => {
        const agg = await tx.dealClosure.aggregate({
          where: { year },
          _max: { sequenceNumber: true },
        });
        const seq = (agg._max.sequenceNumber ?? 0) + 1;
        const code = `CIE${yy}-${seq}`;

        return tx.dealClosure.create({
          data: {
            code,
            sequenceNumber: seq,
            year,
            clientId: dto.clientId,
            observations: dto.observations,
            totalAmount: new Decimal(0),
            finalAmount: new Decimal(0),
            createdById: userId,
          },
          include: DETAIL_INCLUDE,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.logger.log(`Cierre ${closure.code} creado por userId=${userId}`);
    return closure;
  }

  async update(id: string, dto: UpdateClosureDto) {
    await this.assertDraft(id);
    return this.prisma.dealClosure.update({
      where: { id },
      data: { observations: dto.observations },
      include: DETAIL_INCLUDE,
    });
  }

  // ── Acciones de estado ─────────────────────────────────────────────────────

  async confirm(closureId: string, userId: string) {
    const closure = await this.findOne(closureId);

    // Precondiciones
    if (closure.status !== ClosureStatus.DRAFT) {
      throw new BadRequestException('Solo se pueden confirmar cierres en estado Borrador');
    }
    if (closure.lines.length === 0) {
      throw new BadRequestException('El cierre debe tener al menos una línea de material pactado');
    }
    if (!closure.client.isActive) {
      throw new BadRequestException('El cliente asociado está inactivo');
    }

    const categoryId = closure.client.categoryId;

    // Obtener precios actuales para cada línea (lectura previa a la transacción)
    const lineUpdates = await Promise.all(
      closure.lines.map(async (line) => {
        const pricePerGram = await this.pricingCalculator.getCurrentPrice(
          line.metalTypeId,
          line.karatId,
          categoryId,
        );
        const lineAmount = this.pricingCalculator.calculateLineAmount(
          line.grams,
          pricePerGram,
        );
        return {
          lineId: line.id,
          pricePerGram,
          lineAmount,
          puritySnapshot: line.karat.purity,
        };
      }),
    );

    const totalAmount = this.pricingCalculator.calculateTotalAmount(
      lineUpdates.map((u) => ({ lineAmount: u.lineAmount })),
    );
    const now = new Date();

    // Congelar precios + confirmar en una única transacción atómica
    await this.prisma.$transaction([
      ...lineUpdates.map((u) =>
        this.prisma.dealClosureLine.update({
          where: { id: u.lineId },
          data: {
            pricePerGram: u.pricePerGram,
            lineAmount: u.lineAmount,
            puritySnapshot: u.puritySnapshot,
          },
        }),
      ),
      this.prisma.dealClosure.update({
        where: { id: closureId },
        data: {
          totalAmount,
          finalAmount: totalAmount, // sin adelanto aún
          status: ClosureStatus.CONFIRMED,
          confirmedById: userId,
          confirmedAt: now,
          version: { increment: 1 },
        },
      }),
    ]);

    this.logger.log(`Cierre ${closure.code} confirmado. Precios congelados. Total: ${totalAmount.toFixed(2)} €`);

    // Generar albarán fuera de la transacción (puede regenerarse si falla)
    try {
      await this.pdfService.generateDeliveryNote(closureId, userId);
    } catch (err) {
      this.logger.warn(`Error generando albarán para ${closure.code} — puede regenerarse: ${String(err)}`);
    }

    return this.findOne(closureId);
  }

  async cancel(closureId: string, userId: string, dto: CancelClosureDto) {
    const closure = await this.findOne(closureId);
    const hasActiveAdvance = closure.advance !== null && closure.advance.cancelledAt === null;

    // La máquina de estados valida que el estado actual admite cancelación
    await this.stateMachine.transition(closureId, ClosureStatus.CANCELLED, userId, {
      cancellationReason: dto.reason,
    });

    // Si hay adelanto activo, generar incidencia de devolución
    if (hasActiveAdvance) {
      await this.incidentGenerator.createAdvanceRefundIncident(closureId, userId);
      this.logger.warn(`Cierre ${closure.code} cancelado con adelanto activo — incidencia ADVANCE_REFUND generada`);
    }

    return this.findOne(closureId);
  }

  async complete(closureId: string, userId: string) {
    const canComplete = await this.reconciliation.canComplete(closureId);
    if (!canComplete) {
      // Obtener resumen para un mensaje más detallado
      const summary = await this.reconciliation.getReconciliationSummary(closureId);
      const reasons: string[] = [];
      if (!summary.isFullyCollected) reasons.push('no se ha completado la recogida de todo el material');
      if (!summary.isFullyValidated) reasons.push('queda material sin validar');
      if (summary.openIncidents.length > 0)
        reasons.push(`hay ${summary.openIncidents.length} incidencia(s) sin resolver`);
      throw new BadRequestException(
        `No se puede completar el cierre: ${reasons.join('; ')}`,
      );
    }

    await this.stateMachine.transition(closureId, ClosureStatus.COMPLETED, userId);
    return this.findOne(closureId);
  }

  async getSummary(closureId: string) {
    await this.findOne(closureId); // Verifica que existe
    return this.reconciliation.getReconciliationSummary(closureId);
  }

  // ── Gestión de líneas (solo en DRAFT) ─────────────────────────────────────

  async addLine(closureId: string, dto: CreateClosureLineDto) {
    const closure = await this.assertDraft(closureId);

    // Verificar que el metal y quilataje existen y son del mismo tipo
    const [metal, karat] = await Promise.all([
      this.prisma.metalType.findUnique({ where: { id: dto.metalTypeId } }),
      this.prisma.karatCatalog.findUnique({ where: { id: dto.karatId } }),
    ]);
    if (!metal || !metal.isActive)
      throw new NotFoundException(`Metal con id "${dto.metalTypeId}" no encontrado o inactivo`);
    if (!karat || !karat.isActive)
      throw new NotFoundException(`Quilataje con id "${dto.karatId}" no encontrado o inactivo`);
    if (karat.metalTypeId !== dto.metalTypeId)
      throw new BadRequestException(`El quilataje "${karat.label}" no pertenece al metal "${metal.name}"`);

    const grams = new Decimal(dto.grams);
    if (grams.lte(0)) throw new BadRequestException('Los gramos deben ser mayor que 0');

    // Precio estimado actual (se congelará en confirmación)
    let pricePerGram = new Decimal(0);
    try {
      pricePerGram = await this.pricingCalculator.getCurrentPrice(
        dto.metalTypeId,
        dto.karatId,
        closure.client.categoryId,
      );
    } catch {
      this.logger.warn(`Sin tarifa activa para ${metal.code}/${karat.label} — pricePerGram=0 en borrador`);
    }

    const lineAmount = this.pricingCalculator.calculateLineAmount(grams, pricePerGram);

    const maxOrder = await this.prisma.dealClosureLine.aggregate({
      where: { closureId },
      _max: { sortOrder: true },
    });

    const line = await this.prisma.dealClosureLine.create({
      data: {
        closureId,
        metalTypeId: dto.metalTypeId,
        karatId: dto.karatId,
        grams,
        pricePerGram,
        lineAmount,
        puritySnapshot: karat.purity,
        sortOrder: dto.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
      },
      include: {
        metalType: { select: { id: true, name: true, code: true } },
        karat: { select: { id: true, label: true, purity: true } },
      },
    });

    await this.recalculateDraftTotal(closureId);
    return line;
  }

  async updateLine(closureId: string, lineId: string, dto: UpdateClosureLineDto) {
    const closure = await this.assertDraft(closureId);
    const line = await this.findLine(closureId, lineId);

    const updMetalId = dto.metalTypeId ?? line.metalTypeId;
    const updKaratId = dto.karatId ?? line.karatId;

    if (dto.metalTypeId || dto.karatId) {
      const karat = await this.prisma.karatCatalog.findUniqueOrThrow({ where: { id: updKaratId } });
      if (karat.metalTypeId !== updMetalId)
        throw new BadRequestException('El quilataje no pertenece al metal indicado');
    }

    const grams = dto.grams ? new Decimal(dto.grams) : line.grams;
    if (grams.lte(0)) throw new BadRequestException('Los gramos deben ser mayor que 0');

    let pricePerGram = line.pricePerGram;
    let puritySnapshot = line.puritySnapshot;

    if (dto.metalTypeId || dto.karatId) {
      const karat = await this.prisma.karatCatalog.findUniqueOrThrow({ where: { id: updKaratId } });
      puritySnapshot = karat.purity;
      try {
        pricePerGram = await this.pricingCalculator.getCurrentPrice(
          updMetalId,
          updKaratId,
          closure.client.categoryId,
        );
      } catch {
        pricePerGram = new Decimal(0);
      }
    }

    const lineAmount = this.pricingCalculator.calculateLineAmount(grams, pricePerGram);

    const updated = await this.prisma.dealClosureLine.update({
      where: { id: lineId },
      data: {
        ...(dto.metalTypeId && { metalTypeId: dto.metalTypeId }),
        ...(dto.karatId && { karatId: dto.karatId }),
        grams,
        pricePerGram,
        lineAmount,
        puritySnapshot,
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
      include: {
        metalType: { select: { id: true, name: true, code: true } },
        karat: { select: { id: true, label: true, purity: true } },
      },
    });

    await this.recalculateDraftTotal(closureId);
    return updated;
  }

  async removeLine(closureId: string, lineId: string) {
    await this.assertDraft(closureId);
    await this.findLine(closureId, lineId);

    await this.prisma.dealClosureLine.delete({ where: { id: lineId } });
    await this.recalculateDraftTotal(closureId);
    return { message: 'Línea eliminada correctamente' };
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  private async assertDraft(closureId: string) {
    const closure = await this.findOne(closureId);
    if (closure.status !== ClosureStatus.DRAFT) {
      throw new ConflictException(
        `Solo se pueden modificar cierres en estado Borrador (estado actual: ${closure.status})`,
      );
    }
    return closure;
  }

  private async findLine(closureId: string, lineId: string) {
    const line = await this.prisma.dealClosureLine.findFirst({
      where: { id: lineId, closureId },
    });
    if (!line)
      throw new NotFoundException(`Línea "${lineId}" no encontrada en el cierre "${closureId}"`);
    return line;
  }

  private async recalculateDraftTotal(closureId: string) {
    const lines = await this.prisma.dealClosureLine.findMany({
      where: { closureId },
      select: { lineAmount: true },
    });
    const totalAmount = this.pricingCalculator.calculateTotalAmount(lines);
    await this.prisma.dealClosure.update({
      where: { id: closureId },
      data: { totalAmount, finalAmount: totalAmount },
    });
  }
}
