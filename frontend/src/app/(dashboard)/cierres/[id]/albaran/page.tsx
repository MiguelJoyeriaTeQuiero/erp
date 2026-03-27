'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  FileTextIcon,
  DownloadIcon,
  RefreshCwIcon,
  Loader2Icon,
  CheckCircleIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import { DetailSkeleton } from '@/components/shared/loading-skeleton';
import { useClosure } from '@/hooks/use-closures';
import { api, getAccessToken } from '@/lib/api-client';
import { formatDateTime } from '@/lib/formatters';
import type { DeliveryNote } from '@/types/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

type ApiResponse<T> = { data: T };

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

async function downloadPdf(path: string, filename: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Error al descargar: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function AlbaranPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const qc = useQueryClient();

  const { data: closure, isLoading: closureLoading } = useClosure(id);

  // Albaranes del cierre
  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['closures', id, 'delivery-notes'],
    queryFn: () =>
      api.get<ApiResponse<DeliveryNote[]>>(`/closures/${id}/delivery-notes`).then((r) => r.data),
    enabled: !!id,
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Albarán activo (no anulado) — tomar el último generado
  const activeNote = notes.find((n) => n.status !== 'VOIDED') ?? notes[0];

  // ── Generar albarán ──────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await api.post<ApiResponse<DeliveryNote>>(`/closures/${id}/delivery-notes`);
      await qc.invalidateQueries({ queryKey: ['closures', id, 'delivery-notes'] });
      toast.success('Albarán generado correctamente');
    } catch {
      toast.error('Error al generar el albarán. Comprueba que el cierre esté completado.');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Descargar PDF ────────────────────────────────────────────────────────

  const handleDownload = async (note: DeliveryNote) => {
    setIsDownloading(true);
    try {
      await downloadPdf(
        `/delivery-notes/${note.id}/download`,
        `albaran-${closure?.code ?? note.code}.pdf`,
      );
      toast.success('PDF descargado');
    } catch {
      toast.error('Error al descargar el PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (closureLoading || notesLoading) return <DetailSkeleton />;

  if (!closure) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <p className="font-medium">Cierre no encontrado</p>
        <Button variant="outline" asChild>
          <Link href="/cierres">Volver al listado</Link>
        </Button>
      </div>
    );
  }

  const canGenerate = closure.status === 'COMPLETED';

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* ── Cabecera ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={`/cierres/${id}`}>
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <FileTextIcon className="size-5 text-muted-foreground" />
            Albarán de entrega
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm text-muted-foreground font-mono">{closure.code}</span>
            <StatusBadge status={closure.status} />
          </div>
        </div>
      </div>

      {/* ── Albarán existente ── */}
      {activeNote && (
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircleIcon className="size-4" />
              Albarán generado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Código</dt>
              <dd className="font-mono font-medium">{activeNote.code}</dd>

              <dt className="text-muted-foreground">Estado</dt>
              <dd><StatusBadge status={activeNote.status} /></dd>

              <dt className="text-muted-foreground">Generado</dt>
              <dd className="tabular-nums">{formatDateTime(activeNote.createdAt)}</dd>
            </dl>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                onClick={() => void handleDownload(activeNote)}
                disabled={isDownloading}
                className="flex-1"
              >
                {isDownloading ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <DownloadIcon className="size-4" />
                )}
                Descargar PDF
              </Button>

              {canGenerate && (
                <Button
                  variant="outline"
                  onClick={() => void handleGenerate()}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <RefreshCwIcon className="size-4" />
                  )}
                  Regenerar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Sin albarán ── */}
      {!activeNote && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generar albarán</CardTitle>
            <CardDescription>
              El albarán estará disponible una vez el cierre esté en estado{' '}
              <strong>Completado</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canGenerate ? (
              <>
                <p className="text-sm text-muted-foreground">
                  El cierre está listo. Genera el albarán de entrega en PDF.
                </p>
                <Button
                  onClick={() => void handleGenerate()}
                  disabled={isGenerating}
                  size="lg"
                  className="w-full"
                >
                  {isGenerating ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <FileTextIcon className="size-4" />
                  )}
                  Generar albarán
                </Button>
              </>
            ) : (
              <div className="rounded-xl bg-muted/50 p-4 text-center text-sm text-muted-foreground space-y-1">
                <p>El albarán se podrá generar cuando el cierre esté completado.</p>
                <p className="text-xs">
                  Estado actual:{' '}
                  <StatusBadge status={closure.status} className="ml-1" />
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Historial de albaranes ── */}
      {notes.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Historial</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div className="text-sm">
                    <span className="font-mono">{note.code}</span>
                    <span className="ml-2 text-muted-foreground text-xs">
                      {formatDateTime(note.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={note.status} />
                    {note.status !== 'VOIDED' && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void handleDownload(note)}
                        disabled={isDownloading}
                      >
                        <DownloadIcon className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
