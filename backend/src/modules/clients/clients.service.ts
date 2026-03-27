import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { paginate } from '@common/dto/paginated-response.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { FilterClientDto } from './dto/filter-client.dto';

const CLIENT_INCLUDE = {
  category: { select: { id: true, name: true, slug: true, priceMultiplier: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  _count: { select: { documents: { where: { deletedAt: null } }, closures: true } },
} satisfies Prisma.ClientInclude;

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: FilterClientDto) {
    const { page, limit, search, taxId, type, categoryId, isActive } = filters;
    const skip = (page - 1) * limit;

    // Por defecto solo clientes no eliminados (soft delete)
    const where: Prisma.ClientWhereInput = {
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(type ? { type } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(taxId ? { taxId } : {}),
      ...(search
        ? {
            OR: [
              { commercialName: { contains: search, mode: 'insensitive' } },
              { legalName: { contains: search, mode: 'insensitive' } },
              { contactPerson: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        include: CLIENT_INCLUDE,
        orderBy: { commercialName: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.client.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...CLIENT_INCLUDE,
        documents: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
            uploadedBy: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!client) throw new NotFoundException(`Cliente con id "${id}" no encontrado`);
    return client;
  }

  async create(dto: CreateClientDto, createdById: string) {
    await this.assertTaxIdUnique(dto.taxId);
    await this.assertCategoryExists(dto.categoryId);

    return this.prisma.client.create({
      data: {
        type: dto.type,
        commercialName: dto.commercialName,
        legalName: dto.legalName,
        taxId: dto.taxId,
        phone: dto.phone,
        address: dto.address,
        contactPerson: dto.contactPerson,
        categoryId: dto.categoryId,
        createdById,
      },
      include: CLIENT_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);

    if (dto.taxId) await this.assertTaxIdUnique(dto.taxId, id);
    if (dto.categoryId) await this.assertCategoryExists(dto.categoryId);

    return this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.commercialName !== undefined && { commercialName: dto.commercialName }),
        ...(dto.legalName !== undefined && { legalName: dto.legalName }),
        ...(dto.taxId !== undefined && { taxId: dto.taxId }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.contactPerson !== undefined && { contactPerson: dto.contactPerson }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: CLIENT_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Soft delete
    return this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async assertTaxIdUnique(taxId: string, excludeId?: string) {
    const existing = await this.prisma.client.findFirst({
      where: { taxId, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (existing) {
      throw new ConflictException(`Ya existe un cliente con el NIF/CIF "${taxId}"`);
    }
  }

  private async assertCategoryExists(categoryId: string) {
    const cat = await this.prisma.clientCategory.findUnique({ where: { id: categoryId } });
    if (!cat) throw new NotFoundException(`Categoría con id "${categoryId}" no encontrada`);
    if (!cat.isActive) throw new ConflictException(`La categoría "${cat.name}" está inactiva`);
  }
}
