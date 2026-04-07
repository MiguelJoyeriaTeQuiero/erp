'use client';

import Link from 'next/link';
import { TruckIcon, CheckCircleIcon, AlertTriangleIcon } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import { ListSkeleton } from '@/components/shared/loading-skeleton';
import { useClosureSummary } from '@/hooks/use-closures';
import { formatDate, formatGrams } from '@/lib/formatters';
import type { Collection, ReconciliationSummary } from '@/types/api';

// ── Barra de progreso ─────────────────────────────────────────────────────────

function ProgressBar({
  collectedGrams,
  agreedGrams,
}: {
  collectedGrams: number;
  agreedGrams: number;
}) {
  const pct = agreedGrams > 0 ? Math.min((collectedGrams / agreedGrams) * 100, 100) : 0;
  const isComplete = pct >= 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Recogido: {formatGrams(collectedGrams)}</span>
        <span>Pactado: {formatGrams(agreedGrams)}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={[
            'h-full rounded-full transition-all',
            isComplete ? 'bg-emerald-500' : 'bg-amber-500',
          ].join(' ')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-right text-muted-foreground">{pct.toFixed(0)}%</p>
    </div>
  );
}

// ── Tarjeta de recogida ────────────────────────────────────────────────────────

function CollectionCard({
  collection,
  closureId,
}: {
  collection: Collection;
  closureId: string;
}) {
  return (
    <Link
      href={`/cierres/${closureId}/recogidas/${collection.id}`}
      className="flex items-start gap-3 rounded-xl border bg-card p-3.5 hover:bg-muted/40 transition-colors"
    >
      <div className="shrink-0 rounded-lg bg-muted p-2 mt-0.5">
        <TruckIcon className="size-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <StatusBadge status={collection.status} />
          {collection.isPartial && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Parcial
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDate(collection.collectedAt)}
          {collection.collector && ` · ${collection.collector.name}`}
        </p>
        {collection.lines && collection.lines.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {collection.lines.map((line) => (
              <p key={line.id} className="text-xs text-muted-foreground">
                {line.metalType?.name ?? '—'}{' '}
                <span className="font-medium">{line.karat?.label ?? '—'}</span>
                {' · '}
                {formatGrams(line.gramsDeclared)} g
              </p>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Panel de resumen de conciliación ──────────────────────────────────────────

function ReconciliationSummaryCard({
  summary,
}: {
  summary: ReconciliationSummary;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        {summary.isFullyCollected ? (
          <CheckCircleIcon className="size-4 text-emerald-500" />
        ) : (
          <AlertTriangleIcon className="size-4 text-amber-500" />
        )}
        <span className="text-sm font-medium">
          {summary.isFullyCollected ? 'Material completamente recogido' : 'Recogida en progreso'}
        </span>
      </div>

      <div className="space-y-2">
        {summary.lines.map((line) => {
          const agreed = parseFloat(line.agreedGrams);
          const collected = parseFloat(line.collectedGrams);
          return (
            <div key={`${line.metalTypeId}-${line.karatId}`} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">
                  {line.metalLabel} {line.karatLabel}
                </span>
              </div>
              <ProgressBar collectedGrams={collected} agreedGrams={agreed} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Panel principal ────────────────────────────────────────────────────────────

interface CollectionsPanelProps {
  closureId: string;
  collections: Collection[];
  isLoading?: boolean;
}

export function CollectionsPanel({
  closureId,
  collections,
  isLoading = false,
}: CollectionsPanelProps) {
  const { data: summary } = useClosureSummary(closureId);

  if (isLoading) return <ListSkeleton items={2} />;

  if (collections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
        <TruckIcon className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Sin recogidas registradas</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumen de progreso */}
      {summary && <ReconciliationSummaryCard summary={summary} />}

      {/* Lista de recogidas */}
      <div className="space-y-2">
        {collections.map((collection) => (
          <CollectionCard
            key={collection.id}
            collection={collection}
            closureId={closureId}
          />
        ))}
      </div>
    </div>
  );
}
