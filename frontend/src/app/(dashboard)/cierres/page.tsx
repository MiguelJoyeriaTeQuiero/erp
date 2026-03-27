'use client';

import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
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
import { useClosures } from '@/hooks/use-closures';
import { useAuth } from '@/hooks/use-auth';
import { closureColumns } from '@/components/closures/closure-columns';
import type { ClosureStatus } from '@/types/api';

// ── Opciones de estado ─────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: ClosureStatus | ''; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'CONFIRMED', label: 'Confirmado' },
  { value: 'WITH_ADVANCE', label: 'Con adelanto' },
  { value: 'PENDING_COLLECTION', label: 'Pdte. recogida' },
  { value: 'PARTIAL_COLLECTION', label: 'Recogida parcial' },
  { value: 'PENDING_VALIDATION', label: 'Pdte. validación' },
  { value: 'IN_VALIDATION', label: 'En validación' },
  { value: 'WITH_INCIDENTS', label: 'Con incidencias' },
  { value: 'VALIDATED', label: 'Validado' },
  { value: 'COMPLETED', label: 'Completado' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

// ── Parsers de URL ─────────────────────────────────────────────────────────────

const filterParsers = {
  status: parseAsString.withDefault(''),
  search: parseAsString.withDefault(''),
  dateFrom: parseAsString.withDefault(''),
  dateTo: parseAsString.withDefault(''),
  page: parseAsInteger.withDefault(1),
  limit: parseAsInteger.withDefault(20),
  sortBy: parseAsString.withDefault('createdAt'),
  sortOrder: parseAsString.withDefault('desc'),
};

// ── Página ─────────────────────────────────────────────────────────────────────

export default function CierresPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useQueryStates(filterParsers);

  const canCreate = user?.role === 'admin' || user?.role === 'oficina';

  const queryFilters = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
    ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
    page: filters.page,
    limit: filters.limit,
    sortBy: filters.sortBy,
    sortOrder: (filters.sortOrder as 'asc' | 'desc') || 'desc',
  };

  const { data, isLoading } = useClosures(queryFilters);
  const closures = data?.data ?? [];
  const meta = data?.meta;

  const hasFilters = !!filters.status || !!filters.search || !!filters.dateFrom || !!filters.dateTo;

  return (
    <div className="space-y-5">
      {/* ── Cabecera ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cierres</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {meta
              ? `${meta.total} cierre${meta.total !== 1 ? 's' : ''} en total`
              : 'Cargando...'}
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/cierres/nuevo">
              <PlusIcon className="size-4" />
              Nuevo cierre
            </Link>
          </Button>
        )}
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

        {/* Rango de fechas: desde */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Desde</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => void setFilters({ dateFrom: e.target.value, page: 1 })}
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

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
              void setFilters({
                status: '',
                search: '',
                dateFrom: '',
                dateTo: '',
                page: 1,
              })
            }
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* ── Tabla ── */}
      <DataTable
        data={closures}
        columns={closureColumns}
        total={meta?.total}
        page={filters.page}
        limit={filters.limit}
        onPageChange={(p) => void setFilters({ page: p })}
        onLimitChange={(l) => void setFilters({ limit: l, page: 1 })}
        filterValue={filters.search}
        onFilterChange={(v) => void setFilters({ search: v, page: 1 })}
        filterPlaceholder="Buscar por código, cliente..."
        isLoading={isLoading}
        emptyMessage="No se encontraron cierres"
      />
    </div>
  );
}
