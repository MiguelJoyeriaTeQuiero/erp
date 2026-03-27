'use client';

import { use } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  PencilIcon,
  TrendingUpIcon,
  BanknoteIcon,
  WalletIcon,
  TruckIcon,
  ClipboardCheckIcon,
  AlertTriangleIcon,
  HistoryIcon,
  ArrowRightLeftIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/shared/status-badge';
import { DetailSkeleton } from '@/components/shared/loading-skeleton';
import {
  StatusActions,
  AdvancePanel,
  CollectionsPanel,
  IncidentsPanel,
  ConversionsPanel,
  AuditPanel,
} from '@/components/closures';
import { useClosure } from '@/hooks/use-closures';
import { useAuth } from '@/hooks/use-auth';
import { formatCurrency, formatDate, formatDateTime, formatGrams, formatPurityPercent } from '@/lib/formatters';
import type { ClosureLine } from '@/types/api';

// ── Tarjeta KPI económica ──────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={[
        'rounded-xl border p-4 space-y-1',
        highlight ? 'bg-primary text-primary-foreground border-primary' : 'bg-card',
      ].join(' ')}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="size-3.5 opacity-70" />
        <span className={['text-xs font-medium', highlight ? 'opacity-80' : 'text-muted-foreground'].join(' ')}>
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className={['text-xs', highlight ? 'opacity-70' : 'text-muted-foreground'].join(' ')}>{sub}</p>}
    </div>
  );
}

// ── Tabla de líneas (read-only) ────────────────────────────────────────────────

function LinesTable({ lines }: { lines: ClosureLine[] }) {
  if (lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">Sin líneas registradas</p>
    );
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="text-left pb-2 pr-4">Metal / Quilataje</th>
            <th className="text-right pb-2 pr-4">Gramos</th>
            <th className="text-right pb-2 pr-4">Pureza</th>
            <th className="text-right pb-2 pr-4">Precio/g</th>
            <th className="text-right pb-2">Importe</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {lines.map((line) => (
            <tr key={line.id} className="hover:bg-muted/30 transition-colors">
              <td className="py-3 pr-4 font-medium">
                {line.metalType?.name ?? '—'}{' '}
                <span className="text-muted-foreground">{line.karat?.label ?? '—'}</span>
              </td>
              <td className="py-3 pr-4 text-right tabular-nums">
                {formatGrams(line.grams)}
              </td>
              <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                {formatPurityPercent(line.puritySnapshot)}
              </td>
              <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                {formatCurrency(line.pricePerGram)}/g
              </td>
              <td className="py-3 text-right tabular-nums font-semibold">
                {formatCurrency(line.lineAmount)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t font-bold">
            <td className="pt-3" colSpan={4}>Total pactado</td>
            <td className="pt-3 text-right tabular-nums">
              {formatCurrency(
                lines.reduce((s, l) => s + parseFloat(l.lineAmount), 0),
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function CierreDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data: closure, isLoading } = useClosure(id);

  const canManage = user?.role === 'admin' || user?.role === 'oficina';
  const canValidate = user?.role === 'admin' || user?.role === 'validador';
  const isDraft = closure?.status === 'DRAFT';

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
  const advanceAmount = parseFloat(closure.advanceAmount);
  const finalAmount = parseFloat(closure.finalAmount);
  const hasAdvance = advanceAmount > 0;

  const incidentCount = closure.incidents?.filter(
    (i) => i.status === 'OPEN' || i.status === 'IN_REVIEW',
  ).length ?? 0;

  return (
    <div className="space-y-5">
      {/* ── Cabecera ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon-sm" className="mt-1" asChild>
            <Link href="/cierres">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight font-mono">
                {closure.code}
              </h1>
              <StatusBadge status={closure.status} />
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap text-sm text-muted-foreground">
              {closure.client && (
                <Link
                  href={`/clientes/${closure.clientId}`}
                  className="hover:text-foreground transition-colors font-medium"
                >
                  {closure.client.commercialName}
                </Link>
              )}
              <span>·</span>
              <span>{formatDate(closure.createdAt)}</span>
              {closure.confirmedAt && (
                <>
                  <span>·</span>
                  <span>Confirmado {formatDate(closure.confirmedAt)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Botón editar si borrador */}
        {isDraft && canManage && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/cierres/${id}/editar`}>
              <PencilIcon className="size-4" />
              Editar borrador
            </Link>
          </Button>
        )}
      </div>

      {/* ── KPIs económicos ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          icon={TrendingUpIcon}
          label="Total pactado"
          value={formatCurrency(totalAmount)}
          sub={`${(closure.lines?.length ?? 0)} líneas`}
        />
        {hasAdvance && (
          <KpiCard
            icon={BanknoteIcon}
            label="Adelanto"
            value={formatCurrency(advanceAmount)}
            sub={`${((advanceAmount / totalAmount) * 100).toFixed(0)}% del total`}
          />
        )}
        <KpiCard
          icon={WalletIcon}
          label="Pendiente de pago"
          value={formatCurrency(finalAmount)}
          highlight={closure.status === 'COMPLETED'}
          sub={closure.status === 'COMPLETED' ? 'Operación completada' : undefined}
        />
        {incidentCount > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50/40 dark:bg-red-900/10 p-4 space-y-1 col-span-1">
            <div className="flex items-center gap-1.5">
              <AlertTriangleIcon className="size-3.5 text-red-500" />
              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                Incidencias activas
              </span>
            </div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{incidentCount}</p>
          </div>
        )}
      </div>

      {/* ── Acciones contextuales ── */}
      <StatusActions closure={closure} userRole={user?.role ?? ''} />

      {/* ── Tabs principales ── */}
      <Tabs defaultValue="lines">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="lines">
            Líneas pactadas
          </TabsTrigger>
          <TabsTrigger value="operation">
            <TruckIcon className="size-3.5 mr-1" />
            Recogida
            {(closure.collections?.length ?? 0) > 0 && (
              <span className="ml-1 text-xs opacity-70">
                ({closure.collections!.length})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="incidents" id="incidencias">
            <AlertTriangleIcon className="size-3.5 mr-1" />
            Incidencias
            {incidentCount > 0 && (
              <span className="ml-1 rounded-full bg-red-500 text-white text-[10px] px-1.5">
                {incidentCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit">
            <HistoryIcon className="size-3.5 mr-1" />
            Auditoría
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Líneas ── */}
        <TabsContent value="lines" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Material pactado</CardTitle>
            </CardHeader>
            <CardContent>
              <LinesTable lines={closure.lines ?? []} />
            </CardContent>
          </Card>

          {/* Adelanto */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BanknoteIcon className="size-4 text-muted-foreground" />
                Adelanto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AdvancePanel closure={closure} canManage={canManage} />
            </CardContent>
          </Card>

          {/* Observaciones */}
          {closure.observations && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Observaciones</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {closure.observations}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Metadatos */}
          {closure.cancelledAt && (
            <Card className="border-destructive/30">
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-destructive">
                  Cancelado {formatDateTime(closure.cancelledAt)}
                </p>
                {closure.cancellationReason && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Motivo: {closure.cancellationReason}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab: Recogida / Operación ── */}
        <TabsContent value="operation" className="mt-4 space-y-4">
          {/* Recogidas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TruckIcon className="size-4 text-muted-foreground" />
                Recogidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CollectionsPanel
                closureId={id}
                collections={closure.collections ?? []}
              />
            </CardContent>
          </Card>

          {/* Conversiones */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRightLeftIcon className="size-4 text-muted-foreground" />
                Conversiones de quilataje
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ConversionsPanel
                closureId={id}
                canManage={canManage || canValidate}
              />
            </CardContent>
          </Card>

          {/* Validación */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardCheckIcon className="size-4 text-muted-foreground" />
                  Validación
                </CardTitle>
                {(canManage || canValidate) &&
                  (closure.status === 'PENDING_VALIDATION' ||
                    closure.status === 'IN_VALIDATION') && (
                    <Button size="sm" asChild>
                      <Link href={`/cierres/${id}/validacion`}>
                        {closure.status === 'IN_VALIDATION'
                          ? 'Continuar validación'
                          : 'Iniciar validación'}
                      </Link>
                    </Button>
                  )}
              </div>
            </CardHeader>
            <CardContent>
              {!closure.collections?.some((c) =>
                ['VALIDATED', 'WITH_INCIDENTS', 'COMPLETED'].includes(c.status),
              ) ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  La validación se habilitará cuando haya material recogido
                </p>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Ver estado de validación en{' '}
                  <Link
                    href={`/cierres/${id}/validacion`}
                    className="underline underline-offset-2"
                  >
                    la pantalla de validación
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Incidencias ── */}
        <TabsContent value="incidents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangleIcon className="size-4 text-muted-foreground" />
                Incidencias
              </CardTitle>
            </CardHeader>
            <CardContent>
              <IncidentsPanel
                closureId={id}
                canManage={canManage || canValidate}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Auditoría ── */}
        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HistoryIcon className="size-4 text-muted-foreground" />
                Registro de actividad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AuditPanel closureId={id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
