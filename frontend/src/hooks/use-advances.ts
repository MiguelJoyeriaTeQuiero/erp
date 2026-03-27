'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys } from './query-keys';
import type { AdvancePayment } from '@/types/api';

type ApiResponse<T> = { data: T };

// ── Query: adelanto del cierre ─────────────────────────────────────────────────

export function useAdvance(closureId: string) {
  return useQuery({
    queryKey: queryKeys.closures.advance(closureId),
    queryFn: () =>
      api.get<ApiResponse<AdvancePayment | null>>(`/closures/${closureId}/advance`).then((r) => r.data),
    enabled: !!closureId,
  });
}

// ── Mutación: crear adelanto ───────────────────────────────────────────────────

export interface CreateAdvanceDto {
  amount: string;
  paymentMethod: 'CASH' | 'TRANSFER' | 'OTHER';
  observations?: string;
}

export function useCreateAdvance(closureId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAdvanceDto) =>
      api.post<ApiResponse<AdvancePayment>>(`/closures/${closureId}/advance`, data).then((r) => r.data),
    onSuccess: () => {
      // Actualizar el cierre y el adelanto
      void qc.invalidateQueries({ queryKey: queryKeys.closures.detail(closureId) });
      void qc.invalidateQueries({ queryKey: queryKeys.closures.advance(closureId) });
    },
  });
}
