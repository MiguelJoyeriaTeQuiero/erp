import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import {
  CreateMetalTypeDto,
  UpdateMetalTypeDto,
  CreateKaratDto,
  UpdateKaratDto,
  CreateClientCategoryDto,
  UpdateClientCategoryDto,
} from './dto';

// ─── Metales ──────────────────────────────────────────────────────────────────

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ── MetalType ──────────────────────────────────────────────────────────────

  async findAllMetals() {
    return this.prisma.metalType.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { karats: true } } },
    });
  }

  async findOneMetal(id: string) {
    const metal = await this.prisma.metalType.findUnique({
      where: { id },
      include: { karats: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!metal) throw new NotFoundException(`Metal con id "${id}" no encontrado`);
    return metal;
  }

  async createMetal(dto: CreateMetalTypeDto) {
    const exists = await this.prisma.metalType.findUnique({ where: { code: dto.code } });
    if (exists) throw new ConflictException(`Ya existe un metal con el código "${dto.code}"`);

    const maxOrder = await this.prisma.metalType.aggregate({ _max: { sortOrder: true } });
    return this.prisma.metalType.create({
      data: {
        name: dto.name,
        code: dto.code,
        sortOrder: dto.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });
  }

  async updateMetal(id: string, dto: UpdateMetalTypeDto) {
    await this.findOneMetal(id);
    if (dto.code) {
      const exists = await this.prisma.metalType.findFirst({
        where: { code: dto.code, id: { not: id } },
      });
      if (exists) throw new ConflictException(`Ya existe un metal con el código "${dto.code}"`);
    }
    return this.prisma.metalType.update({ where: { id }, data: dto });
  }

  async removeMetal(id: string) {
    await this.findOneMetal(id);
    return this.prisma.metalType.update({ where: { id }, data: { isActive: false } });
  }

  // ── KaratCatalog ───────────────────────────────────────────────────────────

  async findAllKarats(metalTypeId?: string) {
    return this.prisma.karatCatalog.findMany({
      where: { ...(metalTypeId ? { metalTypeId } : {}), isActive: true },
      orderBy: [{ metalType: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      include: { metalType: { select: { id: true, name: true, code: true } } },
    });
  }

  async findCommonKarats() {
    return this.prisma.karatCatalog.findMany({
      where: { isCommon: true, isActive: true },
      orderBy: [{ metalType: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      include: { metalType: { select: { id: true, name: true, code: true } } },
    });
  }

  async findOneKarat(id: string) {
    const karat = await this.prisma.karatCatalog.findUnique({
      where: { id },
      include: { metalType: true },
    });
    if (!karat) throw new NotFoundException(`Quilataje con id "${id}" no encontrado`);
    return karat;
  }

  async createKarat(dto: CreateKaratDto) {
    // Verificar que el metal existe
    const metal = await this.prisma.metalType.findUnique({ where: { id: dto.metalTypeId } });
    if (!metal) throw new NotFoundException(`Metal con id "${dto.metalTypeId}" no encontrado`);

    const maxOrder = await this.prisma.karatCatalog.aggregate({
      where: { metalTypeId: dto.metalTypeId },
      _max: { sortOrder: true },
    });

    return this.prisma.karatCatalog.create({
      data: {
        metalTypeId: dto.metalTypeId,
        label: dto.label,
        purity: new Decimal(dto.purity),
        isCommon: dto.isCommon ?? false,
        sortOrder: dto.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
      },
      include: { metalType: { select: { id: true, name: true, code: true } } },
    });
  }

  async updateKarat(id: string, dto: UpdateKaratDto) {
    await this.findOneKarat(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.purity !== undefined) data['purity'] = new Decimal(dto.purity);
    return this.prisma.karatCatalog.update({
      where: { id },
      data,
      include: { metalType: { select: { id: true, name: true, code: true } } },
    });
  }

  async removeKarat(id: string) {
    await this.findOneKarat(id);
    return this.prisma.karatCatalog.update({ where: { id }, data: { isActive: false } });
  }

  // ── ClientCategory ─────────────────────────────────────────────────────────

  async findAllCategories() {
    return this.prisma.clientCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { clients: true } } },
    });
  }

  async findOneCategory(id: string) {
    const cat = await this.prisma.clientCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException(`Categoría con id "${id}" no encontrada`);
    return cat;
  }

  async createCategory(dto: CreateClientCategoryDto) {
    const byName = await this.prisma.clientCategory.findUnique({ where: { name: dto.name } });
    if (byName) throw new ConflictException(`Ya existe una categoría con el nombre "${dto.name}"`);
    const bySlug = await this.prisma.clientCategory.findUnique({ where: { slug: dto.slug } });
    if (bySlug) throw new ConflictException(`Ya existe una categoría con el slug "${dto.slug}"`);

    const maxOrder = await this.prisma.clientCategory.aggregate({ _max: { sortOrder: true } });
    return this.prisma.clientCategory.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        priceMultiplier: new Decimal(dto.priceMultiplier),
        description: dto.description,
        sortOrder: dto.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateClientCategoryDto) {
    await this.findOneCategory(id);
    if (dto.name) {
      const dup = await this.prisma.clientCategory.findFirst({
        where: { name: dto.name, id: { not: id } },
      });
      if (dup) throw new ConflictException(`Ya existe una categoría con el nombre "${dto.name}"`);
    }
    if (dto.slug) {
      const dup = await this.prisma.clientCategory.findFirst({
        where: { slug: dto.slug, id: { not: id } },
      });
      if (dup) throw new ConflictException(`Ya existe una categoría con el slug "${dto.slug}"`);
    }
    const data: Record<string, unknown> = { ...dto };
    if (dto.priceMultiplier !== undefined) data['priceMultiplier'] = new Decimal(dto.priceMultiplier);
    return this.prisma.clientCategory.update({ where: { id }, data });
  }

  async removeCategory(id: string) {
    await this.findOneCategory(id);
    // Verificar que no hay clientes activos en esta categoría
    const activeClients = await this.prisma.client.count({
      where: { categoryId: id, deletedAt: null },
    });
    if (activeClients > 0) {
      throw new ConflictException(
        `No se puede desactivar la categoría: tiene ${activeClients} cliente(s) activo(s)`,
      );
    }
    return this.prisma.clientCategory.update({ where: { id }, data: { isActive: false } });
  }
}
