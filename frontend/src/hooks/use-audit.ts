'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { qs } from '@/lib/qs';
import { queryKeys } from './query-keys';
import type { AuditLog, AuditAction } from '@/types/api';

type ApiResponse<T> = { data: T };
type PaginatedResponse<T> = {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

// ── Filtros ────────────────────────────────────────────────────────────────────

export interface AuditFilters {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: AuditAction;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// ── Queries ────────────────────────────────────────────────────────────────────

/** Listado global — solo admin */
export function useAuditLogs(filters: AuditFilters = {}) {
  return useQuery({
    queryKey: queryKeys.audit.list(filters),
    queryFn: () => api.get<PaginatedResponse<AuditLog>>(`/audit${qs(filters)}`),
  });
}

/** Historial de auditoría de una entidad concreta */
export function useEntityAudit(entityType: string, entityId: string) {
  return useQuery({
    queryKey: queryKeys.audit.byEntity(entityType, entityId),
    queryFn: () =>
      api
        .get<ApiResponse<AuditLog[]>>(`/audit/entity/${entityType}/${entityId}`)
        .then((r) => r.data),
    enabled: !!entityType && !!entityId,
  });
}
