import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/client';
import { PrismaService } from '@modules/prisma/prisma.service';

@Injectable()
export class PricingCalculatorService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Cálculos puros (sin IO) ────────────────────────────────────────────────

  /**
   * Calcula el importe de una línea: gramos × precio/gramo, redondeado a 2 decimales.
   */
  calculateLineAmount(grams: Decimal, pricePerGram: Decimal): Decimal {
    return grams.mul(pricePerGram).toDecimalPlaces(2);
  }

  /**
   * Suma el importe de todas las líneas de un cierre.
   */
  calculateTotalAmount(lines: { lineAmount: Decimal }[]): Decimal {
    return lines
      .reduce((sum, line) => sum.add(line.lineAmount), new Decimal(0))
      .toDecimalPlaces(2);
  }

  // ── Acceso a tarifas (con IO) ──────────────────────────────────────────────

  /**
   * Obtiene el precio vigente por gramo para la combinación metal/quilataje/categoría.
   * Devuelve la tarifa más reciente dentro del período de validez.
   */
  async getCurrentPrice(
    metalTypeId: string,
    karatId: string,
    categoryId: string,
  ): Promise<Decimal> {
    const now = new Date();
    const rate = await this.prisma.priceRate.findFirst({
      where: {
        metalTypeId,
        karatId,
        categoryId,
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      },
      orderBy: { validFrom: 'desc' },
    });

    if (!rate) {
      throw new NotFoundException(
        `No hay tarifa activa para metalTypeId=${metalTypeId}, ` +
          `karatId=${karatId}, categoryId=${categoryId}`,
      );
    }

    return rate.pricePerGram;
  }

  /**
   * Congela los precios de todas las líneas de un cierre en el momento de confirmación.
   * Actualiza pricePerGram, lineAmount, puritySnapshot en cada línea y totalAmount en el cierre.
   */
  async freezePrices(closureId: string): Promise<void> {
    const closure = await this.prisma.dealClosure.findUniqueOrThrow({
      where: { id: closureId },
      include: {
        client: { select: { categoryId: true } },
        lines: {
          include: {
            karat: { select: { purity: true } },
          },
        },
      },
    });

    // Pre-calcular todos los precios (lecturas fuera de la transacción)
    const updates = await Promise.all(
      closure.lines.map(async (line) => {
        const pricePerGram = await this.getCurrentPrice(
          line.metalTypeId,
          line.karatId,
          closure.client.categoryId,
        );
        const lineAmount = this.calculateLineAmount(line.grams, pricePerGram);
        return {
          lineId: line.id,
          pricePerGram,
          lineAmount,
          puritySnapshot: line.karat.purity,
        };
      }),
    );

    const totalAmount = updates
      .reduce((sum, u) => sum.add(u.lineAmount), new Decimal(0))
      .toDecimalPlaces(2);

    // Escribir todo en una única transacción
    await this.prisma.$transaction([
      ...updates.map((u) =>
        this.prisma.dealClosureLine.update({
          where: { id: u.lineId },
          data: {
            pricePerGram: u.pricePerGram,
            lineAmount: u.lineAmount,
            puritySnapshot: u.puritySnapshot,
          },
        }),
      ),
      this.prisma.dealClosure.update({
        where: { id: closureId },
        data: {
          totalAmount,
          finalAmount: totalAmount.sub(closure.advanceAmount).toDecimalPlaces(2),
        },
      }),
    ]);
  }
}
