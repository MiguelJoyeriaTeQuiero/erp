'use client';

import Link from 'next/link';
import { PlusIcon, UsersIcon } from 'lucide-react';
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
import { EmptyState } from '@/components/shared/empty-state';
import { useClients } from '@/hooks/use-clients';
import { useClientCategories } from '@/hooks/use-catalog';
import { useAuth } from '@/hooks/use-auth';
import { clientColumns } from '@/components/clients/client-columns';

// ── Parsers de URL ──────────────────────────────────────────────────────────

const filterParsers = {
  search: parseAsString.withDefault(''),
  type: parseAsString.withDefault(''),
  categoryId: parseAsString.withDefault(''),
  page: parseAsInteger.withDefault(1),
  limit: parseAsInteger.withDefault(20),
};

// ── Página ─────────────────────────────────────────────────────────────────────

export default function ClientesPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useQueryStates(filterParsers);
  const { data: categories } = useClientCategories();

  const canCreate = user?.role === 'admin' || user?.role === 'oficina';

  // Construir filtros para el hook
  const queryFilters = {
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    page: filters.page,
    limit: filters.limit,
  };

  const { data, isLoading } = useClients(queryFilters);

  const clients = data?.data ?? [];
  const meta = data?.meta;

  const resetPage = () => void setFilters({ page: 1 });

  return (
    <div className="space-y-5">
      {/* ── Cabecera ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {meta ? `${meta.total} cliente${meta.total !== 1 ? 's' : ''} en total` : 'Cargando...'}
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/clientes/nuevo">
              <PlusIcon className="size-4" />
              Nuevo cliente
            </Link>
          </Button>
        )}
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Tipo */}
        <Select
          value={filters.type || '_all'}
          onValueChange={(v) => {
            void setFilters({ type: v === '_all' ? '' : v, page: 1 });
          }}
        >
          <SelectTrigger size="sm" className="w-36">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos los tipos</SelectItem>
            <SelectItem value="COMPANY">Empresa</SelectItem>
            <SelectItem value="INDIVIDUAL">Particular</SelectItem>
          </SelectContent>
        </Select>

        {/* Categoría */}
        <Select
          value={filters.categoryId || '_all'}
          onValueChange={(v) => {
            void setFilters({ categoryId: v === '_all' ? '' : v, page: 1 });
          }}
        >
          <SelectTrigger size="sm" className="w-44">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todas las categorías</SelectItem>
            {categories?.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                <span className="capitalize">{cat.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Limpiar si hay filtros activos */}
        {(filters.search || filters.type || filters.categoryId) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void setFilters({ search: '', type: '', categoryId: '', page: 1 })}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* ── Tabla ── */}
      <DataTable
        data={clients}
        columns={clientColumns}
        total={meta?.total}
        page={filters.page}
        limit={filters.limit}
        onPageChange={(p) => void setFilters({ page: p })}
        onLimitChange={(l) => void setFilters({ limit: l, page: 1 })}
        filterValue={filters.search}
        onFilterChange={(v) => {
          void setFilters({ search: v, page: 1 });
        }}
        filterPlaceholder="Buscar por nombre, NIF..."
        isLoading={isLoading}
        emptyMessage="No se encontraron clientes"
      />
    </div>
  );
}
