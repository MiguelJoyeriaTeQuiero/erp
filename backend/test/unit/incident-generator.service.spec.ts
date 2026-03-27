import { Test, TestingModule } from '@nestjs/testing';
import { IncidentStatus, IncidentType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { IncidentGeneratorService } from '@domain/incident-generator.service';
import { ConversionService } from '@domain/conversion.service';
import { PrismaService } from '@modules/prisma/prisma.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  collection: { findUniqueOrThrow: jest.fn() },
  dealClosureLine: { findMany: jest.fn() },
  collectionLine: { findMany: jest.fn() },
  conversion: { findFirst: jest.fn(), findMany: jest.fn() },
  validationSession: { findUniqueOrThrow: jest.fn() },
  dealClosure: { findUniqueOrThrow: jest.fn() },
  incident: { create: jest.fn(), count: jest.fn() },
};

const mockConversionService = {
  createAutoConversion: jest.fn(),
};

// ── Factories ─────────────────────────────────────────────────────────────────

const makeCollLine = (overrides: Partial<{
  id: string;
  metalTypeId: string;
  karatId: string;
  gramsDeclared: Decimal;
}> = {}) => ({
  id: 'coll-line-1',
  metalTypeId: 'gold',
  karatId: 'k18',
  gramsDeclared: new Decimal('100'),
  metalType: { name: 'Oro', code: 'AU' },
  karat: { label: '18k' },
  ...overrides,
});

const makeClosureLine = (overrides: Partial<{
  id: string;
  metalTypeId: string;
  karatId: string;
  grams: Decimal;
}> = {}) => ({
  id: 'closure-line-1',
  metalTypeId: 'gold',
  karatId: 'k18',
  grams: new Decimal('100'),
  metalType: { name: 'Oro', code: 'AU' },
  karat: { label: '18k' },
  ...overrides,
});

const makeCollection = (overrides: Partial<{
  isPartial: boolean;
  lines: ReturnType<typeof makeCollLine>[];
}> = {}) => ({
  id: 'coll-1',
  collectorId: 'user-1',
  isPartial: false,
  lines: [],
  ...overrides,
});

describe('IncidentGeneratorService', () => {
  let service: IncidentGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentGeneratorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConversionService, useValue: mockConversionService },
      ],
    }).compile();

    service = module.get<IncidentGeneratorService>(IncidentGeneratorService);
    jest.clearAllMocks();
  });

  // ── checkCollectionGaps ────────────────────────────────────────────────────

  describe('checkCollectionGaps', () => {
    it('creates INVALID_MATERIAL incident when collected metal is not in the closure', async () => {
      mockPrisma.collection.findUniqueOrThrow.mockResolvedValue(
        makeCollection({
          isPartial: true,
          lines: [makeCollLine({ metalTypeId: 'platinum', karatId: 'k950',
            metalType: { name: 'Platino', code: 'PT' }, karat: { label: '950' } } as Parameters<typeof makeCollLine>[0] & { metalType: { name: string; code: string }; karat: { label: string } })],
        }),
      );
      // Closure only has gold
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([
        makeClosureLine({ metalTypeId: 'gold' }),
      ]);
      mockPrisma.incident.create.mockResolvedValue({
        id: 'inc-1',
        type: IncidentType.INVALID_MATERIAL,
        status: IncidentStatus.OPEN,
      });

      const incidents = await service.checkCollectionGaps('cls-1', 'coll-1');

      expect(incidents).toHaveLength(1);
      expect(mockPrisma.incident.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: IncidentType.INVALID_MATERIAL,
            status: IncidentStatus.OPEN,
            closureId: 'cls-1',
            collectionId: 'coll-1',
          }),
        }),
      );
      expect(mockConversionService.createAutoConversion).not.toHaveBeenCalled();
    });

    it('creates auto-conversion when same metal but different karat', async () => {
      mockPrisma.collection.findUniqueOrThrow.mockResolvedValue(
        makeCollection({
          isPartial: true,
          lines: [makeCollLine({ karatId: 'k14',
            karat: { label: '14k' } } as Parameters<typeof makeCollLine>[0] & { karat: { label: string } })],
        }),
      );
      // Closure has gold 18k
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([
        makeClosureLine({ karatId: 'k18' }),
      ]);
      mockPrisma.conversion.findFirst.mockResolvedValue(null); // no duplicate
      mockConversionService.createAutoConversion.mockResolvedValue({ id: 'conv-1' });

      await service.checkCollectionGaps('cls-1', 'coll-1');

      expect(mockConversionService.createAutoConversion).toHaveBeenCalledWith(
        'coll-line-1',
        'closure-line-1',
      );
      expect(mockPrisma.incident.create).not.toHaveBeenCalled();
    });

    it('does NOT create a duplicate conversion when one already exists', async () => {
      mockPrisma.collection.findUniqueOrThrow.mockResolvedValue(
        makeCollection({
          isPartial: true,
          lines: [makeCollLine({ karatId: 'k14',
            karat: { label: '14k' } } as Parameters<typeof makeCollLine>[0] & { karat: { label: string } })],
        }),
      );
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([makeClosureLine()]);
      mockPrisma.conversion.findFirst.mockResolvedValue({ id: 'existing-conv' }); // already exists

      await service.checkCollectionGaps('cls-1', 'coll-1');

      expect(mockConversionService.createAutoConversion).not.toHaveBeenCalled();
    });

    it('does NOT create any incident when karat matches exactly', async () => {
      mockPrisma.collection.findUniqueOrThrow.mockResolvedValue(
        makeCollection({
          isPartial: true,
          lines: [makeCollLine({ karatId: 'k18' })], // exact match
        }),
      );
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([makeClosureLine()]);

      await service.checkCollectionGaps('cls-1', 'coll-1');

      expect(mockPrisma.incident.create).not.toHaveBeenCalled();
      expect(mockConversionService.createAutoConversion).not.toHaveBeenCalled();
    });

    it('creates PENDING_COLLECTION when complete collection is missing agreed material', async () => {
      mockPrisma.collection.findUniqueOrThrow.mockResolvedValue(
        makeCollection({
          isPartial: false, // complete collection
          lines: [makeCollLine({ gramsDeclared: new Decimal('80') })], // only 80g of 100g pactado
        }),
      );
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([
        makeClosureLine({ grams: new Decimal('100') }), // 100g pactado
      ]);

      // sumCollectedForClosureLine: 80g direct, 0 conversions
      mockPrisma.collectionLine.findMany.mockResolvedValue([
        { gramsDeclared: new Decimal('80') },
      ]);
      mockPrisma.conversion.findMany.mockResolvedValue([]);

      mockPrisma.incident.create.mockResolvedValue({
        id: 'inc-pending',
        type: IncidentType.PENDING_COLLECTION,
      });

      const incidents = await service.checkCollectionGaps('cls-1', 'coll-1');

      expect(mockPrisma.incident.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: IncidentType.PENDING_COLLECTION }),
        }),
      );
      expect(incidents.some((i) => i.type === IncidentType.PENDING_COLLECTION)).toBe(true);
    });

    it('does NOT create PENDING_COLLECTION on partial collection regardless of gap', async () => {
      mockPrisma.collection.findUniqueOrThrow.mockResolvedValue(
        makeCollection({
          isPartial: true, // partial: skip gap check entirely
          lines: [makeCollLine({ gramsDeclared: new Decimal('50') })],
        }),
      );
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([
        makeClosureLine({ grams: new Decimal('100') }),
      ]);

      await service.checkCollectionGaps('cls-1', 'coll-1');

      // No PENDING_COLLECTION should be created
      const pendingIncidentCalls = (mockPrisma.incident.create.mock.calls as { data: { type: string } }[][])
        .filter((call) => call[0]?.data.type === 'PENDING_COLLECTION');
      expect(pendingIncidentCalls).toHaveLength(0);
    });

    it('does NOT create PENDING_COLLECTION when gap is within 0.05g threshold', async () => {
      mockPrisma.collection.findUniqueOrThrow.mockResolvedValue(
        makeCollection({
          isPartial: false,
          lines: [makeCollLine({ gramsDeclared: new Decimal('99.97') })], // diff = 0.03g < 0.05
        }),
      );
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([
        makeClosureLine({ grams: new Decimal('100') }),
      ]);
      mockPrisma.collectionLine.findMany.mockResolvedValue([
        { gramsDeclared: new Decimal('99.97') },
      ]);
      mockPrisma.conversion.findMany.mockResolvedValue([]);

      await service.checkCollectionGaps('cls-1', 'coll-1');

      const pendingCalls = (mockPrisma.incident.create.mock.calls as { data: { type: string } }[][])
        .filter((c) => c[0]?.data.type === 'PENDING_COLLECTION');
      expect(pendingCalls).toHaveLength(0);
    });

    it('returns an empty array when collection has no lines and no gap', async () => {
      mockPrisma.collection.findUniqueOrThrow.mockResolvedValue(
        makeCollection({ isPartial: true, lines: [] }),
      );
      mockPrisma.dealClosureLine.findMany.mockResolvedValue([]);

      const incidents = await service.checkCollectionGaps('cls-1', 'coll-1');
      expect(incidents).toHaveLength(0);
    });
  });

  // ── checkValidationDiscrepancies ───────────────────────────────────────────

  describe('checkValidationDiscrepancies', () => {
    const baseSession = {
      id: 'val-1',
      closureId: 'cls-1',
      validatorId: 'user-1',
    };

    const makeValLine = (overrides: {
      purityValidated: Decimal;
      gramsValidated: Decimal;
      collectionLineId?: string | null;
      collectionLine?: { gramsDeclared: Decimal; puritySnapshot: Decimal; karat: { label: string } } | null;
      closureLineId?: string | null;
      closureLine?: { metalType: { name: string }; karat: { label: string }; karatId: string } | null;
      karatValidatedId?: string;
      karatValidated?: { label: string };
    }) => ({
      id: 'val-line-1',
      karatValidatedId: 'k18',
      karatValidated: { label: '18k' },
      collectionLineId: null,
      collectionLine: null,
      closureLineId: 'closure-line-1',
      closureLine: {
        metalType: { name: 'Oro' },
        karat: { label: '18k' },
        karatId: 'k18',
      },
      observation: null,
      ...overrides,
    });

    it('creates SCRAP incident when purity is below 0.200 threshold', async () => {
      mockPrisma.validationSession.findUniqueOrThrow.mockResolvedValue({
        ...baseSession,
        lines: [
          makeValLine({
            purityValidated: new Decimal('0.150'), // below 0.200 threshold
            gramsValidated: new Decimal('100'),
          }),
        ],
      });
      mockPrisma.incident.create.mockResolvedValue({
        id: 'inc-scrap',
        type: IncidentType.SCRAP,
      });

      const incidents = await service.checkValidationDiscrepancies('val-1');

      expect(incidents).toHaveLength(1);
      expect(mockPrisma.incident.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: IncidentType.SCRAP }),
        }),
      );
    });

    it('creates SCRAP at exact threshold boundary (0.199999)', async () => {
      mockPrisma.validationSession.findUniqueOrThrow.mockResolvedValue({
        ...baseSession,
        lines: [
          makeValLine({
            purityValidated: new Decimal('0.1999'),
            gramsValidated: new Decimal('100'),
          }),
        ],
      });
      mockPrisma.incident.create.mockResolvedValue({ id: 'inc', type: IncidentType.SCRAP });

      await service.checkValidationDiscrepancies('val-1');
      expect(mockPrisma.incident.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: IncidentType.SCRAP }) }),
      );
    });

    it('does NOT create SCRAP when purity is exactly 0.200 (at threshold)', async () => {
      mockPrisma.validationSession.findUniqueOrThrow.mockResolvedValue({
        ...baseSession,
        lines: [
          makeValLine({
            purityValidated: new Decimal('0.200'), // at threshold, not below
            gramsValidated: new Decimal('100'),
            collectionLineId: null,
            collectionLine: null,
            closureLineId: 'line-1',
            closureLine: { metalType: { name: 'Oro' }, karat: { label: '18k' }, karatId: 'k18' },
            karatValidatedId: 'k18',
          }),
        ],
      });

      await service.checkValidationDiscrepancies('val-1');
      expect(mockPrisma.incident.create).not.toHaveBeenCalled();
    });

    it('skips discrepancy check for SCRAP lines (avoids double incident)', async () => {
      mockPrisma.validationSession.findUniqueOrThrow.mockResolvedValue({
        ...baseSession,
        lines: [
          makeValLine({
            purityValidated: new Decimal('0.100'), // scrap
            gramsValidated: new Decimal('80'), // also different from declared 100
            collectionLineId: 'cl1',
            collectionLine: {
              gramsDeclared: new Decimal('100'),
              puritySnapshot: new Decimal('0.750'),
              karat: { label: '18k' },
            },
          }),
        ],
      });
      mockPrisma.incident.create.mockResolvedValue({ id: 'inc', type: IncidentType.SCRAP });

      const incidents = await service.checkValidationDiscrepancies('val-1');

      // Only SCRAP, not an additional VALIDATION_DISCREPANCY
      expect(incidents).toHaveLength(1);
      expect(incidents[0]!.type).toBe(IncidentType.SCRAP);
    });

    it('creates VALIDATION_DISCREPANCY for gram difference above 0.05g threshold', async () => {
      mockPrisma.validationSession.findUniqueOrThrow.mockResolvedValue({
        ...baseSession,
        lines: [
          makeValLine({
            purityValidated: new Decimal('0.750'),
            gramsValidated: new Decimal('90'), // diff = 10g > 0.05g
            collectionLineId: 'cl1',
            collectionLine: {
              gramsDeclared: new Decimal('100'),
              puritySnapshot: new Decimal('0.750'),
              karat: { label: '18k' },
            },
          }),
        ],
      });
      mockPrisma.incident.create.mockResolvedValue({
        id: 'inc-disc',
        type: IncidentType.VALIDATION_DISCREPANCY,
      });

      const incidents = await service.checkValidationDiscrepancies('val-1');

      expect(incidents.some((i) => i.type === IncidentType.VALIDATION_DISCREPANCY)).toBe(true);
    });

    it('does NOT create discrepancy when gram difference is within 0.05g threshold', async () => {
      mockPrisma.validationSession.findUniqueOrThrow.mockResolvedValue({
        ...baseSession,
        lines: [
          makeValLine({
            purityValidated: new Decimal('0.750'),
            gramsValidated: new Decimal('100.03'), // diff = 0.03g < 0.05g
            collectionLineId: 'cl1',
            collectionLine: {
              gramsDeclared: new Decimal('100'),
              puritySnapshot: new Decimal('0.750'),
              karat: { label: '18k' },
            },
          }),
        ],
      });

      await service.checkValidationDiscrepancies('val-1');
      expect(mockPrisma.incident.create).not.toHaveBeenCalled();
    });

    it('creates VALIDATION_DISCREPANCY for karat mismatch with closure line', async () => {
      mockPrisma.validationSession.findUniqueOrThrow.mockResolvedValue({
        ...baseSession,
        lines: [
          makeValLine({
            purityValidated: new Decimal('0.583'), // 14k purity (fine, not scrap)
            gramsValidated: new Decimal('100'),
            karatValidatedId: 'k14', // validated karat
            karatValidated: { label: '14k' },
            closureLine: {
              metalType: { name: 'Oro' },
              karat: { label: '18k' },
              karatId: 'k18', // agreed karat — different from validated
            },
          }),
        ],
      });
      mockPrisma.incident.create.mockResolvedValue({
        id: 'inc-karat',
        type: IncidentType.VALIDATION_DISCREPANCY,
      });

      await service.checkValidationDiscrepancies('val-1');

      expect(mockPrisma.incident.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: IncidentType.VALIDATION_DISCREPANCY }),
        }),
      );
    });

    it('does NOT create discrepancy when karat matches closure line', async () => {
      mockPrisma.validationSession.findUniqueOrThrow.mockResolvedValue({
        ...baseSession,
        lines: [
          makeValLine({
            purityValidated: new Decimal('0.750'),
            gramsValidated: new Decimal('100'),
            karatValidatedId: 'k18',
            closureLine: {
              metalType: { name: 'Oro' },
              karat: { label: '18k' },
              karatId: 'k18', // same
            },
          }),
        ],
      });

      await service.checkValidationDiscrepancies('val-1');
      expect(mockPrisma.incident.create).not.toHaveBeenCalled();
    });

    it('returns empty array when no discrepancies found', async () => {
      mockPrisma.validationSession.findUniqueOrThrow.mockResolvedValue({
        ...baseSession,
        lines: [],
      });

      const incidents = await service.checkValidationDiscrepancies('val-1');
      expect(incidents).toHaveLength(0);
    });
  });

  // ── createAdvanceRefundIncident ────────────────────────────────────────────

  describe('createAdvanceRefundIncident', () => {
    it('creates ADVANCE_REFUND incident with correct details', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue({
        id: 'cls-1',
        code: 'CIE25-001',
        advance: { amount: new Decimal('3000'), paymentMethod: 'TRANSFER' },
        client: { commercialName: 'Joyería Pérez', taxId: 'B12345678' },
      });
      mockPrisma.incident.create.mockResolvedValue({
        id: 'inc-refund',
        type: IncidentType.ADVANCE_REFUND,
        status: IncidentStatus.OPEN,
      });

      const result = await service.createAdvanceRefundIncident('cls-1', 'admin-1');

      expect(mockPrisma.incident.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: IncidentType.ADVANCE_REFUND,
            status: IncidentStatus.OPEN,
            closureId: 'cls-1',
            createdById: 'admin-1',
          }),
        }),
      );
      expect(result.type).toBe(IncidentType.ADVANCE_REFUND);
    });

    it('includes amount and payment method in the reason text', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue({
        id: 'cls-1',
        code: 'CIE25-001',
        advance: { amount: new Decimal('1500.00'), paymentMethod: 'CASH' },
        client: { commercialName: 'Joyería Test', taxId: 'B99999999' },
      });
      mockPrisma.incident.create.mockResolvedValue({ id: 'inc', type: IncidentType.ADVANCE_REFUND });

      await service.createAdvanceRefundIncident('cls-1', 'user-1');

      const callArg = mockPrisma.incident.create.mock.calls[0][0] as { data: { reason: string } };
      expect(callArg.data.reason).toContain('1500.00');
      expect(callArg.data.reason).toContain('CASH');
    });

    it('throws when closure has no advance', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue({
        id: 'cls-1',
        code: 'CIE25-001',
        advance: null,
        client: { commercialName: 'Test', taxId: 'B00000000' },
      });

      await expect(
        service.createAdvanceRefundIncident('cls-1', 'admin-1'),
      ).rejects.toThrow();

      expect(mockPrisma.incident.create).not.toHaveBeenCalled();
    });
  });

  // ── areAllResolved ─────────────────────────────────────────────────────────

  describe('areAllResolved', () => {
    it('returns true when there are no open or in-review incidents', async () => {
      mockPrisma.incident.count.mockResolvedValue(0);

      const result = await service.areAllResolved('cls-1');

      expect(result).toBe(true);
      expect(mockPrisma.incident.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            closureId: 'cls-1',
            status: { in: [IncidentStatus.OPEN, IncidentStatus.IN_REVIEW] },
          }),
        }),
      );
    });

    it('returns false when there are open incidents', async () => {
      mockPrisma.incident.count.mockResolvedValue(2);

      expect(await service.areAllResolved('cls-1')).toBe(false);
    });

    it('returns false when there are IN_REVIEW incidents', async () => {
      mockPrisma.incident.count.mockResolvedValue(1);

      expect(await service.areAllResolved('cls-1')).toBe(false);
    });
  });
});
