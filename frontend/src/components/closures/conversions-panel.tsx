'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowRightIcon, CheckCircleIcon, XCircleIcon, Loader2Icon } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useClosureConversions, useApplyConversion, useRejectConversion } from '@/hooks/use-closures';
import { formatGrams, formatPurityPercent } from '@/lib/formatters';
import { ApiError } from '@/lib/api-client';
import type { Conversion } from '@/types/api';

// ── Dialog de rechazo (requiere observación) ───────────────────────────────────

function RejectDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (observation: string) => Promise<void>;
}) {
  const [observation, setObservation] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!observation.trim()) return;
    setLoading(true);
    try {
      await onConfirm(observation.trim());
      onOpenChange(false);
      setObservation('');
    } catch {
      // padre maneja el error
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <DialogContent className="max-w-sm" showCloseButton={!loading}>
        <DialogHeader>
          <DialogTitle>Rechazar conversión</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label htmlFor="conv-obs">Motivo de rechazo *</Label>
          <Textarea
            id="conv-obs"
            placeholder="Describe el motivo del rechazo..."
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            rows={3}
            disabled={loading}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!observation.trim() || loading}
          >
            {loading && <Loader2Icon className="size-4 animate-spin" />}
            Rechazar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Tarjeta de conversión ─────────────────────────────────────────────────────

function ConversionCard({
  conversion,
  closureId,
  canManage,
}: {
  conversion: Conversion;
  closureId: string;
  canManage: boolean;
}) {
  const [showReject, setShowReject] = useState(false);
  const applyMutation = useApplyConversion(closureId);
  const rejectMutation = useRejectConversion(closureId);

  const isPending = conversion.status === 'PENDING';

  const handleApply = async () => {
    try {
      await applyMutation.mutateAsync({ conversionId: conversion.id });
      toast.success('Conversión aplicada');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error al aplicar la conversión');
    }
  };

  const handleReject = async (observation: string) => {
    try {
      await rejectMutation.mutateAsync({ conversionId: conversion.id, data: { observation } });
      toast.success('Conversión rechazada');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error al rechazar la conversión');
      throw err;
    }
  };

  return (
    <>
      <div className="rounded-xl border bg-card p-4 space-y-3">
        {/* Cabecera: quilatajes y tipo */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">
              {conversion.sourceKarat?.label ?? '?'}
            </span>
            <ArrowRightIcon className="size-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold">
              {conversion.targetKarat?.label ?? '?'}
            </span>
            <span className="text-xs text-muted-foreground capitalize">
              ({conversion.conversionType === 'AUTOMATIC' ? 'automática' : 'manual'})
            </span>
          </div>
          <StatusBadge status={conversion.status} />
        </div>

        {/* Gramos */}
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Entregados</p>
            <p className="font-medium">{formatGrams(conversion.sourceGrams)}</p>
            <p className="text-xs text-muted-foreground">
              {formatPurityPercent(conversion.sourcePurity)}
            </p>
          </div>
          <div className="flex items-center justify-center">
            <ArrowRightIcon className="size-4 text-muted-foreground" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Equivalentes</p>
            <p className="font-medium">{formatGrams(conversion.equivalentGrams)}</p>
            <p className="text-xs text-muted-foreground">
              {formatPurityPercent(conversion.targetPurity)}
            </p>
          </div>
        </div>

        {/* Observación si existe */}
        {conversion.observation && (
          <p className="text-xs text-muted-foreground border-t pt-2 italic">
            {conversion.observation}
          </p>
        )}

        {/* Acciones si pendiente */}
        {isPending && canManage && (
          <div className="flex gap-2 pt-1 border-t">
            <Button
              size="sm"
              onClick={handleApply}
              disabled={applyMutation.isPending}
            >
              {applyMutation.isPending && <Loader2Icon className="size-3.5 animate-spin" />}
              <CheckCircleIcon className="size-3.5" />
              Aplicar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setShowReject(true)}
              disabled={rejectMutation.isPending}
            >
              <XCircleIcon className="size-3.5" />
              Rechazar
            </Button>
          </div>
        )}
      </div>

      <RejectDialog
        open={showReject}
        onOpenChange={setShowReject}
        onConfirm={handleReject}
      />
    </>
  );
}

// ── Panel principal ────────────────────────────────────────────────────────────

interface ConversionsPanelProps {
  closureId: string;
  canManage: boolean;
}

export function ConversionsPanel({ closureId, canManage }: ConversionsPanelProps) {
  const { data: conversions, isLoading } = useClosureConversions(closureId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }

  if (!conversions || conversions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
        <CheckCircleIcon className="size-5 text-emerald-500" />
        <p className="text-sm text-muted-foreground">Sin conversiones pendientes</p>
      </div>
    );
  }

  const pending = conversions.filter((c) => c.status === 'PENDING');
  const others = conversions.filter((c) => c.status !== 'PENDING');

  return (
    <div className="space-y-2">
      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">
            Pendientes de revisión ({pending.length})
          </p>
          {pending.map((c) => (
            <ConversionCard key={c.id} conversion={c} closureId={closureId} canManage={canManage} />
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Historial
          </p>
          {others.map((c) => (
            <ConversionCard key={c.id} conversion={c} closureId={closureId} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}
