import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ClosureStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { StateMachineService } from '@domain/state-machine.service';
import { CreateAdvanceDto } from './dto/create-advance.dto';

/** Porcentaje máximo del total del cierre que puede adelantarse */
const MAX_ADVANCE_RATIO = new Decimal('0.75');

@Injectable()
export class AdvancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: StateMachineService,
  ) {}

  async findByClosure(closureId: string) {
    await this.assertClosureExists(closureId);
    return this.prisma.advancePayment.findUnique({
      where: { closureId },
      include: {
        authorizedBy: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Registra un adelanto sobre un cierre CONFIRMADO o WITH_ADVANCE (si se quiere actualizar).
   * Solo se permite un adelanto por cierre.
   * El importe máximo es el 75% del totalAmount del cierre.
   * Snapshot: precio promedio por gramo y gramos totales al momento del adelanto.
   */
  async create(closureId: string, dto: CreateAdvanceDto, authorizedById: string) {
    const closure = await this.prisma.dealClosure.findFirst({
      where: { id: closureId, deletedAt: null },
      include: {
        lines: { select: { grams: true, pricePerGram: true, lineAmount: true } },
        advance: { select: { id: true, cancelledAt: true } },
      },
    });

    if (!closure) throw new NotFoundException(`Cierre con id "${closureId}" no encontrado`);

    // Solo se puede adelantar en CONFIRMED o WITH_ADVANCE (pero WITH_ADVANCE ya tiene uno)
    if (
      closure.status !== ClosureStatus.CONFIRMED &&
      closure.status !== ClosureStatus.WITH_ADVANCE
    ) {
      throw new BadRequestException(
        `Solo se puede registrar un adelanto en cierres CONFIRMADOS (estado actual: ${closure.status})`,
      );
    }

    // Verificar que no hay ya un adelanto activo
    if (closure.advance && !closure.advance.cancelledAt) {
      throw new ConflictException(
        'Este cierre ya tiene un adelanto registrado. Solo se permite un adelanto por cierre.',
      );
    }

    const amount = new Decimal(dto.amount);

    // Validar que el importe es positivo
    if (amount.lte(0)) {
      throw new BadRequestException('El importe del adelanto debe ser mayor que 0');
    }

    // Validar límite del 75%
    const maxAllowed = closure.totalAmount.mul(MAX_ADVANCE_RATIO).toDecimalPlaces(2);
    if (amount.gt(maxAllowed)) {
      throw new BadRequestException(
        `El adelanto supera el máximo permitido (75% del total). ` +
          `Total: ${closure.totalAmount.toFixed(2)} € — ` +
          `Máximo adelanto: ${maxAllowed.toFixed(2)} € — ` +
          `Solicitado: ${amount.toFixed(2)} €`,
      );
    }

    // Calcular snapshots
    const totalGrams = closure.lines.reduce(
      (sum, l) => sum.add(l.grams),
      new Decimal(0),
    );
    // Precio promedio ponderado por gramo
    const pricePerGramSnapshot = totalGrams.isZero()
      ? new Decimal(0)
      : closure.totalAmount.div(totalGrams).toDecimalPlaces(4);

    const advanceAmount = amount;
    const finalAmount = closure.totalAmount.sub(advanceAmount).toDecimalPlaces(2);

    // Crear adelanto + actualizar cierre en transacción
    const [advance] = await this.prisma.$transaction([
      this.prisma.advancePayment.create({
        data: {
          closureId,
          amount: advanceAmount,
          paymentMethod: dto.paymentMethod,
          pricePerGramSnapshot,
          gramsSnapshot: totalGrams.toDecimalPlaces(2),
          authorizedById,
          observations: dto.observations,
        },
        include: {
          authorizedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.dealClosure.update({
        where: { id: closureId },
        data: {
          advanceAmount,
          finalAmount,
          status: ClosureStatus.WITH_ADVANCE,
          version: { increment: 1 },
        },
      }),
    ]);

    return advance;
  }
  // ── Helpers ────────────────────────────────────────────────────────────────

  private async assertClosureExists(closureId: string) {
    const closure = await this.prisma.dealClosure.findFirst({
      where: { id: closureId, deletedAt: null },
    });
    if (!closure) throw new NotFoundException(`Cierre con id "${closureId}" no encontrado`);
    return closure;
  }
}
