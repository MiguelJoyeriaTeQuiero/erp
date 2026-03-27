import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { ClosureStatus } from '@prisma/client';
import { StateMachineService } from '@domain/state-machine.service';
import { PrismaService } from '@modules/prisma/prisma.service';

// ── Mock de PrismaService ──────────────────────────────────────────────────────

const mockPrisma = {
  dealClosure: {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  dealClosureLine: { count: jest.fn() },
  incident: { count: jest.fn() },
  validationSession: { findFirst: jest.fn() },
};

describe('StateMachineService', () => {
  let service: StateMachineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StateMachineService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<StateMachineService>(StateMachineService);
    jest.clearAllMocks();
  });

  // ── canTransition ──────────────────────────────────────────────────────────

  describe('canTransition', () => {
    const VALID: [ClosureStatus, ClosureStatus][] = [
      [ClosureStatus.DRAFT,              ClosureStatus.CONFIRMED],
      [ClosureStatus.DRAFT,              ClosureStatus.CANCELLED],
      [ClosureStatus.CONFIRMED,          ClosureStatus.WITH_ADVANCE],
      [ClosureStatus.CONFIRMED,          ClosureStatus.PENDING_COLLECTION],
      [ClosureStatus.CONFIRMED,          ClosureStatus.CANCELLED],
      [ClosureStatus.WITH_ADVANCE,       ClosureStatus.PENDING_COLLECTION],
      [ClosureStatus.WITH_ADVANCE,       ClosureStatus.CANCELLED],
      [ClosureStatus.PENDING_COLLECTION, ClosureStatus.PARTIAL_COLLECTION],
      [ClosureStatus.PENDING_COLLECTION, ClosureStatus.PENDING_VALIDATION],
      [ClosureStatus.PENDING_COLLECTION, ClosureStatus.CANCELLED],
      [ClosureStatus.PARTIAL_COLLECTION, ClosureStatus.PENDING_COLLECTION],
      [ClosureStatus.PARTIAL_COLLECTION, ClosureStatus.PENDING_VALIDATION],
      [ClosureStatus.PENDING_VALIDATION, ClosureStatus.IN_VALIDATION],
      [ClosureStatus.PENDING_VALIDATION, ClosureStatus.CANCELLED],
      [ClosureStatus.IN_VALIDATION,      ClosureStatus.WITH_INCIDENTS],
      [ClosureStatus.IN_VALIDATION,      ClosureStatus.VALIDATED],
      [ClosureStatus.IN_VALIDATION,      ClosureStatus.CANCELLED],
      [ClosureStatus.WITH_INCIDENTS,     ClosureStatus.PENDING_VALIDATION],
      [ClosureStatus.WITH_INCIDENTS,     ClosureStatus.PENDING_COLLECTION],
      [ClosureStatus.WITH_INCIDENTS,     ClosureStatus.CANCELLED],
      [ClosureStatus.VALIDATED,          ClosureStatus.COMPLETED],
      [ClosureStatus.VALIDATED,          ClosureStatus.CANCELLED],
    ];

    test.each(VALID)('allows %s → %s', (from, to) => {
      expect(service.canTransition(from, to)).toBe(true);
    });

    const INVALID: [ClosureStatus, ClosureStatus][] = [
      [ClosureStatus.DRAFT,              ClosureStatus.COMPLETED],
      [ClosureStatus.DRAFT,              ClosureStatus.VALIDATED],
      [ClosureStatus.DRAFT,              ClosureStatus.WITH_INCIDENTS],
      [ClosureStatus.CONFIRMED,          ClosureStatus.DRAFT],
      [ClosureStatus.CONFIRMED,          ClosureStatus.COMPLETED],
      [ClosureStatus.PENDING_VALIDATION, ClosureStatus.COMPLETED],
      [ClosureStatus.PENDING_VALIDATION, ClosureStatus.DRAFT],
      [ClosureStatus.VALIDATED,          ClosureStatus.DRAFT],
      [ClosureStatus.VALIDATED,          ClosureStatus.IN_VALIDATION],
      [ClosureStatus.COMPLETED,          ClosureStatus.DRAFT],
      [ClosureStatus.COMPLETED,          ClosureStatus.CANCELLED],
      [ClosureStatus.COMPLETED,          ClosureStatus.VALIDATED],
      [ClosureStatus.CANCELLED,          ClosureStatus.DRAFT],
      [ClosureStatus.CANCELLED,          ClosureStatus.CONFIRMED],
    ];

    test.each(INVALID)('blocks %s → %s', (from, to) => {
      expect(service.canTransition(from, to)).toBe(false);
    });
  });

  // ── getAvailableTransitions ────────────────────────────────────────────────

  describe('getAvailableTransitions', () => {
    it('returns empty array for COMPLETED (terminal)', () => {
      expect(service.getAvailableTransitions(ClosureStatus.COMPLETED)).toEqual([]);
    });

    it('returns empty array for CANCELLED (terminal)', () => {
      expect(service.getAvailableTransitions(ClosureStatus.CANCELLED)).toEqual([]);
    });

    it('returns CONFIRMED and CANCELLED from DRAFT', () => {
      const result = service.getAvailableTransitions(ClosureStatus.DRAFT);
      expect(result).toContain(ClosureStatus.CONFIRMED);
      expect(result).toContain(ClosureStatus.CANCELLED);
      expect(result).toHaveLength(2);
    });

    it('returns COMPLETED and CANCELLED from VALIDATED', () => {
      const result = service.getAvailableTransitions(ClosureStatus.VALIDATED);
      expect(result).toContain(ClosureStatus.COMPLETED);
      expect(result).toContain(ClosureStatus.CANCELLED);
    });

    it('includes PENDING_VALIDATION from WITH_INCIDENTS', () => {
      const result = service.getAvailableTransitions(ClosureStatus.WITH_INCIDENTS);
      expect(result).toContain(ClosureStatus.PENDING_VALIDATION);
    });
  });

  // ── transition ─────────────────────────────────────────────────────────────

  describe('transition', () => {
    const draftClosure = { id: 'cls-1', status: ClosureStatus.DRAFT, version: 1 };

    // ── Terminal states ──────────────────────────────────────────────────────

    it('throws BadRequestException when closure is COMPLETED', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue({
        ...draftClosure,
        status: ClosureStatus.COMPLETED,
      });

      await expect(
        service.transition('cls-1', ClosureStatus.DRAFT, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.dealClosure.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when closure is CANCELLED', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue({
        ...draftClosure,
        status: ClosureStatus.CANCELLED,
      });

      await expect(
        service.transition('cls-1', ClosureStatus.DRAFT, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    // ── Invalid transitions ──────────────────────────────────────────────────

    it('throws UnprocessableEntityException for transition not in graph', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue(draftClosure);

      await expect(
        service.transition('cls-1', ClosureStatus.COMPLETED, 'user-1'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException going backwards (CONFIRMED → DRAFT)', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue({
        ...draftClosure,
        status: ClosureStatus.CONFIRMED,
      });

      await expect(
        service.transition('cls-1', ClosureStatus.DRAFT, 'user-1'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    // ── DRAFT → CONFIRMED preconditions ──────────────────────────────────────

    it('throws BadRequestException when confirming a closure with no lines', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue(draftClosure);
      mockPrisma.dealClosureLine.count.mockResolvedValue(0);

      await expect(
        service.transition('cls-1', ClosureStatus.CONFIRMED, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('confirms successfully when closure has at least one line', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue(draftClosure);
      mockPrisma.dealClosureLine.count.mockResolvedValue(2);
      mockPrisma.dealClosure.update.mockResolvedValue({
        ...draftClosure,
        status: ClosureStatus.CONFIRMED,
        version: 2,
      });

      const result = await service.transition('cls-1', ClosureStatus.CONFIRMED, 'user-1');

      expect(result.status).toBe(ClosureStatus.CONFIRMED);
      expect(mockPrisma.dealClosure.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ClosureStatus.CONFIRMED,
            version: { increment: 1 },
          }),
        }),
      );
    });

    it('sets confirmedById and confirmedAt when confirming', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue(draftClosure);
      mockPrisma.dealClosureLine.count.mockResolvedValue(1);
      mockPrisma.dealClosure.update.mockResolvedValue({ ...draftClosure });

      await service.transition('cls-1', ClosureStatus.CONFIRMED, 'admin-1');

      expect(mockPrisma.dealClosure.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            confirmedById: 'admin-1',
            confirmedAt: expect.any(Date),
          }),
        }),
      );
    });

    // ── Cancellation ──────────────────────────────────────────────────────────

    it('sets cancelledById, cancelledAt and cancellationReason when cancelling', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue(draftClosure);
      mockPrisma.dealClosure.update.mockResolvedValue({ ...draftClosure });

      await service.transition('cls-1', ClosureStatus.CANCELLED, 'user-1', {
        cancellationReason: 'Cliente desistió',
      });

      expect(mockPrisma.dealClosure.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cancelledById: 'user-1',
            cancelledAt: expect.any(Date),
            cancellationReason: 'Cliente desistió',
          }),
        }),
      );
    });

    it('cancels without reason (reason is optional)', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue(draftClosure);
      mockPrisma.dealClosure.update.mockResolvedValue({ ...draftClosure });

      await service.transition('cls-1', ClosureStatus.CANCELLED, 'user-1');

      const updateData = (mockPrisma.dealClosure.update.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data;
      expect(updateData['cancellationReason']).toBeUndefined();
    });

    // ── VALIDATED → COMPLETED preconditions ───────────────────────────────────

    it('throws BadRequestException when completing with open incidents', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue({
        ...draftClosure,
        status: ClosureStatus.VALIDATED,
      });
      mockPrisma.incident.count.mockResolvedValue(2);

      await expect(
        service.transition('cls-1', ClosureStatus.COMPLETED, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('completes a VALIDATED closure with no open incidents', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue({
        ...draftClosure,
        status: ClosureStatus.VALIDATED,
      });
      mockPrisma.incident.count.mockResolvedValue(0);
      mockPrisma.dealClosure.update.mockResolvedValue({
        ...draftClosure,
        status: ClosureStatus.COMPLETED,
      });

      const result = await service.transition('cls-1', ClosureStatus.COMPLETED, 'user-1');

      expect(result.status).toBe(ClosureStatus.COMPLETED);
      expect(mockPrisma.dealClosure.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ completedAt: expect.any(Date) }),
        }),
      );
    });

    // ── PENDING_VALIDATION → IN_VALIDATION preconditions ─────────────────────

    it('throws BadRequestException for IN_VALIDATION when no active session exists', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue({
        ...draftClosure,
        status: ClosureStatus.PENDING_VALIDATION,
      });
      mockPrisma.validationSession.findFirst.mockResolvedValue(null);

      await expect(
        service.transition('cls-1', ClosureStatus.IN_VALIDATION, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('transitions to IN_VALIDATION when an active session exists', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue({
        ...draftClosure,
        status: ClosureStatus.PENDING_VALIDATION,
      });
      mockPrisma.validationSession.findFirst.mockResolvedValue({ id: 'val-1' });
      mockPrisma.dealClosure.update.mockResolvedValue({
        ...draftClosure,
        status: ClosureStatus.IN_VALIDATION,
      });

      const result = await service.transition('cls-1', ClosureStatus.IN_VALIDATION, 'user-1');
      expect(result.status).toBe(ClosureStatus.IN_VALIDATION);
    });

    // ── WITH_INCIDENTS → PENDING_VALIDATION preconditions ─────────────────────

    it('throws BadRequestException when returning to PENDING_VALIDATION with open incidents', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue({
        ...draftClosure,
        status: ClosureStatus.WITH_INCIDENTS,
      });
      mockPrisma.incident.count.mockResolvedValue(3);

      await expect(
        service.transition('cls-1', ClosureStatus.PENDING_VALIDATION, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns to PENDING_VALIDATION from WITH_INCIDENTS when all incidents resolved', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue({
        ...draftClosure,
        status: ClosureStatus.WITH_INCIDENTS,
      });
      mockPrisma.incident.count.mockResolvedValue(0);
      mockPrisma.dealClosure.update.mockResolvedValue({
        ...draftClosure,
        status: ClosureStatus.PENDING_VALIDATION,
      });

      const result = await service.transition('cls-1', ClosureStatus.PENDING_VALIDATION, 'user-1');
      expect(result.status).toBe(ClosureStatus.PENDING_VALIDATION);
    });

    // ── VALIDATED preconditions ───────────────────────────────────────────────

    it('throws BadRequestException for VALIDATED when session is still IN_PROGRESS', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue({
        ...draftClosure,
        status: ClosureStatus.IN_VALIDATION,
      });
      mockPrisma.validationSession.findFirst.mockResolvedValue({ id: 'val-active' });

      await expect(
        service.transition('cls-1', ClosureStatus.VALIDATED, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for VALIDATED when open incidents exist', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue({
        ...draftClosure,
        status: ClosureStatus.IN_VALIDATION,
      });
      mockPrisma.validationSession.findFirst.mockResolvedValue(null);
      mockPrisma.incident.count.mockResolvedValue(1);

      await expect(
        service.transition('cls-1', ClosureStatus.VALIDATED, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('increments version on every successful transition (optimistic locking)', async () => {
      mockPrisma.dealClosure.findUniqueOrThrow.mockResolvedValue(draftClosure);
      mockPrisma.dealClosureLine.count.mockResolvedValue(1);
      mockPrisma.dealClosure.update.mockResolvedValue({ ...draftClosure });

      await service.transition('cls-1', ClosureStatus.CONFIRMED, 'user-1');

      expect(mockPrisma.dealClosure.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: { increment: 1 } }),
        }),
      );
    });
  });
});
