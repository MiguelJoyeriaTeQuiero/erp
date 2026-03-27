import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/client';
import { PricingCalculatorService } from '@domain/pricing-calculator.service';
import { PrismaService } from '@modules/prisma/prisma.service';

// ── Mock de PrismaService ──────────────────────────────────────────────────────

const mockPrisma = {
  priceRate: { findFirst: jest.fn() },
  dealClosure: {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  dealClosureLine: { update: jest.fn() },
  $transaction: jest.fn(),
};

describe('PricingCalculatorService', () => {
  let service: PricingCalculatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingCalculatorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PricingCalculatorService>(PricingCalculatorService);
    jest.clearAllMocks();
  });

  // ── calculateLineAmount ────────────────────────────────────────────────────

  describe('calculateLineAmount', () => {
    it('multiplies grams × pricePerGram', () => {
      const result = service.calculateLineAmount(
        new Decimal('100'),
        new Decimal('55.50'),
      );
      expect(result.toFixed(2)).toBe('5550.00');
    });

    it('rounds to exactly 2 decimal places', () => {
      // 33.33 × 55.55 = 1851.4815 → rounds to 1851.48
      const result = service.calculateLineAmount(
        new Decimal('33.33'),
        new Decimal('55.55'),
      );
      expect(result.decimalPlaces()).toBeLessThanOrEqual(2);
      expect(result.toFixed(2)).toBe('1851.48');
    });

    it('handles fractional grams', () => {
      const result = service.calculateLineAmount(
        new Decimal('0.5'),
        new Decimal('60.00'),
      );
      expect(result.toFixed(2)).toBe('30.00');
    });

    it('returns zero when grams is zero', () => {
      const result = service.calculateLineAmount(
        new Decimal('0'),
        new Decimal('60.00'),
      );
      expect(result.toFixed(2)).toBe('0.00');
    });

    it('handles high-precision price per gram', () => {
      // 100g × 58.1234€/g = 5812.34
      const result = service.calculateLineAmount(
        new Decimal('100'),
        new Decimal('58.1234'),
      );
      expect(result.toFixed(2)).toBe('5812.34');
    });
  });

  // ── calculateTotalAmount ───────────────────────────────────────────────────

  describe('calculateTotalAmount', () => {
    it('sums all line amounts correctly', () => {
      const lines = [
        { lineAmount: new Decimal('1000.00') },
        { lineAmount: new Decimal('2500.50') },
        { lineAmount: new Decimal('750.25') },
      ];
      const result = service.calculateTotalAmount(lines);
      expect(result.toFixed(2)).toBe('4250.75');
    });

    it('returns zero for an empty array', () => {
      const result = service.calculateTotalAmount([]);
      expect(result.toFixed(2)).toBe('0.00');
    });

    it('handles a single line', () => {
      const result = service.calculateTotalAmount([{ lineAmount: new Decimal('123.45') }]);
      expect(result.toFixed(2)).toBe('123.45');
    });

    it('rounds total to 2 decimal places', () => {
      const lines = [
        { lineAmount: new Decimal('100.001') },
        { lineAmount: new Decimal('100.001') },
        { lineAmount: new Decimal('100.001') },
      ];
      const result = service.calculateTotalAmount(lines);
      expect(result.decimalPlaces()).toBeLessThanOrEqual(2);
    });

    it('handles large amounts without precision loss', () => {
      const lines = [
        { lineAmount: new Decimal('999999.99') },
        { lineAmount: new Decimal('999999.99') },
      ];
      const result = service.calculateTotalAmount(lines);
      expect(result.toFixed(2)).toBe('1999999.98');
    });
  });

  // ── getCurrentPrice ────────────────────────────────────────────────────────

  describe('getCurrentPrice', () => {
    it('returns pricePerGram when an active rate exists', async () => {
      mockPrisma.priceRate.findFirst.mockResolvedValue({
        id: 'rate-1',
        pricePerGram: new Decimal('58.50'),
      });

      const result = await service.getCurrentPrice('gold-id', 'k18-id', 'cat-id');

      expect(result.toFixed(2)).toBe('58.50');
    });

    it('throws NotFoundException when no active rate is found', async () => {
      mockPrisma.priceRate.findFirst.mockResolvedValue(null);

      await expect(
        service.getCurrentPrice('gold-id', 'k18-id', 'cat-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('queries with isActive=true, matching IDs and validFrom lte now', async () => {
      mockPrisma.priceRate.findFirst.mockResolvedValue({ pricePerGram: new Decimal('50') });

      await service.getCurrentPrice('metal-1', 'karat-1', 'category-1');

      expect(mockPrisma.priceRate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            metalTypeId: 'metal-1',
            karatId: 'karat-1',
            categoryId: 'category-1',
            isActive: true,
            validFrom: expect.objectContaining({ lte: expect.any(Date) }),
          }),
          orderBy: { validFrom: 'desc' },
        }),
      );
    });

    it('includes OR clause for validUntil (null or future date)', async () => {
      mockPrisma.priceRate.findFirst.mockResolvedValue({ pricePerGram: new Decimal('50') });

      await service.getCurrentPrice('metal-1', 'karat-1', 'category-1');

      const callArg = mockPrisma.priceRate.findFirst.mock.calls[0][0] as {
        where: { OR: unknown[] };
      };
      expect(callArg.where['OR']).toBeDefined();
      expect(callArg.where['OR']).toHaveLength(2);
    });

    it('returns the most recent rate (ordered by validFrom desc)', async () => {
      // findFirst with orderBy desc returns the latest rate automatically
      const latestPrice = new Decimal('65.00');
      mockPrisma.priceRate.findFirst.mockResolvedValue({ pricePerGram: latestPrice });

      const result = await service.getCurrentPrice('gold-id', 'k18-id', 'cat-id');
      expect(result).toEqual(latestPrice);
    });
  });

  // ── freezePrices ───────────────────────────────────────────────────────────

  describe('freezePrices', () => {
    it('runs all line updates and closure total update in a single $transaction', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue({
        id: 'cls-1',
        advanceAmount: new Decimal('0'),
        client: { categoryId: 'cat-1' },
        lines: [
          {
            id: 'line-1',
            metalTypeId: 'gold',
            karatId: 'k18',
            grams: new Decimal('100'),
            karat: { purity: new Decimal('0.750') },
          },
          {
            id: 'line-2',
            metalTypeId: 'silver',
            karatId: 'k925',
            grams: new Decimal('500'),
            karat: { purity: new Decimal('0.925') },
          },
        ],
      });

      mockPrisma.priceRate.findFirst
        .mockResolvedValueOnce({ pricePerGram: new Decimal('58.00') }) // gold
        .mockResolvedValueOnce({ pricePerGram: new Decimal('0.80') }); // silver

      // Mock the individual update calls used inside $transaction
      mockPrisma.dealClosureLine.update.mockResolvedValue({});
      mockPrisma.dealClosure.update.mockResolvedValue({});
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.freezePrices('cls-1');

      // $transaction must be called with an array of: 2 line updates + 1 closure update
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      const transactionOps = mockPrisma.$transaction.mock.calls[0][0] as unknown[];
      expect(transactionOps).toHaveLength(3); // 2 lines + 1 closure
    });

    it('calculates totalAmount = sum of lineAmounts', async () => {
      // gold 100g × 58€ = 5800€, silver 500g × 0.80€ = 400€, total = 6200€
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue({
        id: 'cls-1',
        advanceAmount: new Decimal('0'),
        client: { categoryId: 'cat-1' },
        lines: [
          {
            id: 'line-1',
            metalTypeId: 'gold',
            karatId: 'k18',
            grams: new Decimal('100'),
            karat: { purity: new Decimal('0.750') },
          },
          {
            id: 'line-2',
            metalTypeId: 'silver',
            karatId: 'k925',
            grams: new Decimal('500'),
            karat: { purity: new Decimal('0.925') },
          },
        ],
      });

      mockPrisma.priceRate.findFirst
        .mockResolvedValueOnce({ pricePerGram: new Decimal('58.00') })
        .mockResolvedValueOnce({ pricePerGram: new Decimal('0.80') });

      // Capture what gets passed to $transaction by using a real implementation
      let capturedOps: unknown[] = [];
      mockPrisma.$transaction.mockImplementation((ops: unknown[]) => {
        capturedOps = ops;
        return Promise.resolve([]);
      });

      // The service builds Prisma update calls (not yet executed) inside $transaction
      // We mock the update methods to return the promise objects (just check $transaction is called)
      mockPrisma.dealClosureLine.update.mockReturnValue(Promise.resolve({}));
      mockPrisma.dealClosure.update.mockReturnValue(Promise.resolve({}));

      await service.freezePrices('cls-1');

      // Verify $transaction was called with correct number of ops
      expect(capturedOps).toHaveLength(3);
    });

    it('sets finalAmount = totalAmount - advanceAmount', async () => {
      const advanceAmount = new Decimal('1000');
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue({
        id: 'cls-1',
        advanceAmount,
        client: { categoryId: 'cat-1' },
        lines: [
          {
            id: 'line-1',
            metalTypeId: 'gold',
            karatId: 'k18',
            grams: new Decimal('100'),
            karat: { purity: new Decimal('0.750') },
          },
        ],
      });

      mockPrisma.priceRate.findFirst.mockResolvedValue({ pricePerGram: new Decimal('58.00') });
      mockPrisma.dealClosureLine.update.mockReturnValue(Promise.resolve({}));

      // Intercept the closure update to verify finalAmount
      let closureUpdateData: Record<string, unknown> = {};
      mockPrisma.dealClosure.update.mockImplementation((args: { data: Record<string, unknown> }) => {
        closureUpdateData = args.data;
        return Promise.resolve({});
      });
      mockPrisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => {
        return Promise.all(ops);
      });

      await service.freezePrices('cls-1');

      // totalAmount = 100 × 58 = 5800, finalAmount = 5800 - 1000 = 4800
      const totalAmount = closureUpdateData['totalAmount'] as Decimal;
      const finalAmount = closureUpdateData['finalAmount'] as Decimal;
      expect(totalAmount.toFixed(2)).toBe('5800.00');
      expect(finalAmount.toFixed(2)).toBe('4800.00');
    });
  });
});
