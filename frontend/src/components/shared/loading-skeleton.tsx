import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// ── Skeleton de tabla ─────────────────────────────────────────────────────────

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5, columns = 4, className }: TableSkeletonProps) {
  return (
    <div className={cn('w-full space-y-0', className)}>
      {/* Header */}
      <div className="flex gap-3 border-b pb-2 mb-1">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 py-2.5 border-b last:border-0">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton
              key={j}
              className={cn('h-4 flex-1', j === 0 && 'max-w-[120px]', j === columns - 1 && 'max-w-[80px]')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Skeleton de tarjeta ───────────────────────────────────────────────────────

interface CardSkeletonProps {
  lines?: number;
  className?: string;
  showHeader?: boolean;
}

export function CardSkeleton({ lines = 3, showHeader = true, className }: CardSkeletonProps) {
  return (
    <div className={cn('rounded-xl border bg-card p-5 space-y-3', className)}>
      {showHeader && (
        <div className="space-y-1.5 pb-2 border-b">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-3.5 w-3/5" />
        </div>
      )}
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3.5 w-1/4" />
            <Skeleton className="h-3.5 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Skeleton de página de detalle ─────────────────────────────────────────────

interface DetailSkeletonProps {
  className?: string;
}

export function DetailSkeleton({ className }: DetailSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      {/* Secciones */}
      <div className="grid gap-4 md:grid-cols-2">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
      </div>

      <CardSkeleton lines={6} />
    </div>
  );
}

// ── Skeleton de lista ─────────────────────────────────────────────────────────

interface ListSkeletonProps {
  items?: number;
  className?: string;
}

export function ListSkeleton({ items = 4, className }: ListSkeletonProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <Skeleton className="size-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5 min-w-0">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-5 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ── Skeleton de estadísticas (KPI cards) ──────────────────────────────────────

interface StatsSkeletonProps {
  cards?: number;
  className?: string;
}

export function StatsSkeleton({ cards = 4, className }: StatsSkeletonProps) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5 space-y-2">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      ))}
    </div>
  );
}
