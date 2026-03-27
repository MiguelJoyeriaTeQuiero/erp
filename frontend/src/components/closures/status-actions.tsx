'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  CheckCircleIcon,
  XCircleIcon,
  TruckIcon,
  ClipboardCheckIcon,
  BanknoteIcon,
  Loader2Icon,
  FlagIcon,
  FileTextIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  useConfirmClosure,
  useCancelClosure,
  useCompleteClosure,
} from '@/hooks/use-closures';
import { ApiError } from '@/lib/api-client';
import type { Closure } from '@/types/api';

// ── Dialog de cancelación (requiere motivo) ────────────────────────────────────

interface CancelDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
}

function CancelDialog({ open, onOpenChange, onConfirm }: CancelDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      await onConfirm(reason.trim());
      onOpenChange(false);
      setReason('');
    } catch {
      // El padre maneja el error
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <DialogContent className="max-w-sm" showCloseButton={!loading}>
        <DialogHeader>
          <DialogTitle>Cancelar cierre</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label htmlFor="cancel-reason">Motivo de cancelación *</Label>
          <Textarea
            id="cancel-reason"
            placeholder="Indica el motivo de la cancelación..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            disabled={loading}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Volver
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!reason.trim() || loading}
          >
            {loading && <Loader2Icon className="size-4 animate-spin" />}
            Confirmar cancelación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

interface StatusActionsProps {
  closure: Closure;
  userRole: string;
}

export function StatusActions({ closure, userRole }: StatusActionsProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  const confirmMutation = useConfirmClosure(closure.id);
  const cancelMutation = useCancelClosure(closure.id);
  const completeMutation = useCompleteClosure(closure.id);

  const canManage = userRole === 'admin' || userRole === 'oficina';
  const { status } = closure;

  // ── Handlers ──

  const handleConfirm = async () => {
    try {
      await confirmMutation.mutateAsync();
      toast.success(`Cierre ${closure.code} confirmado. Precios congelados.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error al confirmar');
      throw err;
    }
  };

  const handleCancel = async (reason: string) => {
    try {
      await cancelMutation.mutateAsync({ reason });
      toast.success(`Cierre ${closure.code} cancelado`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error al cancelar');
      throw err;
    }
  };

  const handleComplete = async () => {
    try {
      await completeMutation.mutateAsync();
      toast.success(`Cierre ${closure.code} completado correctamente`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error al completar');
      throw err;
    }
  };

  // ── Calcular acciones disponibles según estado ──

  const actions: React.ReactNode[] = [];

  if (!canManage) {
    // Rol sin permisos de escritura
    return null;
  }

  switch (status) {
    case 'DRAFT':
      actions.push(
        <Button key="confirm" onClick={() => setShowConfirm(true)}>
          <CheckCircleIcon className="size-4" />
          Confirmar cierre
        </Button>,
        <Button
          key="cancel"
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setShowCancel(true)}
        >
          <XCircleIcon className="size-4" />
          Cancelar
        </Button>,
      );
      break;

    case 'CONFIRMED':
      actions.push(
        <Button key="advance" variant="outline" asChild>
          <Link href={`/cierres/${closure.id}/adelanto`}>
            <BanknoteIcon className="size-4" />
            Registrar adelanto
          </Link>
        </Button>,
        <Button key="collection" asChild>
          <Link href={`/cierres/${closure.id}/recogidas/nueva`}>
            <TruckIcon className="size-4" />
            Nueva recogida
          </Link>
        </Button>,
        <Button
          key="cancel"
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setShowCancel(true)}
        >
          <XCircleIcon className="size-4" />
          Cancelar
        </Button>,
      );
      break;

    case 'WITH_ADVANCE':
      actions.push(
        <Button key="collection" asChild>
          <Link href={`/cierres/${closure.id}/recogidas/nueva`}>
            <TruckIcon className="size-4" />
            Nueva recogida
          </Link>
        </Button>,
        <Button
          key="cancel"
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setShowCancel(true)}
        >
          <XCircleIcon className="size-4" />
          Cancelar
        </Button>,
      );
      break;

    case 'PENDING_COLLECTION':
    case 'PARTIAL_COLLECTION':
      actions.push(
        <Button key="collection" asChild>
          <Link href={`/cierres/${closure.id}/recogidas/nueva`}>
            <TruckIcon className="size-4" />
            Añadir recogida
          </Link>
        </Button>,
        <Button
          key="cancel"
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setShowCancel(true)}
        >
          <XCircleIcon className="size-4" />
          Cancelar
        </Button>,
      );
      break;

    case 'PENDING_VALIDATION':
    case 'IN_VALIDATION':
      actions.push(
        <Button key="validation" asChild>
          <Link href={`/cierres/${closure.id}/validacion`}>
            <ClipboardCheckIcon className="size-4" />
            {status === 'PENDING_VALIDATION' ? 'Iniciar validación' : 'Ver validación'}
          </Link>
        </Button>,
        <Button
          key="cancel"
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setShowCancel(true)}
        >
          <XCircleIcon className="size-4" />
          Cancelar
        </Button>,
      );
      break;

    case 'WITH_INCIDENTS':
      actions.push(
        <Button key="incidents" variant="outline" asChild>
          <Link href={`#incidencias`}>
            <FlagIcon className="size-4" />
            Ver incidencias
          </Link>
        </Button>,
        <Button
          key="cancel"
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setShowCancel(true)}
        >
          <XCircleIcon className="size-4" />
          Cancelar
        </Button>,
      );
      break;

    case 'VALIDATED':
      actions.push(
        <Button key="complete" onClick={() => setShowComplete(true)}>
          <CheckCircleIcon className="size-4" />
          Completar operación
        </Button>,
        <Button
          key="cancel"
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setShowCancel(true)}
        >
          <XCircleIcon className="size-4" />
          Cancelar
        </Button>,
      );
      break;

    case 'COMPLETED':
      actions.push(
        <Button key="albaran" variant="outline" asChild>
          <Link href={`/cierres/${closure.id}/albaran`}>
            <FileTextIcon className="size-4" />
            Ver albarán
          </Link>
        </Button>,
      );
      break;

    default:
      break;
  }

  if (actions.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="¿Confirmar cierre?"
        description="Los precios se congelarán en este momento. El cierre no podrá editarse después."
        confirmLabel="Confirmar cierre"
        onConfirm={handleConfirm}
      />

      <CancelDialog
        open={showCancel}
        onOpenChange={setShowCancel}
        onConfirm={handleCancel}
      />

      <ConfirmDialog
        open={showComplete}
        onOpenChange={setShowComplete}
        title="¿Completar operación?"
        description="El cierre quedará marcado como COMPLETADO. Esta acción es irreversible."
        confirmLabel="Completar"
        onConfirm={handleComplete}
      />
    </>
  );
}
