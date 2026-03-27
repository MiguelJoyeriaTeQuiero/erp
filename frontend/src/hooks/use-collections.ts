'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { qs } from '@/lib/qs';
import { queryKeys } from './query-keys';
import type { Collection, CollectionLine } from '@/types/api';

type ApiResponse<T> = { data: T };
type PaginatedResponse<T> = {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

// ── Filtros ────────────────────────────────────────────────────────────────────

export interface CollectionFilters {
  closureId?: string;
  collectorId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// ── Queries ────────────────────────────────────────────────────────────────────

export function useCollections(filters: CollectionFilters = {}) {
  return useQuery({
    queryKey: queryKeys.collections.list(filters),
    queryFn: () => api.get<PaginatedResponse<Collection>>(`/collections${qs(filters)}`),
  });
}

export function useCollection(id: string) {
  return useQuery({
    queryKey: queryKeys.collections.detail(id),
    queryFn: () =>
      api.get<ApiResponse<Collection>>(`/collections/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

// ── DTOs ───────────────────────────────────────────────────────────────────────

export interface CreateCollectionDto {
  observations?: string;
  isPartial: boolean;
  collectedAt: string;
}

export interface AddCollectionLineDto {
  metalTypeId: string;
  karatId: string;
  /** Decimal como string */
  gramsDeclared: string;
}

export interface UpdateCollectionDto {
  observations?: string;
  isPartial?: boolean;
}

// ── Mutaciones ─────────────────────────────────────────────────────────────────

export function useCreateCollection(closureId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCollectionDto) =>
      api
        .post<ApiResponse<Collection>>(`/closures/${closureId}/collections`, data)
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.collections.all });
      // Actualizar cierre porque cambia de estado
      void qc.invalidateQueries({ queryKey: queryKeys.closures.detail(closureId) });
      void qc.invalidateQueries({ queryKey: queryKeys.closures.lists() });
    },
  });
}

export function useUpdateCollection(closureId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, data }: { collectionId: string; data: UpdateCollectionDto }) =>
      api
        .patch<ApiResponse<Collection>>(`/collections/${collectionId}`, data)
        .then((r) => r.data),
    onSuccess: (_, { collectionId }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.collections.detail(collectionId) });
      void qc.invalidateQueries({ queryKey: queryKeys.collections.lists() });
      void qc.invalidateQueries({ queryKey: queryKeys.closures.detail(closureId) });
    },
  });
}

export function useAddCollectionLine(collectionId: string, closureId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AddCollectionLineDto) =>
      api
        .post<ApiResponse<CollectionLine>>(`/collections/${collectionId}/lines`, data)
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.collections.detail(collectionId) });
      // Puede haber generado conversiones o cambiado estado del cierre
      void qc.invalidateQueries({ queryKey: queryKeys.closures.detail(closureId) });
      void qc.invalidateQueries({ queryKey: queryKeys.closures.conversions(closureId) });
    },
  });
}
