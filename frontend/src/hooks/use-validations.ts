'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys } from './query-keys';
import type { ValidationSession, ValidationLine } from '@/types/api';

type ApiResponse<T> = { data: T };

// ── Queries ────────────────────────────────────────────────────────────────────

export function useClosureValidationSessions(closureId: string) {
  return useQuery({
    queryKey: queryKeys.validations.byClosure(closureId),
    queryFn: () =>
      api
        .get<ApiResponse<ValidationSession[]>>(`/closures/${closureId}/validations`)
        .then((r) => r.data),
    enabled: !!closureId,
  });
}

export function useValidationSession(id: string) {
  return useQuery({
    queryKey: queryKeys.validations.detail(id),
    queryFn: () =>
      api.get<ApiResponse<ValidationSession>>(`/validations/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

// ── DTOs ───────────────────────────────────────────────────────────────────────

export interface CreateValidationSessionDto {
  collectionId?: string;
  observations?: string;
}

export interface AddValidationLineDto {
  closureLineId?: string;
  collectionLineId?: string;
  /** Decimal como string */
  gramsValidated: string;
  karatValidatedId: string;
  observation?: string;
}

export interface ApproveRejectValidationDto {
  observations?: string;
}

// ── Helpers de invalidación ────────────────────────────────────────────────────

function invalidateAfterValidation(
  qc: ReturnType<typeof useQueryClient>,
  closureId: string,
  sessionId?: string,
) {
  if (sessionId) void qc.invalidateQueries({ queryKey: queryKeys.validations.detail(sessionId) });
  void qc.invalidateQueries({ queryKey: queryKeys.closures.detail(closureId) });
  void qc.invalidateQueries({ queryKey: queryKeys.closures.summary(closureId) });
  void qc.invalidateQueries({ queryKey: queryKeys.closures.lists() });
  void qc.invalidateQueries({ queryKey: queryKeys.incidents.all });
}

// ── Mutaciones ─────────────────────────────────────────────────────────────────

export function useCreateValidationSession(closureId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateValidationSessionDto) =>
      api
        .post<ApiResponse<ValidationSession>>(`/closures/${closureId}/validations`, data)
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.closures.detail(closureId) });
      void qc.invalidateQueries({ queryKey: queryKeys.closures.lists() });
    },
  });
}

export function useAddValidationLine(sessionId: string, closureId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AddValidationLineDto) =>
      api
        .post<ApiResponse<ValidationLine>>(`/validations/${sessionId}/lines`, data)
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.validations.detail(sessionId) });
      void qc.invalidateQueries({ queryKey: queryKeys.closures.summary(closureId) });
    },
  });
}

export function useApproveValidation(sessionId: string, closureId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data?: ApproveRejectValidationDto) =>
      api
        .post<ApiResponse<ValidationSession>>(`/validations/${sessionId}/approve`, data ?? {})
        .then((r) => r.data),
    onSuccess: () => invalidateAfterValidation(qc, closureId, sessionId),
  });
}

export function useRejectValidation(sessionId: string, closureId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data?: ApproveRejectValidationDto) =>
      api
        .post<ApiResponse<ValidationSession>>(`/validations/${sessionId}/reject`, data ?? {})
        .then((r) => r.data),
    onSuccess: () => invalidateAfterValidation(qc, closureId, sessionId),
  });
}
