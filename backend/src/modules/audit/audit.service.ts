import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { paginate } from '@common/dto/paginated-response.dto';
import { FilterAuditDto } from './dto/filter-audit.dto';

const AUDIT_INCLUDE = {
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.AuditLogInclude;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista los registros de auditoría con filtros opcionales.
   * Solo accesible por admins (aplicado en el controlador).
   */
  async findAll(filters: FilterAuditDto) {
    const { page, limit, entityType, entityId, userId, action, dateFrom, dateTo } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
      ...(userId && { userId }),
      ...(action && { action }),
      ...((dateFrom ?? dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: AUDIT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  /**
   * Devuelve el historial completo de auditoría para una entidad concreta.
   * Ordenado cronológicamente (más antiguo primero) para seguir la evolución.
   */
  async findByEntity(entityType: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      include: AUDIT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }
}
