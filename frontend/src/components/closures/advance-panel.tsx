'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  BanknoteIcon,
  Loader2Icon,
  CheckCircleIcon,
  XCircleIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { GramsInput } from '@/components/shared/grams-input';
import { useAdvance, useCreateAdvance } from '@/hooks/use-advances';
import { formatCurrency, formatDate, formatPaymentMethod } from '@/lib/formatters';
import { ApiError } from '@/lib/api-client';
import type { Closure } from '@/types/api';

// ── Sub-componente: vista del adelanto existente ───────────────────────────────

function ExistingAdvance({
  amount,
  paymentMethod,
  createdAt,
  observations,
  cancelledAt,
}: {
  amount: string;
  paymentMethod: string;
  createdAt: string;
  observations: string | null;
  cancelledAt: string | null;
}) {
  const isCancelled = !!cancelledAt;
  return (
    <div className={['rounded-xl border p-4 space-y-3', isCancelled ? 'opacity-60' : ''].join(' ')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isCancelled ? (
            <XCircleIcon className="size-4 text-muted-foreground" />
          ) : (
            <CheckCircleIcon className="size-4 text-emerald-500" />
          )}
          <span className="text-sm font-medium">
            {isCancelled ? 'Adelanto cancelado' : 'Adelanto registrado'}
          </span>
        </div>
        <span className="text-lg font-bold tabular-nums">{formatCurrency(amount)}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">Método</span>
        <span>{formatPaymentMethod(paymentMethod)}</span>
        <span className="text-muted-foreground">Fecha</span>
        <span className="tabular-nums">{formatDate(createdAt)}</span>
        {isCancelled && (
          <>
            <span className="text-muted-foreground">Cancelado</span>
            <span className="tabular-nums">{formatDate(cancelledAt)}</span>
          </>
        )}
      </div>
      {observations && (
        <p className="text-xs text-muted-foreground border-t pt-2">{observations}</p>
      )}
    </div>
  );
}

// ── Sub-componente: formulario de creación de adelanto ─────────────────────────

function CreateAdvanceForm({
  closureId,
  maxAmount,
}: {
  closureId: string;
  maxAmount: number;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'CASH' | 'TRANSFER' | 'OTHER'>('CASH');
  const [observations, setObservations] = useState('');
  const createMutation = useCreateAdvance(closureId);

  const amountNum = parseFloat(amount.replace(',', '.'));
  const isOverLimit = !isNaN(amountNum) && amountNum > maxAmount;
  const isValid = !isNaN(amountNum) && amountNum > 0 && !isOverLimit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    try {
      await createMutation.mutateAsync({
        amount: amountNum.toFixed(2),
        paymentMethod: method,
        observations: observations.trim() || undefined,
      });
      toast.success('Adelanto registrado correctamente');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error al registrar el adelanto');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="advance-amount">
            Importe <span className="text-muted-foreground text-xs">(máx. {formatCurrency(maxAmount)})</span>
          </Label>
          <GramsInput
            id="advance-amount"
            value={amount}
            onChange={setAmount}
            placeholder="0,00"
            className={isOverLimit ? 'border-destructive' : ''}
          />
          {isOverLimit && (
            <p className="text-xs text-destructive">
              Supera el máximo permitido ({formatCurrency(maxAmount)})
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="advance-method">Método de pago</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
            <SelectTrigger id="advance-method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CASH">Efectivo</SelectItem>
              <SelectItem value="TRANSFER">Transferencia</SelectItem>
              <SelectItem value="OTHER">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="advance-obs">Observaciones (opcional)</Label>
        <Textarea
          id="advance-obs"
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          rows={2}
          placeholder="Notas adicionales..."
        />
      </div>

      <Button type="submit" disabled={!isValid || createMutation.isPending}>
        {createMutation.isPending && <Loader2Icon className="size-4 animate-spin" />}
        Registrar adelanto
      </Button>
    </form>
  );
}

// ── Panel principal ────────────────────────────────────────────────────────────

interface AdvancePanelProps {
  closure: Closure;
  canManage: boolean;
}

export function AdvancePanel({ closure, canManage }: AdvancePanelProps) {
  const { data: advance, isLoading } = useAdvance(closure.id);
  const totalAmount = parseFloat(closure.totalAmount);
  const maxAdvance = totalAmount * 0.75;

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 rounded-xl" />
      </div>
    );
  }

  // Adelanto activo existente
  if (advance) {
    return (
      <ExistingAdvance
        amount={advance.amount}
        paymentMethod={advance.paymentMethod}
        createdAt={advance.createdAt}
        observations={advance.observations}
        cancelledAt={advance.cancelledAt}
      />
    );
  }

  // Sin adelanto y puede crearlo
  const canCreate = canManage && closure.status === 'CONFIRMED';

  if (canCreate) {
    return <CreateAdvanceForm closureId={closure.id} maxAmount={maxAdvance} />;
  }

  // Sin adelanto y no puede crearlo
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
      <BanknoteIcon className="size-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Sin adelanto registrado</p>
      {canManage && closure.status !== 'CONFIRMED' && (
        <p className="text-xs text-muted-foreground">
          Solo es posible registrar un adelanto cuando el cierre está Confirmado.
        </p>
      )}
    </div>
  );
}
