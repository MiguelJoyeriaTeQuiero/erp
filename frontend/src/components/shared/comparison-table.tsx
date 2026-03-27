import { cn } from '@/lib/utils';
import { AlertTriangleIcon, CheckCircleIcon, MinusIcon } from 'lucide-react';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ComparisonCell {
  grams: string;
  karatLabel: string;
  /** Importe pactado en EUR (solo columna "Pactado") */
  amount?: string;
  pricePerGram?: string;
  /** Indica que este dato difiere del pactado (corrección en validación) */
  hasCorrection?: boolean;
  /** Observación de la corrección */
  observation?: string;
}

export interface ComparisonRow {
  id: string;
  /** Etiqueta de la línea, ej: "Oro 18k" */
  label: string;
  agreed: ComparisonCell;
  collected?: ComparisonCell | null;
  validated?: ComparisonCell | null;
}

interface ComparisonTableProps {
  rows: ComparisonRow[];
  /** Mostrar columna de precios. Por defecto: false */
  showPrices?: boolean;
  className?: string;
}

// ── Helpers de formato ────────────────────────────────────────────────────────

function fmt(value: string): string {
  const n = parseFloat(value);
  return isNaN(n) ? value : n.toFixed(2);
}

function fmtEur(value: string | undefined): string {
  if (!value) return '—';
  const n = parseFloat(value);
  return isNaN(n) ? value : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function CellContent({
  cell,
  showPrices,
}: {
  cell: ComparisonCell | null | undefined;
  showPrices?: boolean;
}) {
  if (!cell) {
    return (
      <span className="flex items-center gap-1 text-muted-foreground/50">
        <MinusIcon className="size-3.5" />
        <span className="text-xs">Sin datos</span>
      </span>
    );
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-sm font-semibold tabular-nums">{fmt(cell.grams)} g</span>
        <span className="text-xs text-muted-foreground">{cell.karatLabel}</span>

        {cell.hasCorrection && (
          <span className="flex items-center gap-0.5 text-amber-600 text-xs">
            <AlertTriangleIcon className="size-3.5" />
            corrección
          </span>
        )}
        {cell.hasCorrection === false && (
          <span className="flex items-center gap-0.5 text-emerald-600 text-xs">
            <CheckCircleIcon className="size-3.5" />
            ok
          </span>
        )}
      </div>

      {showPrices && cell.pricePerGram && (
        <p className="text-xs text-muted-foreground">{fmtEur(cell.pricePerGram)}/g</p>
      )}

      {cell.amount && (
        <p className="text-sm font-medium text-foreground">{fmtEur(cell.amount)}</p>
      )}

      {cell.observation && (
        <p className="text-xs text-amber-600 italic leading-snug">{cell.observation}</p>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

const COLUMN_HEADERS = [
  { key: 'label',     title: '',          className: 'w-[140px] sm:w-[180px]' },
  { key: 'agreed',    title: 'Pactado',   className: 'bg-blue-50/50 dark:bg-blue-900/10' },
  { key: 'collected', title: 'Recogido',  className: 'bg-amber-50/50 dark:bg-amber-900/10' },
  { key: 'validated', title: 'Validado',  className: 'bg-emerald-50/50 dark:bg-emerald-900/10' },
];

export function ComparisonTable({ rows, showPrices = false, className }: ComparisonTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Sin líneas para comparar
      </p>
    );
  }

  return (
    <div className={cn('overflow-x-auto rounded-xl border', className)}>
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr className="border-b">
            {COLUMN_HEADERS.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide',
                  col.className,
                )}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.id}
              className={cn(
                'border-b last:border-0 align-top',
                index % 2 === 0 ? 'bg-background' : 'bg-muted/20',
              )}
            >
              {/* Etiqueta de línea */}
              <td className="px-3 py-3">
                <span className="font-medium text-xs text-foreground">{row.label}</span>
              </td>

              {/* Pactado */}
              <td className={cn('px-3 py-3', COLUMN_HEADERS[1]!.className)}>
                <CellContent cell={row.agreed} showPrices={showPrices} />
              </td>

              {/* Recogido */}
              <td className={cn('px-3 py-3', COLUMN_HEADERS[2]!.className)}>
                <CellContent cell={row.collected} showPrices={showPrices} />
              </td>

              {/* Validado */}
              <td className={cn('px-3 py-3', COLUMN_HEADERS[3]!.className)}>
                <CellContent cell={row.validated} showPrices={showPrices} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
