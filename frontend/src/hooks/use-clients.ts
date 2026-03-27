'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { qs } from '@/lib/qs';
import { queryKeys } from './query-keys';
import type { Client, Closure } from '@/types/api';

type ApiResponse<T> = { data: T };
type PaginatedResponse<T> = { data: T[]; meta: { total: number; page: number; limit: number; totalPages: number } };

// ── Filtros ────────────────────────────────────────────────────────────────────

export interface ClientFilters {
  search?: string;
  type?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
}

// ── Queries ────────────────────────────────────────────────────────────────────

export function useClients(filters: ClientFilters = {}) {
  return useQuery({
    queryKey: queryKeys.clients.list(filters),
    queryFn: () =>
      api.get<PaginatedResponse<Client>>(`/clients${qs(filters)}`),
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: queryKeys.clients.detail(id),
    queryFn: () => api.get<ApiResponse<Client>>(`/clients/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useClientClosures(clientId: string) {
  return useQuery({
    queryKey: queryKeys.clients.closures(clientId),
    queryFn: () =>
      api.get<PaginatedResponse<Closure>>(`/clients/${clientId}/closures`),
    enabled: !!clientId,
  });
}

// ── Mutaciones ─────────────────────────────────────────────────────────────────

export interface CreateClientDto {
  type: string;
  commercialName: string;
  legalName: string;
  taxId: string;
  phone: string;
  address: string;
  contactPerson: string;
  categoryId: string;
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClientDto) =>
      api.post<ApiResponse<Client>>('/clients', data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.clients.all });
    },
  });
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateClientDto>) =>
      api.patch<ApiResponse<Client>>(`/clients/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.clients.all });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/clients/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.clients.all });
    },
  });
}
