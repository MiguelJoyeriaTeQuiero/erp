import { Test, TestingModule } from '@nestjs/testing';
import { ClosureStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { ReconciliationService } from '@domain/reconciliation.service';
import { PrismaService } from '@modules/prisma/prisma.service';

// ── Mock de PrismaService ──────────────────────────────────────────────────────

const mockPrisma = {
  dealClosure: { findUniqueOrThrow: jest.fn() },
  dealClosureLine: { findMany: jest.fn() },
  collectionLine: { findMany: jest.fn() },
  conversion: { findMany: jest.fn() },
  validationLine: { findMany: jest.fn() },
  incident: { findMany: jest.fn(), count: jest.fn() },
};

// ── Factories de datos de prueba ───────────────────────────────────────────────

const makeClosureLine = (overrides: Partial<{
  id: string;
  metalTypeId: string;
  karatId: string;
  grams: Decimal;
}> = {}) => ({
  id: 'line-1',
  metalTypeId: 'gold',
  karatId: 'k18',
  grams: new Decimal('100'),
  pricePerGram: new Decimal('58.00'),
  lineAmount: new Decimal('5800.00'),
  puritySnapshot: new Decimal('0.750'),
  metalType: { name: 'Oro', code: 'AU' },
  karat: { label: '18k', purity: new Decimal('0.750') },
  ...overrides,
});

describe('ReconciliationService', () => {
  let service: ReconciliationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReconciliationService>(ReconciliationService);
    jest.clearAllMocks();
  });

  // ── isFullyCollected ───────────────────────────────────────────────────────

  describe('isFullyCollected', () => {
    it('returns true when direct collection covers all agreed grams', async () => {
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([
        makeClosureLine({ grams: new Decimal('100') }),
      ]);
      // 80g + 25g = 105g ≥ 100g pactado
      mockPrisma.collectionLine.findMany.mockResolvedValue([
        { gramsDeclared: new Decimal('80') },
        { gramsDeclared: new Decimal('25') },
      ]);
      mockPrisma.conversion.findMany.mockResolvedValue([]);

      expect(await service.isFullyCollected('cls-1')).toBe(true);
    });

    it('returns false when direct collection is below agreed grams', async () => {
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([
        makeClosureLine({ grams: new Decimal('100') }),
      ]);
      mockPrisma.collectionLine.findMany.mockResolvedValue([
        { gramsDeclared: new Decimal('50') },
      ]);
      mockPrisma.conversion.findMany.mockResolvedValue([]);

      expect(await service.isFullyCollected('cls-1')).toBe(false);
    });

    it('counts APPLIED conversions toward total collected', async () => {
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([
        makeClosureLine({ karatId: 'k24', grams: new Decimal('100') }),
      ]);
      // Direct collection: 60g of 18k (different karat, won't match direct query)
      mockPrisma.collectionLine.findMany.mockResolvedValue([]);
      // Applied conversion provides 75.0075 equivalent grams
      mockPrisma.conversion.findMany.mockResolvedValue([
        {
          status: 'APPLIED',
          equivalentGrams: new Decimal('75.0075'),
          sourceKarat: { label: '18k' },
          sourceGrams: new Decimal('100'),
        },
        {
          status: 'APPLIED',
          equivalentGrams: new Decimal('30'),
          sourceKarat: { label: '14k' },
          sourceGrams: new Decimal('50'),
        },
      ]);

      expect(await service.isFullyCollected('cls-1')).toBe(true);
    });

    it('does NOT count PENDING conversions toward total collected', async () => {
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([
        makeClosureLine({ grams: new Decimal('100') }),
      ]);
      mockPrisma.collectionLine.findMany.mockResolvedValue([
        { gramsDeclared: new Decimal('30') },
      ]);
      // Pending conversion of 80g — should NOT count
      mockPrisma.conversion.findMany.mockResolvedValue([
        {
          status: 'PENDING',
          equivalentGrams: new Decimal('80'),
          sourceKarat: { label: '18k' },
          sourceGrams: new Decimal('106'),
        },
      ]);

      expect(await service.isFullyCollected('cls-1')).toBe(false);
    });

    it('does NOT count REJECTED conversions toward total collected', async () => {
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([
        makeClosureLine({ grams: new Decimal('100') }),
      ]);
      mockPrisma.collectionLine.findMany.mockResolvedValue([]);
      mockPrisma.conversion.findMany.mockResolvedValue([
        {
          status: 'REJECTED',
          equivalentGrams: new Decimal('100'),
          sourceKarat: { label: '18k' },
          sourceGrams: new Decimal('133'),
        },
      ]);

      expect(await service.isFullyCollected('cls-1')).toBe(false);
    });

    it('returns true when there are no closure lines', async () => {
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([]);

      expect(await service.isFullyCollected('cls-1')).toBe(true);
    });

    it('checks all lines, returns false if any line is uncollected', async () => {
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([
        makeClosureLine({ id: 'line-1', metalTypeId: 'gold',  karatId: 'k18', grams: new Decimal('100') }),
        makeClosureLine({ id: 'line-2', metalTypeId: 'silver', karatId: 'k925', grams: new Decimal('500') }),
      ]);

      // First call (gold line): fully collected
      // Second call (silver line): not collected
      mockPrisma.collectionLine.findMany
        .mockResolvedValueOnce([{ gramsDeclared: new Decimal('100') }])
        .mockResolvedValueOnce([{ gramsDeclared: new Decimal('200') }]); // only 200 of 500

      mockPrisma.conversion.findMany.mockResolvedValue([]);

      expect(await service.isFullyCollected('cls-1')).toBe(false);
    });
  });

  // ── isFullyValidated ───────────────────────────────────────────────────────

  describe('isFullyValidated', () => {
    it('returns true when all lines have sufficient validated grams', async () => {
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([
        makeClosureLine({ id: 'l1', grams: new Decimal('100') }),
        makeClosureLine({ id: 'l2', metalTypeId: 'silver', grams: new Decimal('50') }),
      ]);
      mockPrisma.validationLine.findMany
        .mockResolvedValueOnce([{ gramsValidated: new Decimal('102') }]) // l1: 102 ≥ 100 ✓
        .mockResolvedValueOnce([{ gramsValidated: new Decimal('50') }]);  // l2: 50 ≥ 50 ✓

      expect(await service.isFullyValidated('cls-1')).toBe(true);
    });

    it('returns false when validated grams fall short for any line', async () => {
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([
        makeClosureLine({ grams: new Decimal('100') }),
      ]);
      mockPrisma.validationLine.findMany.mockResolvedValue([
        { gramsValidated: new Decimal('90') }, // 90 < 100 ✗
      ]);

      expect(await service.isFullyValidated('cls-1')).toBe(false);
    });

    it('returns false when no validation lines exist for a closure line', async () => {
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([
        makeClosureLine({ grams: new Decimal('100') }),
      ]);
      mockPrisma.validationLine.findMany.mockResolvedValue([]); // no validated lines

      expect(await service.isFullyValidated('cls-1')).toBe(false);
    });

    it('only counts validation lines from APPROVED sessions', async () => {
      // The query filters by session.status = APPROVED via where clause
      // A rejected session's lines are excluded by the mock
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([
        makeClosureLine({ grams: new Decimal('100') }),
      ]);
      // Returns only lines from APPROVED sessions (Prisma handles the filter)
      mockPrisma.validationLine.findMany.mockResolvedValue([
        { gramsValidated: new Decimal('100') },
      ]);

      expect(await service.isFullyValidated('cls-1')).toBe(true);

      // Verify the query includes the APPROVED session filter
      expect(mockPrisma.validationLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            session: expect.objectContaining({ status: 'APPROVED' }),
          }),
        }),
      );
    });
  });

  // ── canComplete ────────────────────────────────────────────────────────────

  describe('canComplete', () => {
    it('returns false when closure status is not VALIDATED', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue({
        status: ClosureStatus.IN_VALIDATION,
      });

      expect(await service.canComplete('cls-1')).toBe(false);
      // Should short-circuit: no incident or validation queries
      expect(mockPrisma.incident.count).not.toHaveBeenCalled();
    });

    it('returns false when there are open incidents', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue({
        status: ClosureStatus.VALIDATED,
      });
      mockPrisma.incident.count.mockResolvedValue(1);

      expect(await service.canComplete('cls-1')).toBe(false);
    });

    it('returns false when VALIDATED but not fully validated', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue({
        status: ClosureStatus.VALIDATED,
      });
      mockPrisma.incident.count.mockResolvedValue(0);
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([
        makeClosureLine({ grams: new Decimal('100') }),
      ]);
      mockPrisma.validationLine.findMany.mockResolvedValue([
        { gramsValidated: new Decimal('80') }, // insufficient
      ]);

      expect(await service.canComplete('cls-1')).toBe(false);
    });

    it('returns true when VALIDATED, no open incidents, fully validated', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue({
        status: ClosureStatus.VALIDATED,
      });
      mockPrisma.incident.count.mockResolvedValue(0);
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([
        makeClosureLine({ grams: new Decimal('100') }),
      ]);
      mockPrisma.validationLine.findMany.mockResolvedValue([
        { gramsValidated: new Decimal('100') },
      ]);

      expect(await service.canComplete('cls-1')).toBe(true);
    });
  });

  // ── getReconciliationSummary ───────────────────────────────────────────────

  describe('getReconciliationSummary', () => {
    it('returns summary with correct structure and totals', async () => {
      const closure = {
        id: 'cls-1',
        status: ClosureStatus.PENDING_VALIDATION,
        totalAmount: new Decimal('5800'),
        lines: [makeClosureLine()],
      };

      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue(closure);

      // aggregateCollectedForLine: direct 100g, no conversions
      mockPrisma.collectionLine.findMany.mockResolvedValue([
        { gramsDeclared: new Decimal('100') },
      ]);
      mockPrisma.conversion.findMany.mockResolvedValue([]);

      // aggregateValidatedForLine: 100g validated
      mockPrisma.validationLine.findMany.mockResolvedValue([
        { gramsValidated: new Decimal('100') },
      ]);

      // open incidents: none
      mockPrisma.incident.findMany.mockResolvedValue([]);

      // isFullyValidated + canComplete sub-calls
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([
        makeClosureLine({ grams: new Decimal('100') }),
      ]);
      mockPrisma.incident.count.mockResolvedValue(0);

      const summary = await service.getReconciliationSummary('cls-1');

      expect(summary.closureId).toBe('cls-1');
      expect(summary.status).toBe(ClosureStatus.PENDING_VALIDATION);
      expect(summary.lines).toHaveLength(1);
      expect(summary.openIncidents).toHaveLength(0);

      const line = summary.lines[0]!;
      expect(line.agreedGrams.toFixed(2)).toBe('100.00');
      expect(line.directCollectedGrams.toFixed(2)).toBe('100.00');
      expect(line.convertedEquivalentGrams.toFixed(2)).toBe('0.00');
      expect(line.totalCollectedGrams.toFixed(2)).toBe('100.00');
      expect(line.validatedGrams.toFixed(2)).toBe('100.00');
      expect(line.pendingGrams.toDecimalPlaces(2).toFixed(2)).toBe('0.00');
      expect(line.pendingConversions).toHaveLength(0);
      expect(summary.isFullyCollected).toBe(true);
    });

    it('includes pending conversions in the line reconciliation', async () => {
      const closure = {
        id: 'cls-1',
        status: ClosureStatus.PENDING_COLLECTION,
        totalAmount: new Decimal('5800'),
        lines: [makeClosureLine({ karatId: 'k24', grams: new Decimal('100') })],
      };

      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue(closure);
      mockPrisma.collectionLine.findMany.mockResolvedValue([]);
      mockPrisma.conversion.findMany.mockResolvedValue([
        {
          id: 'conv-pending',
          status: 'PENDING',
          equivalentGrams: new Decimal('75'),
          sourceGrams: new Decimal('100'),
          sourceKarat: { label: '18k' },
        },
      ]);
      mockPrisma.validationLine.findMany.mockResolvedValue([]);
      mockPrisma.incident.findMany.mockResolvedValue([]);
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([
        makeClosureLine({ grams: new Decimal('100') }),
      ]);
      mockPrisma.incident.count.mockResolvedValue(0);

      const summary = await service.getReconciliationSummary('cls-1');
      const line = summary.lines[0]!;

      expect(line.pendingConversions).toHaveLength(1);
      expect(line.pendingConversions[0]!.id).toBe('conv-pending');
      expect(line.pendingConversions[0]!.sourceKaratLabel).toBe('18k');
    });

    it('reports open incidents in the summary', async () => {
      const closure = {
        id: 'cls-1',
        status: ClosureStatus.WITH_INCIDENTS,
        totalAmount: new Decimal('5800'),
        lines: [makeClosureLine()],
      };

      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue(closure);
      mockPrisma.collectionLine.findMany.mockResolvedValue([]);
      mockPrisma.conversion.findMany.mockResolvedValue([]);
      mockPrisma.validationLine.findMany.mockResolvedValue([]);
      mockPrisma.incident.findMany.mockResolvedValue([
        { id: 'inc-1', type: 'INVALID_MATERIAL', status: 'OPEN', reason: 'Material no pactado' },
      ]);
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([makeClosureLine()]);
      mockPrisma.incident.count.mockResolvedValue(1);

      const summary = await service.getReconciliationSummary('cls-1');

      expect(summary.openIncidents).toHaveLength(1);
      expect(summary.openIncidents[0]!.type).toBe('INVALID_MATERIAL');
      expect(summary.canComplete).toBe(false);
    });

    it('calculates totalCollectedGrams and totalValidatedGrams across all lines', async () => {
      const closure = {
        id: 'cls-1',
        status: ClosureStatus.VALIDATED,
        totalAmount: new Decimal('10000'),
        lines: [
          makeClosureLine({ id: 'l1', metalTypeId: 'gold',  grams: new Decimal('100') }),
          makeClosureLine({ id: 'l2', metalTypeId: 'silver', grams: new Decimal('500') }),
        ],
      };

      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue(closure);
      mockPrisma.collectionLine.findMany
        .mockResolvedValueOnce([{ gramsDeclared: new Decimal('100') }]) // l1 direct
        .mockResolvedValueOnce([{ gramsDeclared: new Decimal('500') }]); // l2 direct
      mockPrisma.conversion.findMany.mockResolvedValue([]);
      mockPrisma.validationLine.findMany
        .mockResolvedValueOnce([{ gramsValidated: new Decimal('100') }]) // l1
        .mockResolvedValueOnce([{ gramsValidated: new Decimal('500') }]); // l2
      mockPrisma.incident.findMany.mockResolvedValue([]);
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([
        makeClosureLine({ id: 'l1', grams: new Decimal('100') }),
        makeClosureLine({ id: 'l2', grams: new Decimal('500') }),
      ]);
      mockPrisma.incident.count.mockResolvedValue(0);

      const summary = await service.getReconciliationSummary('cls-1');

      expect(summary.totalCollectedGrams.toFixed(2)).toBe('600.00');
      expect(summary.totalValidatedGrams.toFixed(2)).toBe('600.00');
    });
  });
});
