'use client';

import { HistoryIcon } from 'lucide-react';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/shared/data-table';
import { useAuditLogs } from '@/hooks/use-audit';
import { formatDateTime } from '@/lib/formatters';
import type { AuditLog, AuditAction } from '@/types/api';
import type { ColumnDef } from '@tanstack/react-table';

// ── Labels ────────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE:   'Creación',
  UPDATE:   'Actualización',
  DELETE:   'Eliminación',
  CONFIRM:  'Confirmación',
  CANCEL:   'Cancelación',
  APPROVE:  'Aprobación',
  REJECT:   'Rechazo',
  UPLOAD:   'Subida de documento',
  DOWNLOAD: 'Descarga',
  CONVERT:  'Conversión',
};

const ACTION_COLORS: Record<AuditAction, string> = {
  CREATE:   'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
  UPDATE:   'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  DELETE:   'text-red-600 bg-red-50 dark:bg-red-900/20',
  CONFIRM:  'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
  CANCEL:   'text-red-600 bg-red-50 dark:bg-red-900/20',
  APPROVE:  'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
  REJECT:   'text-red-600 bg-red-50 dark:bg-red-900/20',
  UPLOAD:   'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  DOWNLOAD: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  CONVERT:  'text-violet-600 bg-violet-50 dark:bg-violet-900/20',
};

const ENTITY_TYPE_OPTIONS = [
  '', 'Closure', 'Collection', 'Incident', 'Validation', 'Client', 'User', 'PriceRate',
];

const ACTION_OPTIONS: { value: AuditAction | ''; label: string }[] = [
  { value: '', label: 'Todas las acciones' },
  ...Object.entries(ACTION_LABELS).map(([value, label]) => ({
    value: value as AuditAction,
    label,
  })),
];

// ── Columnas ──────────────────────────────────────────────────────────────────

const auditColumns: ColumnDef<AuditLog>[] = [
  {
    id: 'action',
    header: 'Acción',
    cell: ({ row }) => {
      const action = row.original.action;
      const label = ACTION_LABELS[action] ?? action;
      const colorClass = ACTION_COLORS[action] ?? 'text-muted-foreground bg-muted';
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
          {label}
        </span>
      );
    },
  },
  {
    id: 'entityType',
    header: 'Entidad',
    cell: ({ row }) => (
      <div className="text-sm">
        <span className="font-medium">{row.original.entityType}</span>
        <span className="ml-1.5 text-xs text-muted-foreground font-mono">
          {row.original.entityId.slice(0, 8)}…
        </span>
      </div>
    ),
  },
  {
    id: 'user',
    header: 'Usuario',
    cell: ({ row }) => (
      <div className="text-sm">
        <p className="font-medium">{row.original.user?.name ?? '—'}</p>
        <p className="text-xs text-muted-foreground">{row.original.user?.email}</p>
      </div>
    ),
  },
  {
    id: 'ip',
    header: 'IP',
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground font-mono">
        {row.original.ipAddress ?? '—'}
      </span>
    ),
  },
  {
    id: 'createdAt',
    header: 'Fecha',
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {formatDateTime(row.original.createdAt)}
      </span>
    ),
  },
];

// ── Parsers de URL ─────────────────────────────────────────────────────────────

const filterParsers = {
  entityType: parseAsString.withDefault(''),
  action:     parseAsString.withDefault(''),
  dateFrom:   parseAsString.withDefault(''),
  dateTo:     parseAsString.withDefault(''),
  page:       parseAsInteger.withDefault(1),
  limit:      parseAsInteger.withDefault(50),
};

// ── Página ─────────────────────────────────────────────────────────────────────

export default function AuditoriaPage() {
  const [filters, setFilters] = useQueryStates(filterParsers);

  const queryFilters = {
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.action     ? { action: filters.action as AuditAction } : {}),
    ...(filters.dateFrom   ? { dateFrom: filters.dateFrom } : {}),
    ...(filters.dateTo     ? { dateTo: filters.dateTo } : {}),
    page:  filters.page,
    limit: filters.limit,
  };

  const { data, isLoading } = useAuditLogs(queryFilters);
  const logs = data?.data ?? [];
  const meta = data?.meta;

  const hasFilters = !!filters.entityType || !!filters.action || !!filters.dateFrom || !!filters.dateTo;

  return (
    <div className="space-y-5">
      {/* ── Cabecera ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <HistoryIcon className="size-5 text-muted-foreground" />
          Auditoría
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {meta
            ? `${meta.total} registro${meta.total !== 1 ? 's' : ''} de actividad`
            : 'Cargando...'}
        </p>
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Tipo de entidad */}
        <Select
          value={filters.entityType || '_all'}
          onValueChange={(v) => void setFilters({ entityType: v === '_all' ? '' : v, page: 1 })}
        >
          <SelectTrigger size="sm" className="w-40">
            <SelectValue placeholder="Entidad" />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_TYPE_OPTIONS.map((e) => (
              <SelectItem key={e || '_all'} value={e || '_all'}>
                {e || 'Todas las entidades'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Acción */}
        <Select
          value={filters.action || '_all'}
          onValueChange={(v) => void setFilters({ action: v === '_all' ? '' : v, page: 1 })}
        >
          <SelectTrigger size="sm" className="w-48">
            <SelectValue placeholder="Acción" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((opt) => (
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
              void setFilters({ entityType: '', action: '', dateFrom: '', dateTo: '', page: 1 })
            }
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* ── Tabla ── */}
      <DataTable
        data={logs}
        columns={auditColumns}
        total={meta?.total}
        page={filters.page}
        limit={filters.limit}
        onPageChange={(p) => void setFilters({ page: p })}
        onLimitChange={(l) => void setFilters({ limit: l, page: 1 })}
        isLoading={isLoading}
        emptyMessage="No se encontraron registros de auditoría"
      />
    </div>
  );
}
