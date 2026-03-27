'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys } from './query-keys';
import type { ClosureLine } from '@/types/api';

type ApiResponse<T> = { data: T };

// ── DTOs ───────────────────────────────────────────────────────────────────────

export interface AddClosureLineDto {
  metalTypeId: string;
  karatId: string;
  /** Decimal como string */
  grams: string;
}

export interface UpdateClosureLineDto {
  metalTypeId?: string;
  karatId?: string;
  /** Decimal como string */
  grams?: string;
}

// ── Helpers de invalidación ────────────────────────────────────────────────────

function invalidateClosure(qc: ReturnType<typeof useQueryClient>, closureId: string) {
  void qc.invalidateQueries({ queryKey: queryKeys.closures.detail(closureId) });
  void qc.invalidateQueries({ queryKey: queryKeys.closures.lists() });
}

// ── Mutaciones ─────────────────────────────────────────────────────────────────

export function useAddClosureLine(closureId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AddClosureLineDto) =>
      api
        .post<ApiResponse<ClosureLine>>(`/closures/${closureId}/lines`, data)
        .then((r) => r.data),
    onSuccess: () => invalidateClosure(qc, closureId),
  });
}

export function useUpdateClosureLine(closureId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, data }: { lineId: string; data: UpdateClosureLineDto }) =>
      api
        .patch<ApiResponse<ClosureLine>>(`/closures/${closureId}/lines/${lineId}`, data)
        .then((r) => r.data),
    onSuccess: () => invalidateClosure(qc, closureId),
  });
}

export function useDeleteClosureLine(closureId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lineId: string) =>
      api.del(`/closures/${closureId}/lines/${lineId}`),
    onSuccess: () => invalidateClosure(qc, closureId),
  });
}
