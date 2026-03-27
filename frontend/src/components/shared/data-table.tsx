'use client';

import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface DataTableProps<TData> {
  data: TData[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[];

  // Paginación (servidor)
  total?: number;
  page?: number;
  limit?: number;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;

  // Filtro global (controlado externamente)
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterPlaceholder?: string;

  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];

// ── Componente ────────────────────────────────────────────────────────────────

export function DataTable<TData>({
  data,
  columns,
  total = 0,
  page = 1,
  limit = 10,
  onPageChange,
  onLimitChange,
  filterValue,
  onFilterChange,
  filterPlaceholder = 'Buscar...',
  isLoading = false,
  emptyMessage = 'No hay registros.',
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(total / limit),
  });

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Barra superior: filtro */}
      {onFilterChange !== undefined && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder={filterPlaceholder}
              value={filterValue ?? ''}
              onChange={(e) => onFilterChange(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();

                  return (
                    <TableHead key={header.id} className="bg-muted/40">
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            'flex items-center gap-1',
                            canSort && 'cursor-pointer select-none hover:text-foreground',
                          )}
                          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                          role={canSort ? 'button' : undefined}
                          tabIndex={canSort ? 0 : undefined}
                          onKeyDown={
                            canSort
                              ? (e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    header.column.getToggleSortingHandler()?.(e);
                                  }
                                }
                              : undefined
                          }
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            <span className="text-muted-foreground/60">
                              {sorted === 'asc' ? (
                                <ChevronUpIcon className="size-3.5" />
                              ) : sorted === 'desc' ? (
                                <ChevronDownIcon className="size-3.5" />
                              ) : (
                                <ChevronsUpDownIcon className="size-3.5" />
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {isLoading ? (
              // Filas skeleton durante la carga
              Array.from({ length: limit }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground text-sm"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pie: paginación */}
      {(onPageChange !== undefined || total > 0) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
          {/* Contador */}
          <span className="shrink-0">
            {total === 0
              ? 'Sin resultados'
              : `Mostrando ${from}–${to} de ${total} registros`}
          </span>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Filas por página */}
            {onLimitChange && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs shrink-0">Por página:</span>
                <Select
                  value={String(limit)}
                  onValueChange={(v) => {
                    onLimitChange(Number(v));
                    onPageChange?.(1);
                  }}
                >
                  <SelectTrigger size="sm" className="w-16 h-7">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Navegación de páginas */}
            {onPageChange && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1 || isLoading}
                  aria-label="Página anterior"
                >
                  <ChevronLeftIcon className="size-4" />
                </Button>

                <span className="px-2 text-xs tabular-nums">
                  {page} / {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= totalPages || isLoading}
                  aria-label="Página siguiente"
                >
                  <ChevronRightIcon className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
