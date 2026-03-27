'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MoreHorizontalIcon, PencilIcon, TrashIcon, EyeIcon } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useDeleteClient } from '@/hooks/use-clients';
import { formatClientType, formatDate } from '@/lib/formatters';
import { ApiError } from '@/lib/api-client';
import type { Client } from '@/types/api';

// ── Celda de acciones ──────────────────────────────────────────────────────────

function ActionsCell({ client }: { client: Client }) {
  const router = useRouter();
  const [showDelete, setShowDelete] = useState(false);
  const deleteMutation = useDeleteClient();

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(client.id);
      toast.success(`Cliente "${client.commercialName}" eliminado`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error al eliminar el cliente');
      throw err; // Para que ConfirmDialog no cierre en caso de error
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Acciones">
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem asChild>
            <Link href={`/clientes/${client.id}`}>
              <EyeIcon className="size-4 mr-2" />
              Ver detalle
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/clientes/${client.id}/editar`}>
              <PencilIcon className="size-4 mr-2" />
              Editar
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setShowDelete(true)}
          >
            <TrashIcon className="size-4 mr-2" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="¿Eliminar cliente?"
        description={`Se eliminará "${client.commercialName}". Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}

// ── Definición de columnas ────────────────────────────────────────────────────

export const clientColumns: ColumnDef<Client>[] = [
  {
    accessorKey: 'commercialName',
    header: 'Nombre comercial',
    enableSorting: true,
    cell: ({ row }) => (
      <Link
        href={`/clientes/${row.original.id}`}
        className="font-medium hover:underline underline-offset-2 text-foreground"
      >
        {row.original.commercialName}
      </Link>
    ),
  },
  {
    accessorKey: 'taxId',
    header: 'NIF / CIF',
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="font-mono text-sm">{getValue() as string}</span>
    ),
  },
  {
    id: 'type',
    accessorKey: 'type',
    header: 'Tipo',
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="text-sm">{formatClientType(getValue() as string)}</span>
    ),
  },
  {
    id: 'category',
    header: 'Categoría',
    enableSorting: false,
    cell: ({ row }) => {
      const name = row.original.category?.name;
      if (!name) return <span className="text-muted-foreground text-sm">—</span>;
      return (
        <span className="text-sm capitalize">{name}</span>
      );
    },
  },
  {
    accessorKey: 'phone',
    header: 'Teléfono',
    enableSorting: false,
    cell: ({ getValue }) => (
      <a
        href={`tel:${getValue() as string}`}
        className="text-sm hover:underline underline-offset-2"
      >
        {getValue() as string}
      </a>
    ),
  },
  {
    id: 'status',
    header: 'Estado',
    enableSorting: false,
    cell: ({ row }) => (
      <span
        className={[
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
          row.original.isActive
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : 'bg-muted text-muted-foreground',
        ].join(' ')}
      >
        {row.original.isActive ? 'Activo' : 'Inactivo'}
      </span>
    ),
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: 'Alta',
    enableSorting: true,
    cell: ({ getValue }) => (
      <span className="text-sm text-muted-foreground tabular-nums">
        {formatDate(getValue() as string)}
      </span>
    ),
  },
  {
    id: 'actions',
    header: '',
    enableSorting: false,
    cell: ({ row }) => <ActionsCell client={row.original} />,
  },
];
