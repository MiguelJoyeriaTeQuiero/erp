'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { qs } from '@/lib/qs';
import { queryKeys } from './query-keys';
import type { Closure, ReconciliationSummary, AuditLog, Conversion } from '@/types/api';

type ApiResponse<T> = { data: T };
type PaginatedResponse<T> = {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

// ── Filtros ────────────────────────────────────────────────────────────────────

export interface ClosureFilters {
  status?: string;
  clientId?: string;
  createdBy?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ── Queries ────────────────────────────────────────────────────────────────────

export function useClosures(filters: ClosureFilters = {}) {
  return useQuery({
    queryKey: queryKeys.closures.list(filters),
    queryFn: () => api.get<PaginatedResponse<Closure>>(`/closures${qs(filters)}`),
  });
}

export function useClosure(id: string) {
  return useQuery({
    queryKey: queryKeys.closures.detail(id),
    queryFn: () => api.get<ApiResponse<Closure>>(`/closures/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useClosureSummary(id: string) {
  return useQuery({
    queryKey: queryKeys.closures.summary(id),
    queryFn: () =>
      api.get<ApiResponse<ReconciliationSummary>>(`/closures/${id}/summary`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useClosureAudit(id: string) {
  return useQuery({
    queryKey: queryKeys.closures.audit(id),
    queryFn: () =>
      api.get<ApiResponse<AuditLog[]>>(`/audit/entity/closure/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useClosureConversions(closureId: string) {
  return useQuery({
    queryKey: queryKeys.closures.conversions(closureId),
    queryFn: () =>
      api
        .get<ApiResponse<Conversion[]>>(`/closures/${closureId}/conversions`)
        .then((r) => r.data),
    enabled: !!closureId,
  });
}

// ── Mutaciones CRUD ────────────────────────────────────────────────────────────

export interface CreateClosureDto {
  clientId: string;
  observations?: string;
}

export function useCreateClosure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClosureDto) =>
      api.post<ApiResponse<Closure>>('/closures', data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.closures.all });
    },
  });
}

export interface UpdateClosureDto {
  observations?: string;
}

export function useUpdateClosure(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateClosureDto) =>
      api.patch<ApiResponse<Closure>>(`/closures/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.closures.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.closures.lists() });
    },
  });
}

// ── Mutaciones de transición de estado ────────────────────────────────────────

export function useConfirmClosure(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ApiResponse<Closure>>(`/closures/${id}/confirm`).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.closures.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.closures.lists() });
    },
  });
}

export interface CancelClosureDto {
  reason: string;
}

export function useCancelClosure(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CancelClosureDto) =>
      api.post<ApiResponse<Closure>>(`/closures/${id}/cancel`, data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.closures.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.closures.lists() });
    },
  });
}

export function useCompleteClosure(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<ApiResponse<Closure>>(`/closures/${id}/complete`).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.closures.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.closures.lists() });
    },
  });
}

// ── Mutaciones de conversión ───────────────────────────────────────────────────

export interface ApplyConversionDto {
  observation?: string;
}

export function useApplyConversion(closureId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversionId, data }: { conversionId: string; data?: ApplyConversionDto }) =>
      api
        .post<ApiResponse<Conversion>>(`/conversions/${conversionId}/apply`, data ?? {})
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.closures.detail(closureId) });
      void qc.invalidateQueries({ queryKey: queryKeys.closures.conversions(closureId) });
      void qc.invalidateQueries({ queryKey: queryKeys.closures.summary(closureId) });
    },
  });
}

export interface RejectConversionDto {
  observation: string;
}

export function useRejectConversion(closureId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversionId, data }: { conversionId: string; data: RejectConversionDto }) =>
      api
        .post<ApiResponse<Conversion>>(`/conversions/${conversionId}/reject`, data)
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.closures.detail(closureId) });
      void qc.invalidateQueries({ queryKey: queryKeys.closures.conversions(closureId) });
      void qc.invalidateQueries({ queryKey: queryKeys.closures.summary(closureId) });
    },
  });
}
