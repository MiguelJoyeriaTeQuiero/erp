import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ClosureStatus, IncidentStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { StateMachineService } from '@domain/state-machine.service';
import { IncidentGeneratorService } from '@domain/incident-generator.service';
import { paginate } from '@common/dto/paginated-response.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { ResolveIncidentDto } from './dto/resolve-incident.dto';
import { FilterIncidentsDto } from './dto/filter-incidents.dto';

const INCIDENT_INCLUDE = {
  closure: { select: { id: true, code: true, status: true } },
  collection: { select: { id: true, collectedAt: true } },
  validationSession: { select: { id: true, status: true } },
  createdBy: { select: { id: true, name: true } },
  resolvedBy: { select: { id: true, name: true } },
} satisfies Prisma.IncidentInclude;

/** Estados finales que no admiten más cambios */
const TERMINAL_STATUSES = new Set<IncidentStatus>([
  IncidentStatus.RESOLVED,
  IncidentStatus.CANCELLED,
]);

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: StateMachineService,
    private readonly incidentGenerator: IncidentGeneratorService,
  ) {}

  // ── Consultas ──────────────────────────────────────────────────────────────

  async findAll(filters: FilterIncidentsDto) {
    const { page, limit, closureId, type, status, dateFrom, dateTo } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.IncidentWhereInput = {
      ...(closureId && { closureId }),
      ...(type && { type }),
      ...(status && { status }),
      ...((dateFrom ?? dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.incident.findMany({
        where,
        include: INCIDENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.incident.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: INCIDENT_INCLUDE,
    });
    if (!incident) throw new NotFoundException(`Incidencia con id "${id}" no encontrada`);
    return incident;
  }

  // ── Escritura ──────────────────────────────────────────────────────────────

  /**
   * Crea una incidencia manualmente.
   * Las incidencias también se crean automáticamente por los servicios de dominio.
   */
  async create(dto: CreateIncidentDto, userId: string) {
    // Verificar que el cierre existe
    const closure = await this.prisma.dealClosure.findUnique({
      where: { id: dto.closureId },
      select: { id: true },
    });
    if (!closure) throw new NotFoundException(`Cierre con id "${dto.closureId}" no encontrado`);

    // Verificar referencias opcionales
    if (dto.collectionId) {
      const collection = await this.prisma.collection.findUnique({
        where: { id: dto.collectionId },
        select: { closureId: true },
      });
      if (!collection || collection.closureId !== dto.closureId) {
        throw new BadRequestException(
          `La recogida "${dto.collectionId}" no pertenece al cierre "${dto.closureId}"`,
        );
      }
    }

    if (dto.validationSessionId) {
      const session = await this.prisma.validationSession.findUnique({
        where: { id: dto.validationSessionId },
        select: { closureId: true },
      });
      if (!session || session.closureId !== dto.closureId) {
        throw new BadRequestException(
          `La sesión "${dto.validationSessionId}" no pertenece al cierre "${dto.closureId}"`,
        );
      }
    }

    return this.prisma.incident.create({
      data: {
        closureId: dto.closureId,
        collectionId: dto.collectionId,
        validationSessionId: dto.validationSessionId,
        type: dto.type,
        status: IncidentStatus.OPEN,
        reason: dto.reason,
        createdById: userId,
      },
      include: INCIDENT_INCLUDE,
    });
  }

  /**
   * Actualiza la razón y/o mueve la incidencia a IN_REVIEW.
   * Para resolver o cancelar usar /resolve y /cancel respectivamente.
   */
  async update(id: string, dto: UpdateIncidentDto, userId: string) {
    const incident = await this.findExisting(id);

    if (TERMINAL_STATUSES.has(incident.status)) {
      throw new BadRequestException(
        `No se puede modificar una incidencia en estado "${incident.status}"`,
      );
    }

    // Solo se permite mover a IN_REVIEW desde OPEN
    if (dto.status && dto.status !== IncidentStatus.IN_REVIEW) {
      throw new BadRequestException(
        'Via PATCH solo se puede mover el estado a IN_REVIEW. ' +
          'Usa /resolve o /cancel para otros estados.',
      );
    }
    if (dto.status === IncidentStatus.IN_REVIEW && incident.status !== IncidentStatus.OPEN) {
      throw new BadRequestException(
        `No se puede mover de "${incident.status}" a IN_REVIEW. ` +
          'Solo se permite desde OPEN.',
      );
    }

    return this.prisma.incident.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.reason && { reason: dto.reason }),
      },
      include: INCIDENT_INCLUDE,
    });
  }

  /**
   * Resuelve la incidencia con un motivo de resolución obligatorio.
   *
   * Si todas las incidencias del cierre quedan resueltas/canceladas,
   * el cierre transiciona automáticamente a PENDING_VALIDATION (desde WITH_INCIDENTS).
   */
  async resolve(id: string, dto: ResolveIncidentDto, userId: string) {
    const incident = await this.findExisting(id);

    if (TERMINAL_STATUSES.has(incident.status)) {
      throw new BadRequestException(
        `La incidencia ya está en estado "${incident.status}" y no puede resolverse`,
      );
    }

    await this.prisma.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.RESOLVED,
        resolution: dto.resolution,
        resolvedById: userId,
        resolvedAt: new Date(),
      },
    });

    this.logger.log(`Incidencia ${id} RESUELTA por usuario ${userId}`);

    // Comprobar si todas las incidencias del cierre están resueltas/canceladas
    await this.checkAndTransitionClosure(incident.closureId, userId);

    return this.findOne(id);
  }

  /**
   * Cancela la incidencia (sin resolución, p.ej. incidencia duplicada o error de registro).
   *
   * Si todas las incidencias quedan resueltas/canceladas,
   * el cierre transiciona automáticamente a PENDING_VALIDATION.
   */
  async cancel(id: string, userId: string) {
    const incident = await this.findExisting(id);

    if (TERMINAL_STATUSES.has(incident.status)) {
      throw new BadRequestException(
        `La incidencia ya está en estado "${incident.status}" y no puede cancelarse`,
      );
    }

    await this.prisma.incident.update({
      where: { id },
      data: { status: IncidentStatus.CANCELLED },
    });

    this.logger.log(`Incidencia ${id} CANCELADA por usuario ${userId}`);

    // Comprobar si todas las incidencias del cierre están resueltas/canceladas
    await this.checkAndTransitionClosure(incident.closureId, userId);

    return this.findOne(id);
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  private async findExisting(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      select: { id: true, closureId: true, status: true },
    });
    if (!incident) throw new NotFoundException(`Incidencia con id "${id}" no encontrada`);
    return incident;
  }

  /**
   * Si todas las incidencias OPEN/IN_REVIEW del cierre están resueltas,
   * intenta transicionar el cierre a PENDING_VALIDATION (desde WITH_INCIDENTS).
   *
   * Regla SPEC §4.3: "Resolver todas las incidencias → cierre → PENDING_VALIDATION".
   */
  private async checkAndTransitionClosure(closureId: string, userId: string) {
    const allResolved = await this.incidentGenerator.areAllResolved(closureId);
    if (!allResolved) return;

    const closure = await this.prisma.dealClosure.findUnique({
      where: { id: closureId },
      select: { status: true },
    });

    if (
      closure &&
      this.stateMachine.canTransition(closure.status, ClosureStatus.PENDING_VALIDATION)
    ) {
      try {
        await this.stateMachine.transition(closureId, ClosureStatus.PENDING_VALIDATION, userId);
        this.logger.log(
          `Cierre ${closureId} → PENDING_VALIDATION (todas las incidencias resueltas)`,
        );
      } catch (err) {
        // La transición puede fallar si hay precondiciones no cumplidas (ej. sesiones en curso)
        this.logger.warn(
          `No se pudo transicionar cierre ${closureId} a PENDING_VALIDATION: ${(err as Error).message}`,
        );
      }
    }
  }
}
