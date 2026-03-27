import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ClosureStatus, ValidationStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { StateMachineService } from '@domain/state-machine.service';
import { ReconciliationService } from '@domain/reconciliation.service';
import { IncidentGeneratorService } from '@domain/incident-generator.service';
import { CreateValidationSessionDto } from './dto/create-validation-session.dto';
import { AddValidationLineDto } from './dto/add-validation-line.dto';
import { ApproveValidationDto } from './dto/approve-validation.dto';
import { RejectValidationDto } from './dto/reject-validation.dto';

/** Diferencia máxima de gramos sin requerir observación */
const CORRECTION_THRESHOLD = new Decimal('0.05');

const SESSION_INCLUDE = {
  validator: { select: { id: true, name: true } },
  collection: { select: { id: true, collectedAt: true, isPartial: true } },
  lines: {
    include: {
      karatValidated: { select: { id: true, label: true, purity: true } },
      closureLine: {
        include: {
          metalType: { select: { id: true, name: true, code: true } },
          karat: { select: { id: true, label: true } },
        },
      },
      collectionLine: {
        include: {
          metalType: { select: { id: true, name: true, code: true } },
          karat: { select: { id: true, label: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' } as const,
  },
  incidents: {
    select: { id: true, type: true, status: true, reason: true },
  },
} satisfies Prisma.ValidationSessionInclude;

@Injectable()
export class ValidationsService {
  private readonly logger = new Logger(ValidationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: StateMachineService,
    private readonly reconciliation: ReconciliationService,
    private readonly incidentGenerator: IncidentGeneratorService,
  ) {}

  // ── Consultas ──────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const session = await this.prisma.validationSession.findUnique({
      where: { id },
      include: SESSION_INCLUDE,
    });
    if (!session) {
      throw new NotFoundException(`Sesión de validación con id "${id}" no encontrada`);
    }
    return session;
  }

  // ── Escritura ──────────────────────────────────────────────────────────────

  /**
   * Crea una sesión de validación para el cierre.
   *
   * Precondiciones:
   * - El cierre debe estar en PENDING_VALIDATION.
   * - No puede existir otra sesión IN_PROGRESS para el mismo cierre.
   *
   * Efecto: cierre pasa a IN_VALIDATION (via StateMachineService).
   */
  async create(closureId: string, dto: CreateValidationSessionDto, userId: string) {
    const closure = await this.prisma.dealClosure.findUnique({
      where: { id: closureId },
      select: { id: true, status: true },
    });
    if (!closure) throw new NotFoundException(`Cierre con id "${closureId}" no encontrado`);

    if (closure.status !== ClosureStatus.PENDING_VALIDATION) {
      throw new BadRequestException(
        `El cierre debe estar en estado PENDING_VALIDATION para iniciar validación ` +
          `(estado actual: "${closure.status}")`,
      );
    }

    // Solo una sesión activa por cierre
    const existing = await this.prisma.validationSession.findFirst({
      where: { closureId, status: ValidationStatus.IN_PROGRESS },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        `Ya existe una sesión de validación en curso para este cierre (id: "${existing.id}"). ` +
          `Apruébala o recházala antes de crear otra.`,
      );
    }

    // Si se vincula a una recogida, verificar que pertenece al cierre
    if (dto.collectionId) {
      const collection = await this.prisma.collection.findUnique({
        where: { id: dto.collectionId },
        select: { closureId: true },
      });
      if (!collection || collection.closureId !== closureId) {
        throw new BadRequestException(
          `La recogida "${dto.collectionId}" no pertenece al cierre "${closureId}"`,
        );
      }
    }

    const session = await this.prisma.validationSession.create({
      data: {
        closureId,
        collectionId: dto.collectionId,
        validatorId: userId,
        observations: dto.observations,
      },
      include: SESSION_INCLUDE,
    });

    // Transición del cierre: PENDING_VALIDATION → IN_VALIDATION
    await this.stateMachine.transition(closureId, ClosureStatus.IN_VALIDATION, userId);
    this.logger.log(`Cierre ${closureId} → IN_VALIDATION (sesión ${session.id})`);

    return session;
  }

  /**
   * Añade una línea validada a la sesión.
   *
   * Regla de corrección:
   * - Si gramsValidated difiere > 0.05g del pactado o recogido → observation obligatoria.
   * - Si karatValidatedId difiere del pactado o recogido → observation obligatoria.
   */
  async addLine(sessionId: string, dto: AddValidationLineDto, userId: string) {
    const session = await this.getInProgressSession(sessionId);

    // Obtener quilataje validado (para puritySnapshot)
    const karat = await this.prisma.karatCatalog.findUnique({
      where: { id: dto.karatValidatedId },
      select: { id: true, purity: true, isActive: true },
    });
    if (!karat || !karat.isActive) {
      throw new NotFoundException(
        `Quilataje con id "${dto.karatValidatedId}" no encontrado o inactivo`,
      );
    }

    const gramsValidated = new Decimal(dto.gramsValidated);
    if (gramsValidated.lte(0)) {
      throw new BadRequestException('Los gramos validados deben ser mayores que 0');
    }

    // purityValidated: explícita o teórica del quilataje
    const purityValidated = dto.purityValidated
      ? new Decimal(dto.purityValidated)
      : karat.purity;

    // Detectar corrección y exigir observación
    const isCorrection = await this.detectCorrection(
      dto.closureLineId,
      dto.collectionLineId,
      gramsValidated,
      dto.karatValidatedId,
    );

    if (isCorrection && !dto.observation?.trim()) {
      throw new BadRequestException(
        'La observación es obligatoria cuando hay corrección de gramos (> 0.05g) ' +
          'o de quilataje respecto a lo declarado en cierre o recogida',
      );
    }

    const line = await this.prisma.validationLine.create({
      data: {
        sessionId,
        closureLineId: dto.closureLineId,
        collectionLineId: dto.collectionLineId,
        gramsValidated,
        karatValidatedId: dto.karatValidatedId,
        purityValidated,
        observation: dto.observation,
      },
      include: {
        karatValidated: { select: { id: true, label: true, purity: true } },
        closureLine: {
          include: {
            metalType: { select: { id: true, name: true, code: true } },
            karat: { select: { id: true, label: true } },
          },
        },
        collectionLine: {
          include: {
            metalType: { select: { id: true, name: true, code: true } },
            karat: { select: { id: true, label: true } },
          },
        },
      },
    });

    // Log corrección para auditoría interna
    if (isCorrection) {
      this.logger.warn(
        `Corrección detectada en sesión ${sessionId}: línea ${line.id} ` +
          `(${gramsValidated.toFixed(2)}g, karat: ${dto.karatValidatedId})`,
      );
    }

    return line;
  }

  /**
   * Aprueba la sesión de validación.
   *
   * Si el cierre queda totalmente validado (todos los gramos cuadran),
   * transiciona automáticamente a VALIDATED.
   */
  async approve(sessionId: string, dto: ApproveValidationDto, userId: string) {
    const session = await this.getInProgressSession(sessionId);

    // Marcar sesión como APPROVED
    await this.prisma.validationSession.update({
      where: { id: sessionId },
      data: {
        status: ValidationStatus.APPROVED,
        ...(dto.observations && { observations: dto.observations }),
      },
    });

    this.logger.log(`Sesión ${sessionId} APROBADA por usuario ${userId}`);

    // Intentar transición del cierre a VALIDATED si todo cuadra
    const fullyValidated = await this.reconciliation.isFullyValidated(session.closureId);

    if (fullyValidated) {
      const closure = await this.prisma.dealClosure.findUnique({
        where: { id: session.closureId },
        select: { status: true },
      });
      if (closure && this.stateMachine.canTransition(closure.status, ClosureStatus.VALIDATED)) {
        // La transición valida: sin sesiones en curso + sin incidencias abiertas
        await this.stateMachine.transition(session.closureId, ClosureStatus.VALIDATED, userId);
        this.logger.log(
          `Cierre ${session.closureId} → VALIDATED (validación completa aprobada)`,
        );
      } else {
        this.logger.warn(
          `Cierre ${session.closureId} completamente validado pero no puede transicionar ` +
            `(estado: ${closure?.status ?? 'unknown'}, quizás incidencias abiertas)`,
        );
      }
    }

    return this.findOne(sessionId);
  }

  /**
   * Rechaza la sesión de validación.
   *
   * Efectos automáticos:
   * 1. Llama a IncidentGeneratorService.checkValidationDiscrepancies() para crear
   *    incidencias SCRAP y VALIDATION_DISCREPANCY por línea.
   * 2. Transiciona el cierre a WITH_INCIDENTS.
   */
  async reject(sessionId: string, dto: RejectValidationDto, userId: string) {
    const session = await this.getInProgressSession(sessionId);

    // Marcar sesión como REJECTED (antes del gap-check, para que los incidents apunten al sessionId)
    await this.prisma.validationSession.update({
      where: { id: sessionId },
      data: {
        status: ValidationStatus.REJECTED,
        observations: dto.observations,
      },
    });

    this.logger.log(`Sesión ${sessionId} RECHAZADA por usuario ${userId}`);

    // Generar incidencias automáticas por discrepancias
    const incidents = await this.incidentGenerator.checkValidationDiscrepancies(sessionId);
    this.logger.log(
      `${incidents.length} incidencia(s) generada(s) para sesión ${sessionId}`,
    );

    // Transición del cierre a WITH_INCIDENTS
    const closure = await this.prisma.dealClosure.findUnique({
      where: { id: session.closureId },
      select: { status: true },
    });
    if (closure && this.stateMachine.canTransition(closure.status, ClosureStatus.WITH_INCIDENTS)) {
      await this.stateMachine.transition(session.closureId, ClosureStatus.WITH_INCIDENTS, userId);
      this.logger.log(`Cierre ${session.closureId} → WITH_INCIDENTS`);
    }

    return this.findOne(sessionId);
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  /** Busca una sesión activa (IN_PROGRESS) o lanza excepción. */
  private async getInProgressSession(sessionId: string) {
    const session = await this.prisma.validationSession.findUnique({
      where: { id: sessionId },
      select: { id: true, closureId: true, status: true },
    });
    if (!session) {
      throw new NotFoundException(`Sesión de validación con id "${sessionId}" no encontrada`);
    }
    if (session.status !== ValidationStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `La sesión no está en curso (estado actual: "${session.status}"). ` +
          `Solo se puede operar sobre sesiones IN_PROGRESS.`,
      );
    }
    return session;
  }

  /**
   * Detecta si los valores validados difieren de los declarados/pactados,
   * lo que requiere una observación obligatoria.
   */
  private async detectCorrection(
    closureLineId: string | undefined,
    collectionLineId: string | undefined,
    gramsValidated: Decimal,
    karatValidatedId: string,
  ): Promise<boolean> {
    if (closureLineId) {
      const cl = await this.prisma.dealClosureLine.findUnique({
        where: { id: closureLineId },
        select: { grams: true, karatId: true },
      });
      if (cl) {
        const diff = cl.grams.sub(gramsValidated).abs();
        if (diff.gt(CORRECTION_THRESHOLD) || cl.karatId !== karatValidatedId) return true;
      }
    }

    if (collectionLineId) {
      const coll = await this.prisma.collectionLine.findUnique({
        where: { id: collectionLineId },
        select: { gramsDeclared: true, karatId: true },
      });
      if (coll) {
        const diff = coll.gramsDeclared.sub(gramsValidated).abs();
        if (diff.gt(CORRECTION_THRESHOLD) || coll.karatId !== karatValidatedId) return true;
      }
    }

    return false;
  }
}
