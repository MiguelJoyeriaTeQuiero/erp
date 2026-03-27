'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  Loader2Icon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/status-badge';
import { ListSkeleton } from '@/components/shared/loading-skeleton';
import { useIncidents, useResolveIncident, useCancelIncident } from '@/hooks/use-incidents';
import { formatDate, formatRelative } from '@/lib/formatters';
import { ApiError } from '@/lib/api-client';
import type { IncidentType } from '@/types/api';

// ── Labels de tipos de incidencia ─────────────────────────────────────────────

const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  INVALID_MATERIAL: 'Material inválido',
  PENDING_COLLECTION: 'Falta material',
  DIFFERENCE: 'Discrepancia en gramos',
  SCRAP: 'Chatarra detectada',
  PENDING_CONVERSION: 'Conversión pendiente',
  VALIDATION_DISCREPANCY: 'Discrepancia en validación',
  ADVANCE_REFUND: 'Devolución de adelanto',
};

// ── Dialog de resolución ───────────────────────────────────────────────────────

function ResolveDialog({
  incidentId,
  closureId,
  open,
  onOpenChange,
}: {
  incidentId: string;
  closureId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [resolution, setResolution] = useState('');
  const resolveMutation = useResolveIncident(closureId);

  const handleSubmit = async () => {
    if (!resolution.trim()) return;
    try {
      await resolveMutation.mutateAsync({ id: incidentId, data: { resolution: resolution.trim() } });
      toast.success('Incidencia resuelta');
      onOpenChange(false);
      setResolution('');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error al resolver la incidencia');
    }
  };

  return (
    <Dialog open={open} onOpenChange={resolveMutation.isPending ? undefined : onOpenChange}>
      <DialogContent className="max-w-sm" showCloseButton={!resolveMutation.isPending}>
        <DialogHeader>
          <DialogTitle>Resolver incidencia</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label htmlFor="resolution">Resolución *</Label>
          <Textarea
            id="resolution"
            placeholder="Describe cómo se ha resuelto la incidencia..."
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={3}
            disabled={resolveMutation.isPending}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={resolveMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!resolution.trim() || resolveMutation.isPending}
          >
            {resolveMutation.isPending && <Loader2Icon className="size-4 animate-spin" />}
            Marcar como resuelta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Panel principal ────────────────────────────────────────────────────────────

interface IncidentsPanelProps {
  closureId: string;
  canManage: boolean;
}

export function IncidentsPanel({ closureId, canManage }: IncidentsPanelProps) {
  const { data, isLoading } = useIncidents({ closureId });
  const cancelMutation = useCancelIncident(closureId);
  const [resolveTarget, setResolveTarget] = useState<string | null>(null);
  const incidents = data?.data ?? [];

  if (isLoading) return <ListSkeleton items={2} />;

  if (incidents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
        <CheckCircleIcon className="size-6 text-emerald-500" />
        <p className="text-sm font-medium">Sin incidencias</p>
        <p className="text-xs text-muted-foreground">Todo en orden</p>
      </div>
    );
  }

  const handleCancel = async (id: string) => {
    try {
      await cancelMutation.mutateAsync(id);
      toast.success('Incidencia cancelada');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error al cancelar');
    }
  };

  return (
    <div className="space-y-2">
      {incidents.map((incident) => {
        const isOpen = incident.status === 'OPEN' || incident.status === 'IN_REVIEW';
        return (
          <div
            key={incident.id}
            className={[
              'rounded-xl border p-4 space-y-2',
              isOpen ? 'border-red-200 bg-red-50/30 dark:border-red-900/30 dark:bg-red-900/10' : '',
            ].join(' ')}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <AlertTriangleIcon
                  className={['size-4 shrink-0', isOpen ? 'text-red-500' : 'text-muted-foreground'].join(' ')}
                />
                <span className="text-sm font-medium">
                  {INCIDENT_TYPE_LABELS[incident.type as IncidentType] ?? incident.type}
                </span>
                <StatusBadge status={incident.status} />
              </div>
              <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                {formatRelative(incident.createdAt)}
              </span>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">{incident.reason}</p>

            {incident.resolution && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 border border-emerald-200 dark:border-emerald-800">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-0.5">
                  Resolución
                </p>
                <p className="text-sm text-emerald-800 dark:text-emerald-300">
                  {incident.resolution}
                </p>
              </div>
            )}

            {isOpen && canManage && (
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setResolveTarget(incident.id)}
                >
                  <CheckCircleIcon className="size-3.5" />
                  Resolver
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => handleCancel(incident.id)}
                  disabled={cancelMutation.isPending}
                >
                  <XCircleIcon className="size-3.5" />
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {/* Dialog de resolución */}
      {resolveTarget && (
        <ResolveDialog
          incidentId={resolveTarget}
          closureId={closureId}
          open={!!resolveTarget}
          onOpenChange={(v) => { if (!v) setResolveTarget(null); }}
        />
      )}
    </div>
  );
}
