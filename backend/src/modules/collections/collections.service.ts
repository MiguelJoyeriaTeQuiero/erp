import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ClosureStatus, CollectionStatus, IncidentStatus, IncidentType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { StateMachineService } from '@domain/state-machine.service';
import { ReconciliationService } from '@domain/reconciliation.service';
import { IncidentGeneratorService } from '@domain/incident-generator.service';
import { paginate } from '@common/dto/paginated-response.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { AddCollectionLineDto } from './dto/add-collection-line.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { FilterCollectionsDto } from './dto/filter-collections.dto';

const COLLECTION_INCLUDE = {
  collector: { select: { id: true, name: true } },
  lines: {
    include: {
      metalType: { select: { id: true, name: true, code: true } },
      karat: { select: { id: true, label: true, purity: true } },
      conversions: {
        select: {
          id: true,
          status: true,
          conversionType: true,
          equivalentGrams: true,
          sourceGrams: true,
          sourceKarat: { select: { label: true } },
          targetKarat: { select: { label: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' } as const,
  },
} satisfies Prisma.CollectionInclude;

/** Estados del cierre que permiten registrar una recogida */
const ALLOWED_CLOSURE_STATES = new Set<ClosureStatus>([
  ClosureStatus.CONFIRMED,
  ClosureStatus.WITH_ADVANCE,
  ClosureStatus.PENDING_COLLECTION,
  ClosureStatus.PARTIAL_COLLECTION,
  ClosureStatus.WITH_INCIDENTS,
]);

/** Tipos de incidencias que se regeneran en cada gap-check (son idempotentes) */
const REGENERABLE_INCIDENT_TYPES = [
  IncidentType.INVALID_MATERIAL,
  IncidentType.PENDING_COLLECTION,
] as const;

@Injectable()
export class CollectionsService {
  private readonly logger = new Logger(CollectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: StateMachineService,
    private readonly reconciliation: ReconciliationService,
    private readonly incidentGenerator: IncidentGeneratorService,
  ) {}

  // ── Consultas ──────────────────────────────────────────────────────────────

  async findAll(filters: FilterCollectionsDto) {
    const { page, limit, closureId, collectorId, status, dateFrom, dateTo } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.CollectionWhereInput = {
      ...(closureId && { closureId }),
      ...(collectorId && { collectorId }),
      ...(status && { status }),
      ...((dateFrom ?? dateTo) && {
        collectedAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.collection.findMany({
        where,
        include: COLLECTION_INCLUDE,
        orderBy: { collectedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.collection.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: COLLECTION_INCLUDE,
    });
    if (!collection) throw new NotFoundException(`Recogida con id "${id}" no encontrada`);
    return collection;
  }

  // ── Escritura ──────────────────────────────────────────────────────────────

  /**
   * Crea una nueva recogida vinculada a un cierre.
   * El cierre pasa automáticamente a PENDING_COLLECTION si estaba en CONFIRMED,
   * WITH_ADVANCE, WITH_INCIDENTS o PARTIAL_COLLECTION.
   */
  async create(closureId: string, dto: CreateCollectionDto, userId: string) {
    const closure = await this.prisma.dealClosure.findUnique({
      where: { id: closureId },
      select: { id: true, status: true },
    });
    if (!closure) throw new NotFoundException(`Cierre con id "${closureId}" no encontrado`);

    if (!ALLOWED_CLOSURE_STATES.has(closure.status)) {
      throw new BadRequestException(
        `No se puede crear una recogida en un cierre con estado "${closure.status}". ` +
          `Estados permitidos: ${[...ALLOWED_CLOSURE_STATES].join(', ')}`,
      );
    }

    const collection = await this.prisma.collection.create({
      data: {
        closureId,
        collectorId: userId,
        isPartial: dto.isPartial,
        collectedAt: new Date(dto.collectedAt),
        observations: dto.observations,
      },
      include: COLLECTION_INCLUDE,
    });

    // Transicionar a PENDING_COLLECTION desde estados previos
    const needsTransition =
      closure.status === ClosureStatus.CONFIRMED ||
      closure.status === ClosureStatus.WITH_ADVANCE ||
      closure.status === ClosureStatus.WITH_INCIDENTS ||
      closure.status === ClosureStatus.PARTIAL_COLLECTION;

    if (needsTransition) {
      await this.stateMachine.transition(closureId, ClosureStatus.PENDING_COLLECTION, userId);
      this.logger.log(`Cierre ${closureId} → PENDING_COLLECTION (nueva recogida ${collection.id})`);
    }

    return collection;
  }

  /**
   * Añade una línea de material a la recogida y ejecuta el gap-check automático.
   *
   * El gap-check (IncidentGeneratorService.checkCollectionGaps) detecta:
   *   - Metal distinto al pactado → Incident INVALID_MATERIAL
   *   - Mismo metal, quilataje distinto → Conversion AUTO (PENDING)
   *   - Material faltante (solo si !isPartial) → Incident PENDING_COLLECTION
   *
   * Para garantizar idempotencia, las incidencias OPEN regenerables de esta
   * recogida se eliminan antes de cada gap-check.
   *
   * Tras el gap-check, el estado del cierre se actualiza automáticamente.
   */
  async addLine(collectionId: string, dto: AddCollectionLineDto, userId: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
      select: { id: true, closureId: true, status: true, isPartial: true },
    });
    if (!collection) throw new NotFoundException(`Recogida con id "${collectionId}" no encontrada`);

    if (collection.status !== CollectionStatus.REGISTERED) {
      throw new BadRequestException(
        `No se pueden añadir líneas a una recogida en estado "${collection.status}"`,
      );
    }

    // Validar quilataje y obtener purity snapshot
    const karat = await this.prisma.karatCatalog.findUnique({
      where: { id: dto.karatId },
      select: { id: true, purity: true, metalTypeId: true, isActive: true },
    });
    if (!karat || !karat.isActive) {
      throw new NotFoundException(`Quilataje con id "${dto.karatId}" no encontrado o inactivo`);
    }
    if (karat.metalTypeId !== dto.metalTypeId) {
      throw new BadRequestException(
        `El quilataje "${dto.karatId}" no pertenece al metal "${dto.metalTypeId}"`,
      );
    }

    const gramsDeclared = new Decimal(dto.gramsDeclared);
    if (gramsDeclared.lte(0)) {
      throw new BadRequestException('Los gramos declarados deben ser mayores que 0');
    }

    // Crear línea con snapshot de pureza en el momento de la recogida
    await this.prisma.collectionLine.create({
      data: {
        collectionId,
        metalTypeId: dto.metalTypeId,
        karatId: dto.karatId,
        gramsDeclared,
        puritySnapshot: karat.purity,
      },
    });

    // Gap-check completo (idempotente: borra incidencias OPEN regenerables primero)
    await this.runGapCheck(collection.closureId, collectionId, collection.isPartial, userId);

    // Retornar recogida completa actualizada
    return this.findOne(collectionId);
  }

  /**
   * Actualiza metadata de la recogida.
   * Si isPartial cambia a false, se ejecuta un gap-check forzado y se actualiza el estado del cierre.
   * No se puede revertir isPartial de false → true.
   */
  async update(id: string, dto: UpdateCollectionDto, userId: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      select: { id: true, closureId: true, status: true, isPartial: true },
    });
    if (!collection) throw new NotFoundException(`Recogida con id "${id}" no encontrada`);

    if (collection.status !== CollectionStatus.REGISTERED) {
      throw new BadRequestException(
        `No se puede modificar una recogida en estado "${collection.status}"`,
      );
    }

    if (dto.isPartial === true && !collection.isPartial) {
      throw new BadRequestException(
        'No se puede revertir una recogida ya completada a estado parcial',
      );
    }

    await this.prisma.collection.update({
      where: { id },
      data: {
        ...(dto.isPartial !== undefined && { isPartial: dto.isPartial }),
        ...(dto.observations !== undefined && { observations: dto.observations }),
        ...(dto.collectedAt !== undefined && { collectedAt: new Date(dto.collectedAt) }),
      },
    });

    // Si se está finalizando (isPartial → false), forzar gap-check y transición
    if (dto.isPartial === false) {
      await this.runGapCheck(collection.closureId, id, false, userId);
    }

    return this.findOne(id);
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  /**
   * Ejecuta el gap-check completo sobre la recogida usando IncidentGeneratorService.
   *
   * Estrategia de idempotencia:
   *   1. Elimina incidencias OPEN de tipo INVALID_MATERIAL / PENDING_COLLECTION
   *      vinculadas a esta recogida (se regenerarán limpias).
   *   2. Llama a checkCollectionGaps (crea conversiones idempotentemente y nuevas incidencias).
   *   3. Actualiza el estado del cierre según resultado de la conciliación.
   */
  private async runGapCheck(
    closureId: string,
    collectionId: string,
    isPartial: boolean,
    userId: string,
  ) {
    // Limpiar incidencias regenerables (solo OPEN; no tocar IN_REVIEW ni RESOLVED)
    await this.prisma.incident.deleteMany({
      where: {
        collectionId,
        status: IncidentStatus.OPEN,
        type: { in: [...REGENERABLE_INCIDENT_TYPES] },
      },
    });

    // Gap-check del dominio: metal distinto → INVALID_MATERIAL,
    // karat distinto → Conversion AUTO, material faltante → PENDING_COLLECTION
    await this.incidentGenerator.checkCollectionGaps(closureId, collectionId);

    // Actualizar estado del cierre según conciliación
    await this.updateClosureState(closureId, isPartial, userId);
  }

  /**
   * Determina y aplica la transición de estado del cierre tras un gap-check.
   *
   * - !isPartial + totalmente recogido → PENDING_VALIDATION
   * - !isPartial + material pendiente  → PARTIAL_COLLECTION
   * - isPartial (parcial)              → PARTIAL_COLLECTION
   */
  private async updateClosureState(closureId: string, isPartial: boolean, userId: string) {
    const closure = await this.prisma.dealClosure.findUnique({
      where: { id: closureId },
      select: { status: true },
    });
    if (!closure) return;

    if (!isPartial) {
      const fullyCollected = await this.reconciliation.isFullyCollected(closureId);

      if (
        fullyCollected &&
        this.stateMachine.canTransition(closure.status, ClosureStatus.PENDING_VALIDATION)
      ) {
        await this.stateMachine.transition(closureId, ClosureStatus.PENDING_VALIDATION, userId);
        this.logger.log(`Cierre ${closureId} → PENDING_VALIDATION (recogida completa y sin pendientes)`);
      } else if (
        !fullyCollected &&
        this.stateMachine.canTransition(closure.status, ClosureStatus.PARTIAL_COLLECTION)
      ) {
        await this.stateMachine.transition(closureId, ClosureStatus.PARTIAL_COLLECTION, userId);
        this.logger.log(`Cierre ${closureId} → PARTIAL_COLLECTION (material pendiente)`);
      }
    } else {
      // Recogida parcial: cierre pasa a PARTIAL_COLLECTION
      if (
        closure.status !== ClosureStatus.PARTIAL_COLLECTION &&
        this.stateMachine.canTransition(closure.status, ClosureStatus.PARTIAL_COLLECTION)
      ) {
        await this.stateMachine.transition(closureId, ClosureStatus.PARTIAL_COLLECTION, userId);
        this.logger.log(`Cierre ${closureId} → PARTIAL_COLLECTION (recogida parcial registrada)`);
      }
    }
  }
}
