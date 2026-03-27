'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MoreHorizontalIcon, EyeIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/shared/status-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useConfirmClosure } from '@/hooks/use-closures';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { ApiError } from '@/lib/api-client';
import type { Closure } from '@/types/api';

// ── Celda de acciones ──────────────────────────────────────────────────────────

function ActionsCell({ closure }: { closure: Closure }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const confirmMutation = useConfirmClosure(closure.id);

  const isDraft = closure.status === 'DRAFT';

  const handleConfirm = async () => {
    try {
      await confirmMutation.mutateAsync();
      toast.success(`Cierre ${closure.code} confirmado`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error al confirmar el cierre');
      throw err;
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
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={`/cierres/${closure.id}`}>
              <EyeIcon className="size-4 mr-2" />
              Ver detalle
            </Link>
          </DropdownMenuItem>
          {isDraft && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowConfirm(true)}>
                <CheckCircleIcon className="size-4 mr-2" />
                Confirmar cierre
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="¿Confirmar cierre?"
        description={`El cierre ${closure.code} quedará confirmado y los precios se congelarán. Esta acción no se puede deshacer.`}
        confirmLabel="Confirmar"
        onConfirm={handleConfirm}
      />
    </>
  );
}

// ── Columnas ──────────────────────────────────────────────────────────────────

export const closureColumns: ColumnDef<Closure>[] = [
  {
    accessorKey: 'code',
    header: 'Código',
    enableSorting: true,
    cell: ({ row }) => (
      <Link
        href={`/cierres/${row.original.id}`}
        className="font-mono font-semibold text-sm hover:underline underline-offset-2 text-foreground"
      >
        {row.original.code}
      </Link>
    ),
  },
  {
    id: 'client',
    header: 'Cliente',
    enableSorting: false,
    cell: ({ row }) => {
      const client = row.original.client;
      if (!client) return <span className="text-muted-foreground text-sm">—</span>;
      return (
        <div>
          <p className="text-sm font-medium leading-tight">{client.commercialName}</p>
          <p className="text-xs text-muted-foreground font-mono">{client.taxId}</p>
        </div>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Estado',
    enableSorting: false,
    cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
  },
  {
    accessorKey: 'totalAmount',
    header: 'Total',
    enableSorting: true,
    cell: ({ getValue }) => (
      <span className="font-semibold tabular-nums text-sm">
        {formatCurrency(getValue() as string)}
      </span>
    ),
  },
  {
    id: 'advance',
    header: 'Adelanto',
    enableSorting: false,
    cell: ({ row }) => {
      const a = row.original.advanceAmount;
      const n = parseFloat(a);
      if (!n) return <span className="text-muted-foreground text-sm">—</span>;
      return <span className="text-sm tabular-nums">{formatCurrency(a)}</span>;
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Fecha',
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
    cell: ({ row }) => <ActionsCell closure={row.original} />,
  },
];
