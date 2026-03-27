'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { qs } from '@/lib/qs';
import { queryKeys } from './query-keys';
import type { Incident, IncidentType } from '@/types/api';

type ApiResponse<T> = { data: T };
type PaginatedResponse<T> = {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

// ── Filtros ────────────────────────────────────────────────────────────────────

export interface IncidentFilters {
  closureId?: string;
  type?: IncidentType;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// ── Queries ────────────────────────────────────────────────────────────────────

export function useIncidents(filters: IncidentFilters = {}) {
  return useQuery({
    queryKey: queryKeys.incidents.list(filters),
    queryFn: () => api.get<PaginatedResponse<Incident>>(`/incidents${qs(filters)}`),
  });
}

export function useIncident(id: string) {
  return useQuery({
    queryKey: queryKeys.incidents.detail(id),
    queryFn: () => api.get<ApiResponse<Incident>>(`/incidents/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

// ── DTOs ───────────────────────────────────────────────────────────────────────

export interface CreateIncidentDto {
  closureId: string;
  collectionId?: string;
  validationSessionId?: string;
  type: IncidentType;
  reason: string;
}

export interface UpdateIncidentDto {
  reason?: string;
  resolution?: string;
}

export interface ResolveIncidentDto {
  resolution: string;
}

// ── Helpers de invalidación ────────────────────────────────────────────────────

function invalidateIncident(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
  closureId?: string,
) {
  void qc.invalidateQueries({ queryKey: queryKeys.incidents.detail(id) });
  void qc.invalidateQueries({ queryKey: queryKeys.incidents.lists() });
  if (closureId) {
    void qc.invalidateQueries({ queryKey: queryKeys.closures.detail(closureId) });
    void qc.invalidateQueries({ queryKey: queryKeys.closures.lists() });
  }
}

// ── Mutaciones ─────────────────────────────────────────────────────────────────

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateIncidentDto) =>
      api.post<ApiResponse<Incident>>('/incidents', data).then((r) => r.data),
    onSuccess: (incident) => {
      void qc.invalidateQueries({ queryKey: queryKeys.incidents.all });
      void qc.invalidateQueries({ queryKey: queryKeys.closures.detail(incident.closureId) });
    },
  });
}

export function useUpdateIncident(closureId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateIncidentDto }) =>
      api.patch<ApiResponse<Incident>>(`/incidents/${id}`, data).then((r) => r.data),
    onSuccess: (_, { id }) => invalidateIncident(qc, id, closureId),
  });
}

export function useResolveIncident(closureId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ResolveIncidentDto }) =>
      api
        .post<ApiResponse<Incident>>(`/incidents/${id}/resolve`, data)
        .then((r) => r.data),
    onSuccess: (_, { id }) => invalidateIncident(qc, id, closureId),
  });
}

export function useCancelIncident(closureId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<ApiResponse<Incident>>(`/incidents/${id}/cancel`).then((r) => r.data),
    onSuccess: (_, id) => invalidateIncident(qc, id, closureId),
  });
}
