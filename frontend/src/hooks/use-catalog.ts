'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys } from './query-keys';
import type { MetalType, KaratCatalog, ClientCategory } from '@/types/api';

type ApiResponse<T> = { data: T };

// ── Metales ────────────────────────────────────────────────────────────────────

export function useMetals() {
  return useQuery({
    queryKey: queryKeys.catalog.metals(),
    queryFn: () => api.get<ApiResponse<MetalType[]>>('/catalog/metals').then((r) => r.data),
    staleTime: 1000 * 60 * 10, // catálogo es muy estable
  });
}

// ── Quilatajes ─────────────────────────────────────────────────────────────────

export function useKarats(metalTypeId?: string) {
  return useQuery({
    queryKey: queryKeys.catalog.karats(metalTypeId),
    queryFn: () => {
      const url = metalTypeId
        ? `/catalog/karats?metalTypeId=${metalTypeId}`
        : '/catalog/karats';
      return api.get<ApiResponse<KaratCatalog[]>>(url).then((r) => r.data);
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useCommonKarats() {
  return useQuery({
    queryKey: queryKeys.catalog.karats('common'),
    queryFn: () =>
      api.get<ApiResponse<KaratCatalog[]>>('/catalog/karats/common').then((r) => r.data),
    staleTime: 1000 * 60 * 10,
  });
}

// ── Categorías de cliente ──────────────────────────────────────────────────────

export function useClientCategories() {
  return useQuery({
    queryKey: queryKeys.catalog.categories(),
    queryFn: () =>
      api.get<ApiResponse<ClientCategory[]>>('/catalog/client-categories').then((r) => r.data),
    staleTime: 1000 * 60 * 10,
  });
}
