'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiFetch } from '@/lib/api-client';
import { queryKeys } from './query-keys';
import type { ClientDocument } from '@/types/api';

type ApiResponse<T> = { data: T };

// ── Query: listado de documentos ───────────────────────────────────────────────

export function useClientDocuments(clientId: string) {
  return useQuery({
    queryKey: queryKeys.clientDocuments.list(clientId),
    queryFn: () =>
      api.get<ApiResponse<ClientDocument[]>>(`/clients/${clientId}/documents`).then((r) => r.data),
    enabled: !!clientId,
  });
}

// ── Mutación: subir documento ──────────────────────────────────────────────────

export function useUploadClientDocument(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      // apiFetch directamente para evitar JSON.stringify en FormData
      return apiFetch<ApiResponse<ClientDocument>>(
        `/clients/${clientId}/documents`,
        { method: 'POST', body: formData },
      ).then((r) => r.data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.clientDocuments.all(clientId) });
    },
  });
}

// ── Mutación: eliminar documento ───────────────────────────────────────────────

export function useDeleteClientDocument(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) =>
      api.del(`/clients/${clientId}/documents/${docId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.clientDocuments.all(clientId) });
    },
  });
}
