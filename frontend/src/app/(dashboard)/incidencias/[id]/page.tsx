'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeftIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  Loader2Icon,
  CalendarIcon,
  UserIcon,
  FileTextIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/shared/status-badge';
import { DetailSkeleton } from '@/components/shared/loading-skeleton';
import { useIncident, useResolveIncident, useCancelIncident } from '@/hooks/use-incidents';
import { useClosure } from '@/hooks/use-closures';
import { formatDateTime, formatRelative } from '@/lib/formatters';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { IncidentType } from '@/types/api';

// ── Labels ────────────────────────────────────────────────────────────────────

const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  INVALID_MATERIAL:        'Material inválido',
  PENDING_COLLECTION:      'Falta material',
  DIFFERENCE:              'Discrepancia en gramos',
  SCRAP:                   'Chatarra detectada',
  PENDING_CONVERSION:      'Conversión pendiente',
  VALIDATION_DISCREPANCY:  'Discrepancia en validación',
  ADVANCE_REFUND:          'Devolución de adelanto',
};

// ── Fila de detalle ────────────────────────────────────────────────────────────

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-1 items-start py-2.5 border-b last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function IncidenciaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: incident, isLoading } = useIncident(id);
  const { data: closure } = useClosure(incident?.closureId ?? '');

  const resolveMutation = useResolveIncident(incident?.closureId);
  const cancelMutation  = useCancelIncident(incident?.closureId);

  const [resolution, setResolution] = useState('');

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleResolve = async () => {
    if (!resolution.trim()) return;
    try {
      await resolveMutation.mutateAsync({ id, data: { resolution: resolution.trim() } });
      toast.success('Incidencia marcada como resuelta');
      setResolution('');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error al resolver');
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(id);
      toast.success('Incidencia cancelada');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error al cancelar');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) return <DetailSkeleton />;

  if (!incident) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <p className="font-medium">Incidencia no encontrada</p>
        <Button variant="outline" asChild>
          <Link href="/incidencias">Volver al listado</Link>
        </Button>
      </div>
    );
  }

  const isOpen = incident.status === 'OPEN' || incident.status === 'IN_REVIEW';
  const typeLabel = INCIDENT_TYPE_LABELS[incident.type] ?? incident.type;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* ── Cabecera ── */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon-sm" className="mt-1" asChild>
          <Link href="/incidencias">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <AlertTriangleIcon
                className={cn('size-5', isOpen ? 'text-red-500' : 'text-muted-foreground')}
              />
              {typeLabel}
            </h1>
            <StatusBadge status={incident.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatRelative(incident.createdAt)}
          </p>
        </div>
      </div>

      {/* ── Detalles ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información de la incidencia</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <InfoRow label="Tipo">{typeLabel}</InfoRow>
            <InfoRow label="Estado">
              <StatusBadge status={incident.status} />
            </InfoRow>
            <InfoRow label="Cierre">
              {closure ? (
                <Link
                  href={`/cierres/${incident.closureId}#incidencias`}
                  className="inline-flex items-center gap-1 font-mono hover:underline text-primary"
                >
                  <FileTextIcon className="size-3.5" />
                  {closure.code}
                </Link>
              ) : (
                <span className="font-mono text-xs">{incident.closureId.slice(0, 8)}…</span>
              )}
            </InfoRow>
            <InfoRow label="Creada por">
              <div className="flex items-center gap-1.5">
                <UserIcon className="size-3.5 text-muted-foreground" />
                {incident.createdByUser?.name ?? '—'}
              </div>
            </InfoRow>
            <InfoRow label="Fecha">
              <div className="flex items-center gap-1.5">
                <CalendarIcon className="size-3.5 text-muted-foreground" />
                {formatDateTime(incident.createdAt)}
              </div>
            </InfoRow>
          </dl>
        </CardContent>
      </Card>

      {/* ── Motivo ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Motivo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{incident.reason}</p>
        </CardContent>
      </Card>

      {/* ── Resolución existente ── */}
      {incident.resolution && (
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircleIcon className="size-4" />
              Resolución
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm whitespace-pre-wrap">{incident.resolution}</p>
            {incident.resolvedByUser && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t">
                <span>Por {incident.resolvedByUser.name}</span>
                {incident.resolvedAt && <span>{formatDateTime(incident.resolvedAt)}</span>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Formulario de resolución (si está abierta) ── */}
      {isOpen && (
        <>
          <Separator />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resolver incidencia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="resolution">
                  Descripción de la resolución <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="resolution"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  rows={4}
                  placeholder="Describe cómo se ha resuelto la incidencia..."
                  disabled={resolveMutation.isPending}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => void handleResolve()}
                  disabled={!resolution.trim() || resolveMutation.isPending}
                  className="sm:ml-auto"
                >
                  {resolveMutation.isPending && <Loader2Icon className="size-4 animate-spin" />}
                  <CheckCircleIcon className="size-4" />
                  Marcar como resuelta
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => void handleCancel()}
                  disabled={cancelMutation.isPending}
                  className="text-muted-foreground"
                >
                  {cancelMutation.isPending && <Loader2Icon className="size-4 animate-spin" />}
                  <XCircleIcon className="size-4" />
                  Cancelar incidencia
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
