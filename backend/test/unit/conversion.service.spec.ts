import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConversionStatus, ConversionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { ConversionService } from '@domain/conversion.service';
import { PrismaService } from '@modules/prisma/prisma.service';

// ── Mock de PrismaService ──────────────────────────────────────────────────────

const mockPrisma = {
  collectionLine: { findUniqueOrThrow: jest.fn() },
  dealClosureLine: { findUniqueOrThrow: jest.fn() },
  conversion: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe('ConversionService', () => {
  let service: ConversionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ConversionService>(ConversionService);
    jest.clearAllMocks();
  });

  // ── calculateEquivalent ────────────────────────────────────────────────────

  describe('calculateEquivalent', () => {
    it('converts 18k → 24k correctly', () => {
      // 100g × (0.750 / 0.9999) ≈ 75.0075
      const result = service.calculateEquivalent(
        new Decimal('100'),
        new Decimal('0.750'),
        new Decimal('0.9999'),
      );
      expect(result.toFixed(4)).toBe('75.0075');
    });

    it('is identity when purities are equal', () => {
      const result = service.calculateEquivalent(
        new Decimal('50'),
        new Decimal('0.750'),
        new Decimal('0.750'),
      );
      expect(result.toFixed(4)).toBe('50.0000');
    });

    it('converts lower karat → higher karat (result < source)', () => {
      // 9k (0.375) → 18k (0.750): 100 × 0.375 / 0.750 = 50g
      const result = service.calculateEquivalent(
        new Decimal('100'),
        new Decimal('0.375'),
        new Decimal('0.750'),
      );
      expect(result.toFixed(4)).toBe('50.0000');
    });

    it('converts higher karat → lower karat (result > source)', () => {
      // 24k (0.9999) → 9k (0.375): 100 × 0.9999 / 0.375 ≈ 266.64
      const result = service.calculateEquivalent(
        new Decimal('100'),
        new Decimal('0.9999'),
        new Decimal('0.375'),
      );
      expect(result.toDecimalPlaces(2).toNumber()).toBeCloseTo(266.64, 1);
    });

    it('rounds result to 4 decimal places', () => {
      // 33.33 × 0.750 / 0.9999 has many decimal places
      const result = service.calculateEquivalent(
        new Decimal('33.33'),
        new Decimal('0.750'),
        new Decimal('0.9999'),
      );
      expect(result.decimalPlaces()).toBeLessThanOrEqual(4);
    });

    it('handles fractional gram amounts', () => {
      const result = service.calculateEquivalent(
        new Decimal('0.5'),
        new Decimal('0.750'),
        new Decimal('0.750'),
      );
      expect(result.toFixed(4)).toBe('0.5000');
    });

    it('throws BadRequestException when targetPurity is zero', () => {
      expect(() =>
        service.calculateEquivalent(
          new Decimal('100'),
          new Decimal('0.750'),
          new Decimal('0'),
        ),
      ).toThrow(BadRequestException);
    });
  });

  // ── createAutoConversion ───────────────────────────────────────────────────

  describe('createAutoConversion', () => {
    const collLine = {
      id: 'coll-line-1',
      metalTypeId: 'gold',
      karatId: 'k18',
      gramsDeclared: new Decimal('100'),
      puritySnapshot: new Decimal('0.750'),
      karat: { label: '18k' },
    };
    const closureLine = {
      id: 'closure-line-1',
      metalTypeId: 'gold',
      karatId: 'k24',
      puritySnapshot: new Decimal('0.9999'),
      karat: { label: '24k' },
    };

    it('creates an AUTOMATIC PENDING conversion for same metal, different karat', async () => {
      mockPrisma.collectionLine.findUniqueOrThrow.mockResolvedValue(collLine);
      mockPrisma.dealClosureLine.findUniqueOrThrow.mockResolvedValue(closureLine);
      mockPrisma.conversion.create.mockResolvedValue({ id: 'conv-1' });

      const result = await service.createAutoConversion('coll-line-1', 'closure-line-1');

      expect(mockPrisma.conversion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversionType: ConversionType.AUTOMATIC,
            status: ConversionStatus.PENDING,
            sourceGrams: collLine.gramsDeclared,
            sourceKaratId: 'k18',
            targetKaratId: 'k24',
          }),
        }),
      );
      expect(result).toEqual({ id: 'conv-1' });
    });

    it('stores the computed equivalentGrams in the conversion record', async () => {
      mockPrisma.collectionLine.findUniqueOrThrow.mockResolvedValue(collLine);
      mockPrisma.dealClosureLine.findUniqueOrThrow.mockResolvedValue(closureLine);
      mockPrisma.conversion.create.mockResolvedValue({ id: 'conv-1' });

      await service.createAutoConversion('coll-line-1', 'closure-line-1');

      const callArg = mockPrisma.conversion.create.mock.calls[0][0] as { data: { equivalentGrams: Decimal } };
      const equivalentGrams = callArg.data.equivalentGrams;
      // 100 × 0.750 / 0.9999 ≈ 75.0075
      expect(equivalentGrams.toFixed(4)).toBe('75.0075');
    });

    it('throws BadRequestException when metals are different', async () => {
      mockPrisma.collectionLine.findUniqueOrThrow.mockResolvedValue({
        ...collLine,
        metalTypeId: 'silver',
      });
      mockPrisma.dealClosureLine.findUniqueOrThrow.mockResolvedValue(closureLine);

      await expect(
        service.createAutoConversion('coll-line-1', 'closure-line-1'),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.conversion.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when karats are the same', async () => {
      mockPrisma.collectionLine.findUniqueOrThrow.mockResolvedValue({
        ...collLine,
        karatId: 'k24', // same as closure line
      });
      mockPrisma.dealClosureLine.findUniqueOrThrow.mockResolvedValue(closureLine);

      await expect(
        service.createAutoConversion('coll-line-1', 'closure-line-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── applyConversion ────────────────────────────────────────────────────────

  describe('applyConversion', () => {
    it('updates conversion to APPLIED and records appliedById', async () => {
      mockPrisma.conversion.findUnique.mockResolvedValue({
        id: 'conv-1',
        status: ConversionStatus.PENDING,
      });
      mockPrisma.conversion.update.mockResolvedValue({
        id: 'conv-1',
        status: ConversionStatus.APPLIED,
        appliedById: 'user-1',
      });

      const result = await service.applyConversion('conv-1', 'user-1');

      expect(mockPrisma.conversion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv-1' },
          data: expect.objectContaining({
            status: ConversionStatus.APPLIED,
            appliedById: 'user-1',
          }),
        }),
      );
      expect(result.status).toBe(ConversionStatus.APPLIED);
    });

    it('throws NotFoundException when conversion does not exist', async () => {
      mockPrisma.conversion.findUnique.mockResolvedValue(null);

      await expect(service.applyConversion('missing', 'user-1')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.conversion.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when conversion is already APPLIED', async () => {
      mockPrisma.conversion.findUnique.mockResolvedValue({
        id: 'conv-1',
        status: ConversionStatus.APPLIED,
      });

      await expect(service.applyConversion('conv-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when conversion is REJECTED', async () => {
      mockPrisma.conversion.findUnique.mockResolvedValue({
        id: 'conv-1',
        status: ConversionStatus.REJECTED,
      });

      await expect(service.applyConversion('conv-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ── rejectConversion ───────────────────────────────────────────────────────

  describe('rejectConversion', () => {
    it('updates conversion to REJECTED with reason', async () => {
      mockPrisma.conversion.findUnique.mockResolvedValue({
        id: 'conv-1',
        status: ConversionStatus.PENDING,
      });
      mockPrisma.conversion.update.mockResolvedValue({
        id: 'conv-1',
        status: ConversionStatus.REJECTED,
      });

      await service.rejectConversion('conv-1', 'user-1', 'Material no aceptado');

      expect(mockPrisma.conversion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ConversionStatus.REJECTED,
            appliedById: 'user-1',
            observation: 'Material no aceptado',
          }),
        }),
      );
    });

    it('trims the reason before storing', async () => {
      mockPrisma.conversion.findUnique.mockResolvedValue({
        id: 'conv-1',
        status: ConversionStatus.PENDING,
      });
      mockPrisma.conversion.update.mockResolvedValue({ id: 'conv-1' });

      await service.rejectConversion('conv-1', 'user-1', '  Material inapropiado  ');

      const updateCall = mockPrisma.conversion.update.mock.calls[0][0] as { data: { observation: string } };
      expect(updateCall.data.observation).toBe('Material inapropiado');
    });

    it('throws BadRequestException when reason is empty string', async () => {
      await expect(
        service.rejectConversion('conv-1', 'user-1', ''),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.conversion.findUnique).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when reason is only whitespace', async () => {
      await expect(
        service.rejectConversion('conv-1', 'user-1', '   '),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when conversion does not exist', async () => {
      mockPrisma.conversion.findUnique.mockResolvedValue(null);

      await expect(
        service.rejectConversion('missing', 'user-1', 'Motivo válido'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when conversion is not PENDING', async () => {
      mockPrisma.conversion.findUnique.mockResolvedValue({
        id: 'conv-1',
        status: ConversionStatus.APPLIED,
      });

      await expect(
        service.rejectConversion('conv-1', 'user-1', 'Motivo'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
