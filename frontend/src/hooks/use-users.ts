'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { qs } from '@/lib/qs';
import { queryKeys } from './query-keys';
import type { User } from '@/types/api';

type ApiResponse<T> = { data: T };
type PaginatedResponse<T> = {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

// ── Filtros ────────────────────────────────────────────────────────────────────

export interface UserFilters {
  search?: string;
  role?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

// ── Queries ────────────────────────────────────────────────────────────────────

export function useUsers(filters: UserFilters = {}) {
  return useQuery({
    queryKey: queryKeys.users.list(filters),
    queryFn: () => api.get<PaginatedResponse<User>>(`/users${qs(filters)}`),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => api.get<ApiResponse<User>>(`/users/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

// ── DTOs ───────────────────────────────────────────────────────────────────────

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  /** Nombre del rol: admin | oficina | validador | recogedor */
  role: string;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  isActive?: boolean;
}

// ── Mutaciones ─────────────────────────────────────────────────────────────────

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserDto) =>
      api.post<ApiResponse<User>>('/users', data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useUpdateUser(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateUserDto) =>
      api.patch<ApiResponse<User>>(`/users/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.users.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.users.lists() });
    },
  });
}

export function useToggleUserActive(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (isActive: boolean) =>
      api.patch<ApiResponse<User>>(`/users/${id}`, { isActive }).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.users.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.users.lists() });
    },
  });
}
