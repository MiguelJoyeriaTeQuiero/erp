import {
  Injectable,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ClosureStatus } from '@prisma/client';
import { PrismaService } from '@modules/prisma/prisma.service';

// ── Grafo de transiciones válidas ─────────────────────────────────────────────
const VALID_TRANSITIONS: Record<ClosureStatus, ClosureStatus[]> = {
  [ClosureStatus.DRAFT]:              [ClosureStatus.CONFIRMED, ClosureStatus.CANCELLED],
  [ClosureStatus.CONFIRMED]:          [ClosureStatus.WITH_ADVANCE, ClosureStatus.PENDING_COLLECTION, ClosureStatus.CANCELLED],
  [ClosureStatus.WITH_ADVANCE]:       [ClosureStatus.PENDING_COLLECTION, ClosureStatus.CANCELLED],
  [ClosureStatus.PENDING_COLLECTION]: [ClosureStatus.PARTIAL_COLLECTION, ClosureStatus.PENDING_VALIDATION, ClosureStatus.CANCELLED],
  [ClosureStatus.PARTIAL_COLLECTION]: [ClosureStatus.PENDING_COLLECTION, ClosureStatus.PENDING_VALIDATION, ClosureStatus.CANCELLED],
  [ClosureStatus.PENDING_VALIDATION]: [ClosureStatus.IN_VALIDATION, ClosureStatus.CANCELLED],
  [ClosureStatus.IN_VALIDATION]:      [ClosureStatus.WITH_INCIDENTS, ClosureStatus.VALIDATED, ClosureStatus.CANCELLED],
  [ClosureStatus.WITH_INCIDENTS]:     [ClosureStatus.PENDING_VALIDATION, ClosureStatus.PENDING_COLLECTION, ClosureStatus.CANCELLED],
  [ClosureStatus.VALIDATED]:          [ClosureStatus.COMPLETED, ClosureStatus.CANCELLED],
  [ClosureStatus.COMPLETED]:          [],
  [ClosureStatus.CANCELLED]:          [],
};

// Estados terminales: no admiten ninguna transición
const TERMINAL_STATES = new Set<ClosureStatus>([ClosureStatus.COMPLETED, ClosureStatus.CANCELLED]);

// Etiquetas en español para mensajes de error
const STATUS_LABEL: Record<ClosureStatus, string> = {
  DRAFT:              'Borrador',
  CONFIRMED:          'Confirmado',
  WITH_ADVANCE:       'Con adelanto',
  PENDING_COLLECTION: 'Pendiente de recogida',
  PARTIAL_COLLECTION: 'Recogida parcial',
  PENDING_VALIDATION: 'Pendiente de validación',
  IN_VALIDATION:      'En validación',
  WITH_INCIDENTS:     'Con incidencias',
  VALIDATED:          'Validado',
  COMPLETED:          'Completado',
  CANCELLED:          'Cancelado',
};

@Injectable()
export class StateMachineService {
  constructor(private readonly prisma: PrismaService) {}

  // ── API pública ────────────────────────────────────────────────────────────

  /**
   * Comprueba si la transición de estado es válida según el grafo definido.
   */
  canTransition(currentStatus: ClosureStatus, targetStatus: ClosureStatus): boolean {
    const allowed = VALID_TRANSITIONS[currentStatus];
    return allowed !== undefined && allowed.includes(targetStatus);
  }

  /**
   * Devuelve las transiciones disponibles desde el estado actual.
   */
  getAvailableTransitions(currentStatus: ClosureStatus): ClosureStatus[] {
    return VALID_TRANSITIONS[currentStatus] ?? [];
  }

  /**
   * Ejecuta la transición de estado del cierre en la base de datos.
   * Valida la transición, verifica precondiciones y actualiza timestamps relevantes.
   * Las acciones derivadas (congelar precios, generar albarán) las coordina el módulo caller.
   */
  async transition(
    closureId: string,
    targetStatus: ClosureStatus,
    userId: string,
    options?: { cancellationReason?: string },
  ) {
    const closure = await this.prisma.dealClosure.findUniqueOrThrow({
      where: { id: closureId },
    });

    // ── Validar la transición es posible ──────────────────────────────────
    if (TERMINAL_STATES.has(closure.status)) {
      throw new BadRequestException(
        `El cierre está en estado "${STATUS_LABEL[closure.status]}" y no admite más cambios`,
      );
    }

    if (!this.canTransition(closure.status, targetStatus)) {
      throw new UnprocessableEntityException(
        `Transición no permitida: "${STATUS_LABEL[closure.status]}" → "${STATUS_LABEL[targetStatus]}". ` +
          `Transiciones válidas desde este estado: ${this.getAvailableTransitions(closure.status)
            .map((s) => STATUS_LABEL[s])
            .join(', ')}`,
      );
    }

    // ── Precondiciones específicas por transición ─────────────────────────
    await this.assertPreconditions(closure.id, closure.status, targetStatus);

    // ── Campos a actualizar según el estado destino ────────────────────────
    const now = new Date();
    const extra: Record<string, unknown> = {};

    if (targetStatus === ClosureStatus.CONFIRMED) {
      extra['confirmedById'] = userId;
      extra['confirmedAt'] = now;
    }

    if (targetStatus === ClosureStatus.CANCELLED) {
      extra['cancelledById'] = userId;
      extra['cancelledAt'] = now;
      if (options?.cancellationReason) {
        extra['cancellationReason'] = options.cancellationReason;
      }
    }

    if (targetStatus === ClosureStatus.COMPLETED) {
      extra['completedAt'] = now;
    }

    return this.prisma.dealClosure.update({
      where: { id: closureId },
      data: {
        status: targetStatus,
        version: { increment: 1 }, // optimistic locking
        ...extra,
      },
    });
  }

  // ── Precondiciones de negocio ──────────────────────────────────────────────

  private async assertPreconditions(
    closureId: string,
    from: ClosureStatus,
    to: ClosureStatus,
  ): Promise<void> {
    // Confirmar: el cierre debe tener al menos una línea
    if (to === ClosureStatus.CONFIRMED) {
      const lineCount = await this.prisma.dealClosureLine.count({ where: { closureId } });
      if (lineCount === 0) {
        throw new BadRequestException(
          'No se puede confirmar un cierre sin líneas de material pactado',
        );
      }
    }

    // Completar: debe estar validado y no tener incidencias abiertas
    if (to === ClosureStatus.COMPLETED) {
      if (from !== ClosureStatus.VALIDATED) {
        throw new UnprocessableEntityException(
          'Solo se puede completar un cierre en estado VALIDATED',
        );
      }
      const openIncidents = await this.prisma.incident.count({
        where: { closureId, status: { in: ['OPEN', 'IN_REVIEW'] } },
      });
      if (openIncidents > 0) {
        throw new BadRequestException(
          `No se puede completar el cierre: tiene ${openIncidents} incidencia(s) sin resolver`,
        );
      }
    }

    // PENDING_VALIDATION desde WITH_INCIDENTS: todas las incidencias deben estar resueltas
    if (to === ClosureStatus.PENDING_VALIDATION && from === ClosureStatus.WITH_INCIDENTS) {
      const openIncidents = await this.prisma.incident.count({
        where: { closureId, status: { in: ['OPEN', 'IN_REVIEW'] } },
      });
      if (openIncidents > 0) {
        throw new BadRequestException(
          `No se puede volver a validación: quedan ${openIncidents} incidencia(s) sin resolver`,
        );
      }
    }

    // IN_VALIDATION: debe existir al menos una sesión de validación en curso
    if (to === ClosureStatus.IN_VALIDATION) {
      const session = await this.prisma.validationSession.findFirst({
        where: { closureId, status: 'IN_PROGRESS' },
      });
      if (!session) {
        throw new BadRequestException(
          'Para pasar a validación debe existir una sesión de validación en curso',
        );
      }
    }

    // VALIDATED: no puede haber sesiones de validación en curso ni incidencias abiertas
    if (to === ClosureStatus.VALIDATED) {
      const inProgressSession = await this.prisma.validationSession.findFirst({
        where: { closureId, status: 'IN_PROGRESS' },
      });
      if (inProgressSession) {
        throw new BadRequestException(
          'Hay sesiones de validación todavía en curso. Ciérralas antes de validar el cierre',
        );
      }
      const openIncidents = await this.prisma.incident.count({
        where: { closureId, status: { in: ['OPEN', 'IN_REVIEW'] } },
      });
      if (openIncidents > 0) {
        throw new BadRequestException(
          `No se puede validar el cierre: hay ${openIncidents} incidencia(s) sin resolver`,
        );
      }
    }
  }
}
