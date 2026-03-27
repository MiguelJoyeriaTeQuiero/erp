import { Injectable } from '@nestjs/common';
import { ClosureStatus, IncidentStatus, ValidationStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { PrismaService } from '@modules/prisma/prisma.service';

export interface LineReconciliation {
  lineId: string;
  metalName: string;
  metalCode: string;
  karatLabel: string;
  purity: Decimal;
  agreedGrams: Decimal;
  pricePerGram: Decimal;
  lineAmount: Decimal;
  /** Gramos recogidos con el mismo quilataje pactado */
  directCollectedGrams: Decimal;
  /** Gramos equivalentes de conversiones APLICADAS que apuntan a esta línea */
  convertedEquivalentGrams: Decimal;
  /** Total recogido (directo + convertido) */
  totalCollectedGrams: Decimal;
  /** Gramos validados en sesiones APROBADAS */
  validatedGrams: Decimal;
  /** agreedGrams − totalCollectedGrams (> 0 = falta material) */
  pendingGrams: Decimal;
  /** Conversiones PENDIENTES de aprobar/rechazar para esta línea */
  pendingConversions: {
    id: string;
    sourceKaratLabel: string;
    sourceGrams: Decimal;
    equivalentGrams: Decimal;
  }[];
}

export interface ReconciliationSummary {
  closureId: string;
  status: ClosureStatus;
  lines: LineReconciliation[];
  totalAgreedAmount: Decimal;
  totalCollectedGrams: Decimal;
  totalValidatedGrams: Decimal;
  openIncidents: {
    id: string;
    type: string;
    status: IncidentStatus;
    reason: string;
  }[];
  isFullyCollected: boolean;
  isFullyValidated: boolean;
  canComplete: boolean;
}

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resumen completo de conciliación: pactado vs recogido vs validado por línea de cierre.
   */
  async getReconciliationSummary(closureId: string): Promise<ReconciliationSummary> {
    const closure = await this.prisma.dealClosure.findUniqueOrThrow({
      where: { id: closureId },
      include: {
        lines: {
          include: {
            metalType: { select: { name: true, code: true } },
            karat: { select: { label: true, purity: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const lines = await Promise.all(
      closure.lines.map((line) => this.buildLineReconciliation(line, closureId)),
    );

    const openIncidents = await this.prisma.incident.findMany({
      where: {
        closureId,
        status: { in: [IncidentStatus.OPEN, IncidentStatus.IN_REVIEW] },
      },
      select: { id: true, type: true, status: true, reason: true },
    });

    const isFullyCollected = lines.every((l) => l.pendingGrams.lte(0));
    const isFullyValidated = await this.isFullyValidated(closureId);
    const canComplete = await this.canComplete(closureId);

    return {
      closureId,
      status: closure.status,
      lines,
      totalAgreedAmount: closure.totalAmount,
      totalCollectedGrams: lines
        .reduce((sum, l) => sum.add(l.totalCollectedGrams), new Decimal(0))
        .toDecimalPlaces(2),
      totalValidatedGrams: lines
        .reduce((sum, l) => sum.add(l.validatedGrams), new Decimal(0))
        .toDecimalPlaces(2),
      openIncidents,
      isFullyCollected,
      isFullyValidated,
      canComplete,
    };
  }

  /**
   * ¿El total recogido (incluidas conversiones aplicadas) cubre todo lo pactado?
   */
  async isFullyCollected(closureId: string): Promise<boolean> {
    const closureLines = await this.prisma.dealClosureLine.findMany({
      where: { closureId },
    });

    for (const line of closureLines) {
      const { totalCollectedGrams } = await this.aggregateCollectedForLine(line.id, line.metalTypeId, line.karatId, closureId);
      if (totalCollectedGrams.lt(line.grams)) return false;
    }
    return true;
  }

  /**
   * ¿Todas las líneas de cierre tienen gramos validados suficientes (sesiones APROBADAS)?
   */
  async isFullyValidated(closureId: string): Promise<boolean> {
    const closureLines = await this.prisma.dealClosureLine.findMany({
      where: { closureId },
    });

    for (const line of closureLines) {
      const validated = await this.aggregateValidatedForLine(line.id);
      if (validated.lt(line.grams)) return false;
    }
    return true;
  }

  /**
   * ¿El cierre cumple todas las condiciones para ser completado?
   * Requiere: status=VALIDATED, sin incidencias abiertas, totalmente validado.
   */
  async canComplete(closureId: string): Promise<boolean> {
    const closure = await this.prisma.dealClosure.findUniqueOrThrow({
      where: { id: closureId },
      select: { status: true },
    });

    if (closure.status !== ClosureStatus.VALIDATED) return false;

    const openIncidents = await this.prisma.incident.count({
      where: {
        closureId,
        status: { in: [IncidentStatus.OPEN, IncidentStatus.IN_REVIEW] },
      },
    });
    if (openIncidents > 0) return false;

    return this.isFullyValidated(closureId);
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  private async buildLineReconciliation(
    line: {
      id: string;
      metalTypeId: string;
      karatId: string;
      grams: Decimal;
      pricePerGram: Decimal;
      lineAmount: Decimal;
      puritySnapshot: Decimal;
      metalType: { name: string; code: string };
      karat: { label: string; purity: Decimal };
    },
    closureId: string,
  ): Promise<LineReconciliation> {
    const { directGrams, convertedGrams, pendingConversions } =
      await this.aggregateCollectedForLine(line.id, line.metalTypeId, line.karatId, closureId);

    const totalCollectedGrams = directGrams.add(convertedGrams).toDecimalPlaces(4);
    const validatedGrams = await this.aggregateValidatedForLine(line.id);
    const pendingGrams = line.grams.sub(totalCollectedGrams).toDecimalPlaces(4);

    return {
      lineId: line.id,
      metalName: line.metalType.name,
      metalCode: line.metalType.code,
      karatLabel: line.karat.label,
      purity: line.puritySnapshot,
      agreedGrams: line.grams,
      pricePerGram: line.pricePerGram,
      lineAmount: line.lineAmount,
      directCollectedGrams: directGrams,
      convertedEquivalentGrams: convertedGrams,
      totalCollectedGrams,
      validatedGrams,
      pendingGrams,
      pendingConversions,
    };
  }

  /**
   * Suma gramos recogidos directamente (mismo quilataje) y por conversiones aplicadas.
   */
  private async aggregateCollectedForLine(
    closureLineId: string,
    metalTypeId: string,
    karatId: string,
    closureId: string,
  ) {
    // Gramos directos: líneas de recogida con mismo metal+quilataje en colecciones no canceladas
    const directLines = await this.prisma.collectionLine.findMany({
      where: {
        metalTypeId,
        karatId,
        collection: {
          closureId,
          status: { not: 'CANCELLED' },
        },
      },
      select: { gramsDeclared: true },
    });

    const directGrams = directLines
      .reduce((sum, cl) => sum.add(cl.gramsDeclared), new Decimal(0))
      .toDecimalPlaces(4);

    // Conversiones que apuntan a esta línea de cierre
    const conversions = await this.prisma.conversion.findMany({
      where: { closureLineId },
      include: {
        sourceKarat: { select: { label: true } },
      },
    });

    let convertedGrams = new Decimal(0);
    const pendingConversions: LineReconciliation['pendingConversions'] = [];

    for (const conv of conversions) {
      if (conv.status === 'APPLIED') {
        convertedGrams = convertedGrams.add(conv.equivalentGrams);
      } else if (conv.status === 'PENDING') {
        pendingConversions.push({
          id: conv.id,
          sourceKaratLabel: conv.sourceKarat.label,
          sourceGrams: conv.sourceGrams,
          equivalentGrams: conv.equivalentGrams,
        });
      }
    }

    return {
      directGrams,
      convertedGrams: convertedGrams.toDecimalPlaces(4),
      totalCollectedGrams: directGrams.add(convertedGrams).toDecimalPlaces(4),
      pendingConversions,
    };
  }

  /**
   * Suma gramos validados en sesiones APROBADAS para una línea de cierre.
   */
  private async aggregateValidatedForLine(closureLineId: string): Promise<Decimal> {
    const validationLines = await this.prisma.validationLine.findMany({
      where: {
        closureLineId,
        session: { status: ValidationStatus.APPROVED },
      },
      select: { gramsValidated: true },
    });

    return validationLines
      .reduce((sum, vl) => sum.add(vl.gramsValidated), new Decimal(0))
      .toDecimalPlaces(4);
  }
}
