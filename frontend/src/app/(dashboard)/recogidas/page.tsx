'use client';

import Link from 'next/link';
import { TruckIcon, ExternalLinkIcon, PackageIcon } from 'lucide-react';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataTable } from '@/components/shared/data-table';
import { useCollections } from '@/hooks/use-collections';
import { formatDate, formatGrams } from '@/lib/formatters';
import type { CollectionStatus } from '@/types/api';
import type { ColumnDef } from '@tanstack/react-table';
import type { Collection } from '@/types/api';

// ── Columnas ───────────────────────────────────────────────────────────────────

const collectionColumns: ColumnDef<Collection>[] = [
  {
    id: 'status',
    header: 'Estado',
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <StatusBadge status={row.original.status} />
        {row.original.isPartial && (
          <span className="text-xs text-amber-600 dark:text-amber-400">Parcial</span>
        )}
      </div>
    ),
  },
  {
    id: 'collectedAt',
    header: 'Fecha',
    cell: ({ row }) => (
      <span className="text-sm tabular-nums">{formatDate(row.original.collectedAt)}</span>
    ),
  },
  {
    id: 'closure',
    header: 'Cierre',
    cell: ({ row }) => (
      <Link
        href={`/cierres/${row.original.closureId}`}
        className="flex items-center gap-1 text-sm font-mono hover:underline text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        {row.original.closureId.slice(0, 8)}…
        <ExternalLinkIcon className="size-3 opacity-60" />
      </Link>
    ),
  },
  {
    id: 'lines',
    header: 'Líneas / Gramos',
    cell: ({ row }) => {
      const lines = row.original.lines ?? [];
      const totalGrams = lines.reduce(
        (sum, l) => sum + parseFloat(l.gramsDeclared),
        0,
      );
      return (
        <div className="text-sm">
          <span className="font-medium">{lines.length}</span>
          <span className="text-muted-foreground"> línea{lines.length !== 1 ? 's' : ''}</span>
          {totalGrams > 0 && (
            <span className="ml-1.5 tabular-nums text-muted-foreground">
              · {formatGrams(totalGrams)} g
            </span>
          )}
        </div>
      );
    },
  },
  {
    id: 'collector',
    header: 'Recogedor',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.collector?.name ?? '—'}
      </span>
    ),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/cierres/${row.original.closureId}/recogidas/${row.original.id}`}>
          Ver detalle
        </Link>
      </Button>
    ),
  },
];

// ── Opciones de estado ─────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: CollectionStatus | ''; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'REGISTERED', label: 'Registrada' },
  { value: 'VALIDATED', label: 'Validada' },
  { value: 'WITH_INCIDENTS', label: 'Con incidencias' },
  { value: 'COMPLETED', label: 'Completada' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

// ── Parsers de URL ─────────────────────────────────────────────────────────────

const filterParsers = {
  status:   parseAsString.withDefault(''),
  dateFrom: parseAsString.withDefault(''),
  dateTo:   parseAsString.withDefault(''),
  page:     parseAsInteger.withDefault(1),
  limit:    parseAsInteger.withDefault(20),
};

// ── Página ─────────────────────────────────────────────────────────────────────

export default function RecogidaListPage() {
  const [filters, setFilters] = useQueryStates(filterParsers);

  const queryFilters = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
    ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
    page: filters.page,
    limit: filters.limit,
  };

  const { data, isLoading } = useCollections(queryFilters);
  const collections = data?.data ?? [];
  const meta = data?.meta;

  const hasFilters = !!filters.status || !!filters.dateFrom || !!filters.dateTo;

  return (
    <div className="space-y-5">
      {/* ── Cabecera ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TruckIcon className="size-5 text-muted-foreground" />
            Recogidas
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {meta
              ? `${meta.total} recogida${meta.total !== 1 ? 's' : ''} en total`
              : 'Cargando...'}
          </p>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Estado */}
        <Select
          value={filters.status || '_all'}
          onValueChange={(v) =>
            void setFilters({ status: v === '_all' ? '' : v, page: 1 })
          }
        >
          <SelectTrigger size="sm" className="w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value || '_all'} value={opt.value || '_all'}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Desde */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Desde</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => void setFilters({ dateFrom: e.target.value, page: 1 })}
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Hasta */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Hasta</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => void setFilters({ dateTo: e.target.value, page: 1 })}
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Limpiar */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              void setFilters({ status: '', dateFrom: '', dateTo: '', page: 1 })
            }
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* ── Tabla ── */}
      <DataTable
        data={collections}
        columns={collectionColumns}
        total={meta?.total}
        page={filters.page}
        limit={filters.limit}
        onPageChange={(p) => void setFilters({ page: p })}
        onLimitChange={(l) => void setFilters({ limit: l, page: 1 })}
        isLoading={isLoading}
        emptyMessage="No se encontraron recogidas"
      />
    </div>
  );
}
