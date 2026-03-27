'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { qs } from '@/lib/qs';
import { queryKeys } from './query-keys';
import type { PriceRate } from '@/types/api';

type ApiResponse<T> = { data: T };
type PaginatedResponse<T> = {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

// ── Filtros ────────────────────────────────────────────────────────────────────

export interface PriceRateFilters {
  metalTypeId?: string;
  karatId?: string;
  categoryId?: string;
}

export interface PriceHistoryFilters extends PriceRateFilters {
  page?: number;
  limit?: number;
}

// ── Queries ────────────────────────────────────────────────────────────────────

/** Tarifas activas actuales — actualización cada 30s (se refresca automáticamente) */
export function useCurrentRates(filters: PriceRateFilters = {}) {
  return useQuery({
    queryKey: queryKeys.pricing.current(filters),
    queryFn: () =>
      api.get<ApiResponse<PriceRate[]>>(`/pricing/rates/current${qs(filters)}`).then((r) => r.data),
    // Refresco automático cada 35 segundos (el backend actualiza cada 30s)
    refetchInterval: 35_000,
    staleTime: 30_000,
  });
}

export function usePricingHistory(filters: PriceHistoryFilters = {}) {
  return useQuery({
    queryKey: queryKeys.pricing.history(filters),
    queryFn: () =>
      api.get<PaginatedResponse<PriceRate>>(`/pricing/rates/history${qs(filters)}`),
  });
}

// ── Mutación: crear tarifa manual ─────────────────────────────────────────────

export interface CreatePriceRateDto {
  metalTypeId: string;
  karatId: string;
  categoryId: string;
  /** Decimal como string */
  pricePerGram: string;
}

export function useCreatePriceRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePriceRateDto) =>
      api.post<ApiResponse<PriceRate>>('/pricing/rates', data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.pricing.all });
    },
  });
}
