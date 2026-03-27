'use client';

import { use } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  TruckIcon,
  CalendarIcon,
  UserIcon,
  PackageIcon,
  ArrowRightLeftIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/shared/status-badge';
import { DetailSkeleton } from '@/components/shared/loading-skeleton';
import { useCollection } from '@/hooks/use-collections';
import { useClosureConversions } from '@/hooks/use-closures';
import { formatDate, formatDateTime, formatGrams, formatPurityPercent } from '@/lib/formatters';

// ── Tabla de líneas de recogida ────────────────────────────────────────────────

function CollectionLinesTable({
  lines,
}: {
  lines: NonNullable<ReturnType<typeof useCollection>['data']>['lines'];
}) {
  if (!lines || lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Sin líneas registradas
      </p>
    );
  }

  const totalGrams = lines.reduce((sum, l) => sum + parseFloat(l.gramsDeclared), 0);

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm min-w-[400px]">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="text-left pb-2 pr-4">Metal / Quilataje</th>
            <th className="text-right pb-2 pr-4">Gramos</th>
            <th className="text-right pb-2">Pureza</th>
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
                {formatGrams(line.gramsDeclared)}
              </td>
              <td className="py-3 text-right tabular-nums text-muted-foreground">
                {formatPurityPercent(line.puritySnapshot)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t font-bold">
            <td className="pt-3">Total entregado</td>
            <td className="pt-3 text-right tabular-nums">{formatGrams(totalGrams)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function RecogidaDetallePage({
  params,
}: {
  params: Promise<{ id: string; recogidaId: string }>;
}) {
  const { id, recogidaId } = use(params);
  const { data: collection, isLoading } = useCollection(recogidaId);

  // Conversiones asociadas a las líneas de esta recogida
  const { data: conversions = [] } = useClosureConversions(id);
  const collectionLineIds = new Set(collection?.lines?.map((l) => l.id) ?? []);
  const relatedConversions = conversions.filter(
    (c) => collectionLineIds.has(c.collectionLineId),
  );

  if (isLoading) return <DetailSkeleton />;

  if (!collection) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <p className="font-medium">Recogida no encontrada</p>
        <Button variant="outline" asChild>
          <Link href={`/cierres/${id}`}>Volver al cierre</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Cabecera ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon-sm" className="mt-1" asChild>
            <Link href={`/cierres/${id}`}>
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <TruckIcon className="size-5 text-muted-foreground" />
                Recogida
              </h1>
              <StatusBadge status={collection.status} />
              {collection.isPartial && (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  Parcial
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              <Link
                href={`/cierres/${id}`}
                className="hover:text-foreground transition-colors font-medium"
              >
                Cierre {id.slice(0, 8)}…
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* ── Metadatos ── */}
      <Card>
        <CardContent className="pt-4">
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-start gap-2.5">
              <CalendarIcon className="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <dt className="text-xs text-muted-foreground">Fecha de recogida</dt>
                <dd className="text-sm font-medium mt-0.5">{formatDate(collection.collectedAt)}</dd>
              </div>
            </div>

            {collection.collector && (
              <div className="flex items-start gap-2.5">
                <UserIcon className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <dt className="text-xs text-muted-foreground">Recogedor</dt>
                  <dd className="text-sm font-medium mt-0.5">{collection.collector.name}</dd>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2.5">
              <PackageIcon className="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <dt className="text-xs text-muted-foreground">Líneas</dt>
                <dd className="text-sm font-medium mt-0.5">
                  {collection.lines?.length ?? 0} línea(s)
                </dd>
              </div>
            </div>
          </dl>

          {collection.observations && (
            <>
              <Separator className="my-4" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Observaciones</p>
                <p className="text-sm whitespace-pre-wrap">{collection.observations}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Líneas entregadas ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PackageIcon className="size-4 text-muted-foreground" />
            Material entregado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CollectionLinesTable lines={collection.lines} />
        </CardContent>
      </Card>

      {/* ── Conversiones relacionadas ── */}
      {relatedConversions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRightLeftIcon className="size-4 text-muted-foreground" />
              Conversiones de quilataje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {relatedConversions.map((conv) => (
                <div
                  key={conv.id}
                  className="flex items-center justify-between rounded-xl border p-3"
                >
                  <div className="flex items-center gap-2.5 text-sm">
                    <span className="font-medium">
                      {conv.sourceKarat?.label ?? '—'}
                    </span>
                    <ArrowRightLeftIcon className="size-3.5 text-muted-foreground" />
                    <span className="font-medium">
                      {conv.targetKarat?.label ?? '—'}
                    </span>
                  </div>
                  <div className="text-right text-sm">
                    <p className="tabular-nums">
                      {formatGrams(conv.sourceGrams)} g →{' '}
                      <span className="font-semibold">{formatGrams(conv.equivalentGrams)} g eq.</span>
                    </p>
                    <StatusBadge status={conv.status} className="mt-0.5" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Metadatos secundarios ── */}
      <p className="text-xs text-muted-foreground text-center">
        Registrada {formatDateTime(collection.createdAt)}
      </p>
    </div>
  );
}
