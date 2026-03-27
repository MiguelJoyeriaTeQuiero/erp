import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConversionStatus, ConversionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { PrismaService } from '@modules/prisma/prisma.service';

@Injectable()
export class ConversionService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Cálculo puro ───────────────────────────────────────────────────────────

  /**
   * Calcula los gramos equivalentes al convertir entre quilatajes.
   * Fórmula: equivalente = sourceGrams × (sourcePurity / targetPurity)
   * Resultado redondeado a 4 decimales (precisión de quilataje).
   */
  calculateEquivalent(
    sourceGrams: Decimal,
    sourcePurity: Decimal,
    targetPurity: Decimal,
  ): Decimal {
    if (targetPurity.isZero()) {
      throw new BadRequestException('La pureza objetivo no puede ser cero');
    }
    return sourceGrams.mul(sourcePurity).div(targetPurity).toDecimalPlaces(4);
  }

  // ── Operaciones con IO ─────────────────────────────────────────────────────

  /**
   * Crea una conversión automática entre una línea de recogida y una línea de cierre.
   * Se invoca cuando la recogida tiene un quilataje distinto al pactado (mismo metal).
   */
  async createAutoConversion(collectionLineId: string, closureLineId: string) {
    const [collLine, closureLine] = await Promise.all([
      this.prisma.collectionLine.findUniqueOrThrow({
        where: { id: collectionLineId },
        include: { karat: true },
      }),
      this.prisma.dealClosureLine.findUniqueOrThrow({
        where: { id: closureLineId },
        include: { karat: true },
      }),
    ]);

    // Verificar que son del mismo metal
    if (collLine.metalTypeId !== closureLine.metalTypeId) {
      throw new BadRequestException(
        'No se puede crear conversión automática entre metales distintos. ' +
          'Usa el tipo de incidencia INVALID_MATERIAL.',
      );
    }

    // Si tienen el mismo quilataje, no hace falta conversión
    if (collLine.karatId === closureLine.karatId) {
      throw new BadRequestException(
        'La línea de recogida ya tiene el mismo quilataje que la línea de cierre.',
      );
    }

    const equivalentGrams = this.calculateEquivalent(
      collLine.gramsDeclared,
      collLine.puritySnapshot,
      closureLine.puritySnapshot,
    );

    return this.prisma.conversion.create({
      data: {
        collectionLineId,
        closureLineId,
        sourceKaratId: collLine.karatId,
        targetKaratId: closureLine.karatId,
        sourceGrams: collLine.gramsDeclared,
        sourcePurity: collLine.puritySnapshot,
        targetPurity: closureLine.puritySnapshot,
        equivalentGrams,
        conversionType: ConversionType.AUTOMATIC,
        status: ConversionStatus.PENDING,
      },
      include: {
        sourceKarat: { select: { label: true, purity: true } },
        targetKarat: { select: { label: true, purity: true } },
        collectionLine: { select: { gramsDeclared: true } },
      },
    });
  }

  /**
   * Aplica una conversión pendiente: marca como APPLIED y registra quién la aprobó.
   */
  async applyConversion(conversionId: string, userId: string) {
    const conversion = await this.findPendingConversion(conversionId);

    return this.prisma.conversion.update({
      where: { id: conversionId },
      data: {
        status: ConversionStatus.APPLIED,
        appliedById: userId,
      },
    });
  }

  /**
   * Rechaza una conversión pendiente, registrando el motivo.
   * El motivo es obligatorio para trazabilidad.
   */
  async rejectConversion(conversionId: string, userId: string, reason: string) {
    if (!reason?.trim()) {
      throw new BadRequestException('El motivo de rechazo es obligatorio');
    }

    const conversion = await this.findPendingConversion(conversionId);

    return this.prisma.conversion.update({
      where: { id: conversionId },
      data: {
        status: ConversionStatus.REJECTED,
        appliedById: userId,
        observation: reason.trim(),
      },
    });
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  private async findPendingConversion(conversionId: string) {
    const conversion = await this.prisma.conversion.findUnique({
      where: { id: conversionId },
    });

    if (!conversion) {
      throw new NotFoundException(`Conversión con id "${conversionId}" no encontrada`);
    }

    if (conversion.status !== ConversionStatus.PENDING) {
      throw new BadRequestException(
        `La conversión no está en estado PENDIENTE (estado actual: ${conversion.status})`,
      );
    }

    return conversion;
  }
}
