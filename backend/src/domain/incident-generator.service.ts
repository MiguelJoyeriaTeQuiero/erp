import { Injectable } from '@nestjs/common';
import { Incident, IncidentStatus, IncidentType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { ConversionService } from './conversion.service';

/** Umbral de discrepancia en gramos para generar incidencia (evitar falsos positivos por redondeo) */
const DISCREPANCY_THRESHOLD = new Decimal('0.05');

/** Pureza mínima para no considerar el material como chatarra */
const SCRAP_PURITY_THRESHOLD = new Decimal('0.200');

@Injectable()
export class IncidentGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversionService: ConversionService,
  ) {}

  // ── API pública ────────────────────────────────────────────────────────────

  /**
   * Analiza las líneas de una recogida y genera:
   * - Conversiones automáticas (mismo metal, quilataje distinto)
   * - Incidencias INVALID_MATERIAL (metal distinto al pactado)
   * - Incidencias PENDING_COLLECTION (material pactado que no ha llegado)
   *
   * Llamar después de registrar todas las líneas de una recogida.
   */
  async checkCollectionGaps(
    closureId: string,
    collectionId: string,
  ): Promise<Incident[]> {
    const [collection, closureLines] = await Promise.all([
      this.prisma.collection.findUniqueOrThrow({
        where: { id: collectionId },
        include: {
          lines: {
            include: {
              metalType: { select: { name: true, code: true } },
              karat: { select: { label: true } },
            },
          },
        },
      }),
      this.prisma.dealClosureLine.findMany({
        where: { closureId },
        include: {
          metalType: { select: { name: true, code: true } },
          karat: { select: { label: true } },
        },
      }),
    ]);

    const incidents: Incident[] = [];
    const creatorId = collection.collectorId;

    // ── Por cada línea de recogida, determinar si necesita conversión o incidencia ──

    for (const collLine of collection.lines) {
      const sameMetalLines = closureLines.filter(
        (cl) => cl.metalTypeId === collLine.metalTypeId,
      );

      if (sameMetalLines.length === 0) {
        // Metal no pactado en el cierre → incidencia INVALID_MATERIAL
        const incident = await this.prisma.incident.create({
          data: {
            closureId,
            collectionId,
            type: IncidentType.INVALID_MATERIAL,
            status: IncidentStatus.OPEN,
            reason:
              `Se recogió material de tipo ${collLine.metalType.name} (${collLine.karat.label}) ` +
              `que no está incluido en el cierre. ` +
              `Gramos declarados: ${collLine.gramsDeclared.toFixed(2)}g.`,
            createdById: creatorId,
          },
        });
        incidents.push(incident);
        continue;
      }

      // Mismo metal: comprobar si el quilataje coincide
      const exactMatch = sameMetalLines.find((cl) => cl.karatId === collLine.karatId);
      if (!exactMatch) {
        // Mismo metal, quilataje distinto → conversión automática contra la línea de cierre más próxima
        // Estrategia: usar la primera línea del mismo metal (podría mejorarse con distancia de pureza)
        const targetLine = sameMetalLines[0]!;

        // Verificar si ya existe una conversión para evitar duplicados
        const existingConversion = await this.prisma.conversion.findFirst({
          where: { collectionLineId: collLine.id, closureLineId: targetLine.id },
        });

        if (!existingConversion) {
          await this.conversionService.createAutoConversion(collLine.id, targetLine.id);
        }
      }
      // Si el quilataje coincide exactamente, no se requiere acción
    }

    // ── Detectar material pactado que aún no ha sido recogido (solo en recogidas "completas") ──

    if (!collection.isPartial) {
      for (const closureLine of closureLines) {
        const totalCollected = await this.sumCollectedForClosureLine(
          closureLine.id,
          closureLine.metalTypeId,
          closureLine.karatId,
          closureId,
        );

        const gap = closureLine.grams.sub(totalCollected);
        if (gap.gt(DISCREPANCY_THRESHOLD)) {
          const incident = await this.prisma.incident.create({
            data: {
              closureId,
              collectionId,
              type: IncidentType.PENDING_COLLECTION,
              status: IncidentStatus.OPEN,
              reason:
                `Faltan ${gap.toFixed(2)}g de ${closureLine.metalType.name} ${closureLine.karat.label}. ` +
                `Pactado: ${closureLine.grams.toFixed(2)}g — ` +
                `Recogido hasta ahora: ${totalCollected.toFixed(2)}g.`,
              createdById: creatorId,
            },
          });
          incidents.push(incident);
        }
      }
    }

    return incidents;
  }

  /**
   * Analiza las líneas de una sesión de validación y genera incidencias por:
   * - Discrepancia de gramos (VALIDATION_DISCREPANCY)
   * - Material detectado como chatarra (SCRAP) — pureza muy baja
   *
   * Llamar al aprobar/rechazar una sesión de validación.
   */
  async checkValidationDiscrepancies(validationSessionId: string): Promise<Incident[]> {
    const session = await this.prisma.validationSession.findUniqueOrThrow({
      where: { id: validationSessionId },
      include: {
        lines: {
          include: {
            karatValidated: { select: { label: true } },
            closureLine: {
              include: {
                metalType: { select: { name: true } },
                karat: { select: { label: true } },
              },
            },
            collectionLine: {
              select: { gramsDeclared: true, puritySnapshot: true, karat: { select: { label: true } } },
            },
          },
        },
      },
    });

    const incidents: Incident[] = [];
    const creatorId = session.validatorId;

    for (const valLine of session.lines) {
      // ── Chatarra: pureza validada muy baja ──
      if (valLine.purityValidated.lt(SCRAP_PURITY_THRESHOLD)) {
        const label = valLine.closureLine?.metalType.name ?? 'material';
        const incident = await this.prisma.incident.create({
          data: {
            closureId: session.closureId,
            validationSessionId,
            type: IncidentType.SCRAP,
            status: IncidentStatus.OPEN,
            reason:
              `Material de ${label} detectado como chatarra. ` +
              `Pureza validada: ${valLine.purityValidated.toFixed(4)} ` +
              `(umbral de chatarra: < ${SCRAP_PURITY_THRESHOLD.toFixed(3)}). ` +
              `Gramos: ${valLine.gramsValidated.toFixed(2)}g.`,
            createdById: creatorId,
          },
        });
        incidents.push(incident);
        continue; // No generar discrepancia adicional para chatarra
      }

      // ── Discrepancia de gramos con lo declarado en la recogida ──
      if (valLine.collectionLineId && valLine.collectionLine) {
        const declared = valLine.collectionLine.gramsDeclared;
        const diff = declared.sub(valLine.gramsValidated).abs();

        if (diff.gt(DISCREPANCY_THRESHOLD)) {
          const collKarat = valLine.collectionLine.karat.label;
          const incident = await this.prisma.incident.create({
            data: {
              closureId: session.closureId,
              validationSessionId,
              type: IncidentType.VALIDATION_DISCREPANCY,
              status: IncidentStatus.OPEN,
              reason:
                `Discrepancia en gramos para ${collKarat}: ` +
                `declarados ${declared.toFixed(2)}g, ` +
                `validados ${valLine.gramsValidated.toFixed(2)}g ` +
                `(diferencia: ${diff.toFixed(2)}g). ` +
                `${valLine.observation ? `Observación: ${valLine.observation}` : ''}`.trim(),
              createdById: creatorId,
            },
          });
          incidents.push(incident);
        }
      }

      // ── Discrepancia de quilataje con la línea pactada ──
      if (
        valLine.closureLineId &&
        valLine.closureLine &&
        valLine.karatValidatedId !== valLine.closureLine.karatId
      ) {
        const agreedKarat = valLine.closureLine.karat.label;
        const foundKarat = valLine.karatValidated.label;
        const incident = await this.prisma.incident.create({
          data: {
            closureId: session.closureId,
            validationSessionId,
            type: IncidentType.VALIDATION_DISCREPANCY,
            status: IncidentStatus.OPEN,
            reason:
              `Quilataje validado (${foundKarat}) difiere del pactado (${agreedKarat}). ` +
              `${valLine.observation ? `Observación: ${valLine.observation}` : ''}`.trim(),
            createdById: creatorId,
          },
        });
        incidents.push(incident);
      }
    }

    return incidents;
  }

  /**
   * Crea una incidencia ADVANCE_REFUND cuando se cancela un cierre que tiene adelanto.
   * La devolución del dinero se gestiona manualmente fuera del sistema.
   */
  async createAdvanceRefundIncident(closureId: string, cancelledById: string): Promise<Incident> {
    const closure = await this.prisma.dealClosure.findUniqueOrThrow({
      where: { id: closureId },
      include: {
        advance: { select: { amount: true, paymentMethod: true } },
        client: { select: { commercialName: true, taxId: true } },
      },
    });

    if (!closure.advance) {
      throw new Error(`El cierre ${closureId} no tiene adelanto registrado`);
    }

    return this.prisma.incident.create({
      data: {
        closureId,
        type: IncidentType.ADVANCE_REFUND,
        status: IncidentStatus.OPEN,
        reason:
          `Cierre ${closure.code} cancelado con adelanto pendiente de devolución. ` +
          `Cliente: ${closure.client.commercialName} (${closure.client.taxId}). ` +
          `Importe a devolver: ${closure.advance.amount.toFixed(2)} € ` +
          `(método de pago original: ${closure.advance.paymentMethod}).`,
        createdById: cancelledById,
      },
    });
  }

  /**
   * Comprueba si todas las incidencias del cierre están resueltas o canceladas.
   */
  async areAllResolved(closureId: string): Promise<boolean> {
    const openCount = await this.prisma.incident.count({
      where: {
        closureId,
        status: { in: [IncidentStatus.OPEN, IncidentStatus.IN_REVIEW] },
      },
    });
    return openCount === 0;
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  /**
   * Suma los gramos realmente recogidos para una línea de cierre:
   * líneas directas (mismo quilataje) + conversiones aplicadas.
   */
  private async sumCollectedForClosureLine(
    closureLineId: string,
    metalTypeId: string,
    karatId: string,
    closureId: string,
  ): Promise<Decimal> {
    const [directLines, appliedConversions] = await Promise.all([
      this.prisma.collectionLine.findMany({
        where: {
          metalTypeId,
          karatId,
          collection: { closureId, status: { not: 'CANCELLED' } },
        },
        select: { gramsDeclared: true },
      }),
      this.prisma.conversion.findMany({
        where: { closureLineId, status: 'APPLIED' },
        select: { equivalentGrams: true },
      }),
    ]);

    const directGrams = directLines.reduce(
      (sum, l) => sum.add(l.gramsDeclared),
      new Decimal(0),
    );
    const convertedGrams = appliedConversions.reduce(
      (sum, c) => sum.add(c.equivalentGrams),
      new Decimal(0),
    );

    return directGrams.add(convertedGrams).toDecimalPlaces(4);
  }
}
