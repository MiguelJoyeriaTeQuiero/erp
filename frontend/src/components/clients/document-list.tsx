'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  FileTextIcon,
  DownloadIcon,
  TrashIcon,
  UploadIcon,
  Loader2Icon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/shared/file-upload';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { ListSkeleton } from '@/components/shared/loading-skeleton';
import {
  useClientDocuments,
  useUploadClientDocument,
  useDeleteClientDocument,
} from '@/hooks/use-client-documents';
import { apiFetch } from '@/lib/api-client';
import { formatDate, formatFileSize } from '@/lib/formatters';
import { ApiError } from '@/lib/api-client';
import type { ClientDocument } from '@/types/api';

// ── Descarga de documento ──────────────────────────────────────────────────────

async function downloadDocument(clientId: string, doc: ClientDocument) {
  // Descarga con token de autorización y genera enlace temporal
  const blob = await apiFetch<Blob>(
    `/clients/${clientId}/documents/${doc.id}/download`,
    { method: 'GET' },
  );
  const url = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob as unknown as BlobPart]));
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.originalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Tarjeta de documento ───────────────────────────────────────────────────────

function DocumentCard({
  clientId,
  doc,
}: {
  clientId: string;
  doc: ClientDocument;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const deleteMutation = useDeleteClientDocument(clientId);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadDocument(clientId, doc);
    } catch {
      toast.error('Error al descargar el documento');
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(doc.id);
      toast.success('Documento eliminado');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error al eliminar el documento');
      throw err;
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted/30 transition-colors">
        <div className="shrink-0 rounded-lg bg-red-50 p-2.5 dark:bg-red-900/20">
          <FileTextIcon className="size-5 text-red-500" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{doc.originalName}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(doc.sizeBytes)} · {formatDate(doc.createdAt)}
            {doc.uploadedByUser && ` · ${doc.uploadedByUser.name}`}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleDownload}
            disabled={downloading}
            aria-label="Descargar"
          >
            {downloading ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <DownloadIcon className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowDelete(true)}
            aria-label="Eliminar"
            className="text-destructive hover:text-destructive"
          >
            <TrashIcon className="size-4" />
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="¿Eliminar documento?"
        description={`Se eliminará "${doc.originalName}" de forma permanente.`}
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}

// ── Panel de subida ────────────────────────────────────────────────────────────

function UploadPanel({ clientId }: { clientId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const uploadMutation = useUploadClientDocument(clientId);

  const handleUpload = async () => {
    if (!file) return;
    try {
      await uploadMutation.mutateAsync(file);
      toast.success('Documento subido correctamente');
      setFile(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error al subir el documento');
    }
  };

  return (
    <div className="space-y-3">
      <FileUpload
        value={file}
        onChange={setFile}
        disabled={uploadMutation.isPending}
      />
      {file && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleUpload}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <UploadIcon className="size-4" />
            )}
            {uploadMutation.isPending ? 'Subiendo...' : 'Subir documento'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

interface DocumentListProps {
  clientId: string;
  canUpload?: boolean;
}

export function DocumentList({ clientId, canUpload = true }: DocumentListProps) {
  const { data: documents, isLoading } = useClientDocuments(clientId);

  return (
    <div className="space-y-4">
      {canUpload && <UploadPanel clientId={clientId} />}

      {isLoading ? (
        <ListSkeleton items={3} />
      ) : !documents || documents.length === 0 ? (
        <EmptyState
          icon={FileTextIcon}
          title="Sin documentos"
          description="Sube documentos PDF del cliente (DNI, escrituras, etc.)"
        />
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <DocumentCard key={doc.id} clientId={clientId} doc={doc} />
          ))}
        </div>
      )}
    </div>
  );
}
