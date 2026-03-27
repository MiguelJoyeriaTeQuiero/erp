'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon, BanknoteIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import { DetailSkeleton } from '@/components/shared/loading-skeleton';
import { AdvancePanel } from '@/components/closures';
import { useClosure } from '@/hooks/use-closures';
import { useAuth } from '@/hooks/use-auth';
import { formatCurrency } from '@/lib/formatters';

export default function AdelantoCierrePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data: closure, isLoading } = useClosure(id);

  const canManage = user?.role === 'admin' || user?.role === 'oficina';

  if (isLoading) return <DetailSkeleton />;

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

  const totalAmount = parseFloat(closure.totalAmount);
  const maxAdvance  = totalAmount * 0.75;

  return (
    <div className="max-w-xl mx-auto space-y-5">
      {/* ── Cabecera ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={`/cierres/${id}`}>
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <BanknoteIcon className="size-5 text-muted-foreground" />
            Adelanto de pago
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm text-muted-foreground font-mono">{closure.code}</span>
            <StatusBadge status={closure.status} />
          </div>
        </div>
      </div>

      {/* ── Información del cierre ── */}
      <div className="rounded-xl border bg-muted/30 px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Total pactado</p>
          <p className="font-bold tabular-nums">{formatCurrency(totalAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Máximo adelanto (75%)</p>
          <p className="font-bold tabular-nums text-primary">{formatCurrency(maxAdvance)}</p>
        </div>
      </div>

      {/* ── Panel de adelanto ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adelanto</CardTitle>
          <CardDescription>
            Se puede registrar un único adelanto de hasta el 75% del total pactado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdvancePanel closure={closure} canManage={canManage} />
        </CardContent>
      </Card>

      {/* ── Enlace de retorno ── */}
      <div className="text-center">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/cierres/${id}`}>Volver al cierre</Link>
        </Button>
      </div>
    </div>
  );
}
