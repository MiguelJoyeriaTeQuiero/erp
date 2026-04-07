'use client';

import Link from 'next/link';
import {
  ArchiveIcon,
  AlertTriangleIcon,
  TruckIcon,
  ClipboardCheckIcon,
  PlusIcon,
  UserPlusIcon,
  TrendingUpIcon,
  ArrowRightIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import { SpotPricesCard } from '@/components/dashboard/spot-prices-card';
import { TradingViewMiniChart } from '@/components/dashboard/tradingview-mini-chart';
import { useClosures } from '@/hooks/use-closures';
import { useIncidents } from '@/hooks/use-incidents';
import { useCollections } from '@/hooks/use-collections';
import { formatCurrency, formatRelative } from '@/lib/formatters';
import { cn } from '@/lib/utils';

// ── Tarjeta KPI ───────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  colorClass,
  href,
  isLoading,
}: {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  colorClass: string;
  href: string;
  isLoading: boolean;
}) {
  return (
    <Link href={href} className="block group">
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{label}</p>
              {isLoading ? (
                <div className="h-8 w-12 animate-pulse rounded-md bg-muted" />
              ) : (
                <p className="text-3xl font-bold tabular-nums">{value ?? '—'}</p>
              )}
            </div>
            <div className={cn('rounded-lg p-2.5', colorClass)}>
              <Icon className="size-5" />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
            Ver todos <ArrowRightIcon className="size-3" />
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  // KPIs — solo meta.total importa, limit=1 para pedir lo mínimo
  const { data: allClosures,         isLoading: l1 } = useClosures({ limit: 1 });
  const { data: openIncidents,       isLoading: l2 } = useIncidents({ status: 'OPEN', limit: 1 });
  const { data: regCollections,      isLoading: l3 } = useCollections({ status: 'REGISTERED', limit: 1 });
  const { data: pendingValidations,  isLoading: l4 } = useClosures({ status: 'PENDING_VALIDATION', limit: 1 });

  // Tabla de cierres recientes
  const { data: recentData, isLoading: recentLoading } = useClosures({
    limit: 8,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const recentClosures = recentData?.data ?? [];

  return (
    <div className="space-y-6">
      {/* ── Cabecera ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Resumen de actividad del sistema
        </p>
      </div>

      {/* ── Cotizaciones + Gráficos ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Precios del sistema (izquierda) */}
        <div className="lg:col-span-1">
          <SpotPricesCard />
        </div>

        {/* Gráficos TradingView (derecha, 2 columnas) */}
        <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-yellow-400 inline-block" />
                Oro — XAU/USD
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              <TradingViewMiniChart
                symbol="TVC:GOLD"
                trendColor="rgba(250, 204, 21, 1)"
                height={200}
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-slate-400 inline-block" />
                Plata — XAG/USD
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              <TradingViewMiniChart
                symbol="TVC:SILVER"
                trendColor="rgba(148, 163, 184, 1)"
                height={200}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total cierres"
          value={allClosures?.meta.total}
          icon={ArchiveIcon}
          colorClass="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
          href="/cierres"
          isLoading={l1}
        />
        <KpiCard
          label="Incidencias abiertas"
          value={openIncidents?.meta.total}
          icon={AlertTriangleIcon}
          colorClass="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
          href="/incidencias"
          isLoading={l2}
        />
        <KpiCard
          label="Recogidas registradas"
          value={regCollections?.meta.total}
          icon={TruckIcon}
          colorClass="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
          href="/recogidas"
          isLoading={l3}
        />
        <KpiCard
          label="Pendientes de validar"
          value={pendingValidations?.meta.total}
          icon={ClipboardCheckIcon}
          colorClass="bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400"
          href="/cierres"
          isLoading={l4}
        />
      </div>

      {/* ── Sección inferior ── */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* ── Cierres recientes ── */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Cierres recientes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/cierres">Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentLoading ? (
              <div className="space-y-2 px-6 pb-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : recentClosures.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground text-center py-8">
                No hay cierres registrados
              </p>
            ) : (
              <div className="divide-y">
                {recentClosures.map((closure) => (
                  <Link
                    key={closure.id}
                    href={`/cierres/${closure.id}`}
                    className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono font-medium group-hover:text-primary transition-colors">
                          {closure.code}
                        </span>
                        <StatusBadge status={closure.status} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {closure.client?.commercialName ?? '—'}
                      </p>
                    </div>
                    <div className="ml-4 text-right flex-shrink-0">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCurrency(closure.totalAmount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelative(closure.createdAt)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Accesos rápidos ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Accesos rápidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full justify-start" asChild>
              <Link href="/cierres/nuevo">
                <PlusIcon className="size-4" />
                Nuevo cierre
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/clientes/nuevo">
                <UserPlusIcon className="size-4" />
                Nuevo cliente
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/tarifas">
                <TrendingUpIcon className="size-4" />
                Ver tarifas actuales
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/incidencias">
                <AlertTriangleIcon className="size-4" />
                Gestionar incidencias
              </Link>
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
