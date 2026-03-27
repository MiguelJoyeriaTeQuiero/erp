'use client';

import Link from 'next/link';
import { AlertTriangleIcon, ExternalLinkIcon } from 'lucide-react';
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
import { useIncidents } from '@/hooks/use-incidents';
import { formatRelative } from '@/lib/formatters';
import type { IncidentType, IncidentStatus, Incident } from '@/types/api';
import type { ColumnDef } from '@tanstack/react-table';

// ── Labels de tipo/estado ─────────────────────────────────────────────────────

const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  INVALID_MATERIAL:        'Material inválido',
  PENDING_COLLECTION:      'Falta material',
  DIFFERENCE:              'Discrepancia gramos',
  SCRAP:                   'Chatarra detectada',
  PENDING_CONVERSION:      'Conversión pendiente',
  VALIDATION_DISCREPANCY:  'Discrepancia validación',
  ADVANCE_REFUND:          'Devolución adelanto',
};

const TYPE_OPTIONS: { value: IncidentType | ''; label: string }[] = [
  { value: '', label: 'Todos los tipos' },
  ...Object.entries(INCIDENT_TYPE_LABELS).map(([value, label]) => ({
    value: value as IncidentType,
    label,
  })),
];

const STATUS_OPTIONS: { value: IncidentStatus | ''; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'OPEN',        label: 'Abierta' },
  { value: 'IN_REVIEW',   label: 'En revisión' },
  { value: 'RESOLVED',    label: 'Resuelta' },
  { value: 'CANCELLED',   label: 'Cancelada' },
];

// ── Columnas ──────────────────────────────────────────────────────────────────

const incidentColumns: ColumnDef<Incident>[] = [
  {
    id: 'type',
    header: 'Tipo',
    cell: ({ row }) => (
      <span className="text-sm font-medium">
        {INCIDENT_TYPE_LABELS[row.original.type] ?? row.original.type}
      </span>
    ),
  },
  {
    id: 'status',
    header: 'Estado',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: 'reason',
    header: 'Motivo',
    cell: ({ row }) => (
      <p className="text-sm text-muted-foreground max-w-xs truncate">
        {row.original.reason}
      </p>
    ),
  },
  {
    id: 'closure',
    header: 'Cierre',
    cell: ({ row }) => (
      <Link
        href={`/cierres/${row.original.closureId}#incidencias`}
        className="flex items-center gap-1 text-sm font-mono hover:underline text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        {row.original.closureId.slice(0, 8)}…
        <ExternalLinkIcon className="size-3 opacity-60" />
      </Link>
    ),
  },
  {
    id: 'createdAt',
    header: 'Fecha',
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatRelative(row.original.createdAt)}
      </span>
    ),
  },
  {
    id: 'resolvedBy',
    header: 'Resuelto por',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.resolvedByUser?.name ?? '—'}
      </span>
    ),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/incidencias/${row.original.id}`}>Ver</Link>
      </Button>
    ),
  },
];

// ── Parsers de URL ─────────────────────────────────────────────────────────────

const filterParsers = {
  status:   parseAsString.withDefault(''),
  type:     parseAsString.withDefault(''),
  dateFrom: parseAsString.withDefault(''),
  dateTo:   parseAsString.withDefault(''),
  page:     parseAsInteger.withDefault(1),
  limit:    parseAsInteger.withDefault(20),
};

// ── Página ─────────────────────────────────────────────────────────────────────

export default function IncidenciasPage() {
  const [filters, setFilters] = useQueryStates(filterParsers);

  const queryFilters = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.type   ? { type: filters.type as IncidentType } : {}),
    ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
    ...(filters.dateTo   ? { dateTo: filters.dateTo } : {}),
    page:  filters.page,
    limit: filters.limit,
  };

  const { data, isLoading } = useIncidents(queryFilters);
  const incidents = data?.data ?? [];
  const meta = data?.meta;

  const hasFilters = !!filters.status || !!filters.type || !!filters.dateFrom || !!filters.dateTo;

  return (
    <div className="space-y-5">
      {/* ── Cabecera ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <AlertTriangleIcon className="size-5 text-muted-foreground" />
          Incidencias
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {meta
            ? `${meta.total} incidencia${meta.total !== 1 ? 's' : ''} en total`
            : 'Cargando...'}
        </p>
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

        {/* Tipo */}
        <Select
          value={filters.type || '_all'}
          onValueChange={(v) =>
            void setFilters({ type: v === '_all' ? '' : v, page: 1 })
          }
        >
          <SelectTrigger size="sm" className="w-52">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((opt) => (
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
              void setFilters({ status: '', type: '', dateFrom: '', dateTo: '', page: 1 })
            }
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* ── Tabla ── */}
      <DataTable
        data={incidents}
        columns={incidentColumns}
        total={meta?.total}
        page={filters.page}
        limit={filters.limit}
        onPageChange={(p) => void setFilters({ page: p })}
        onLimitChange={(l) => void setFilters({ limit: l, page: 1 })}
        isLoading={isLoading}
        emptyMessage="No se encontraron incidencias"
      />
    </div>
  );
}
