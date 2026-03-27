'use client';

import { useMemo } from 'react';
import { PlusIcon, TrashIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MetalKaratSelector } from '@/components/shared/metal-karat-selector';
import { GramsInput } from '@/components/shared/grams-input';
import { formatCurrency, formatGrams } from '@/lib/formatters';
import type { MetalType, KaratCatalog, PriceRate } from '@/types/api';

// ── Tipos locales ──────────────────────────────────────────────────────────────

export interface DraftLine {
  /** ID local (no persistido) */
  localId: string;
  metalTypeId: string;
  karatId: string;
  grams: string;
}

interface ClosureLinesEditorProps {
  lines: DraftLine[];
  onChange: (lines: DraftLine[]) => void;
  metals: MetalType[];
  karats: KaratCatalog[];
  /** Tarifas actuales para calcular importes de previsión */
  rates: PriceRate[];
  disabled?: boolean;
}

// ── Fila de línea ─────────────────────────────────────────────────────────────

interface LineRowProps {
  line: DraftLine;
  index: number;
  metals: MetalType[];
  karats: KaratCatalog[];
  rates: PriceRate[];
  onChange: (patch: Partial<DraftLine>) => void;
  onDelete: () => void;
  disabled?: boolean;
}

function LineRow({
  line,
  index,
  metals,
  karats,
  rates,
  onChange,
  onDelete,
  disabled = false,
}: LineRowProps) {
  // Buscar tarifa activa para metal + quilataje
  const rate = useMemo(() => {
    if (!line.metalTypeId || !line.karatId) return null;
    return (
      rates.find(
        (r) => r.metalTypeId === line.metalTypeId && r.karatId === line.karatId,
      ) ?? null
    );
  }, [line.metalTypeId, line.karatId, rates]);

  // Importe provisional: gramos × precio/g
  const previewAmount = useMemo(() => {
    if (!rate || !line.grams) return null;
    const g = parseFloat(line.grams);
    const p = parseFloat(rate.pricePerGram);
    if (isNaN(g) || isNaN(p) || g <= 0) return null;
    return g * p;
  }, [rate, line.grams]);

  const selectedKarat = karats.find((k) => k.id === line.karatId);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      {/* Número de línea */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Línea {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          disabled={disabled}
          aria-label="Eliminar línea"
          className="text-muted-foreground hover:text-destructive"
        >
          <TrashIcon className="size-4" />
        </Button>
      </div>

      {/* Selector metal + quilataje */}
      <MetalKaratSelector
        value={{ metalTypeId: line.metalTypeId, karatId: line.karatId }}
        onChange={(v) => onChange({ metalTypeId: v.metalTypeId, karatId: v.karatId })}
        metals={metals}
        karats={karats}
        disabled={disabled}
      />

      {/* Gramos + precio + importe */}
      {line.metalTypeId && line.karatId && (
        <div className="flex flex-wrap items-end gap-4 pt-1">
          {/* Gramos */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Gramos</p>
            <GramsInput
              value={line.grams}
              onChange={(v) => onChange({ grams: v })}
              disabled={disabled}
              className="w-32"
              placeholder="0,00"
            />
          </div>

          {/* Precio/g de tarifa */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Precio/g (tarifa actual)</p>
            <div className="h-9 flex items-center">
              {rate ? (
                <span className="text-sm font-medium tabular-nums">
                  {formatCurrency(rate.pricePerGram)}/g
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
          </div>

          {/* Importe provisional */}
          <div className="space-y-1.5 ml-auto">
            <p className="text-xs text-muted-foreground font-medium">Previsión</p>
            <div className="h-9 flex items-center justify-end">
              {previewAmount !== null ? (
                <span className="text-base font-bold tabular-nums">
                  ~{formatCurrency(previewAmount)}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Nota si no hay tarifa */}
      {line.metalTypeId && line.karatId && !rate && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Sin tarifa activa para {selectedKarat?.label ?? 'este quilataje'}. El precio se asignará al confirmar.
        </p>
      )}
    </div>
  );
}

// ── Editor principal ───────────────────────────────────────────────────────────

export function ClosureLinesEditor({
  lines,
  onChange,
  metals,
  karats,
  rates,
  disabled = false,
}: ClosureLinesEditorProps) {
  const addLine = () => {
    const newLine: DraftLine = {
      localId: crypto.randomUUID(),
      metalTypeId: '',
      karatId: '',
      grams: '',
    };
    onChange([...lines, newLine]);
  };

  const updateLine = (localId: string, patch: Partial<DraftLine>) => {
    onChange(lines.map((l) => (l.localId === localId ? { ...l, ...patch } : l)));
  };

  const deleteLine = (localId: string) => {
    onChange(lines.filter((l) => l.localId !== localId));
  };

  // Total provisional sumando todas las líneas calculables
  const previewTotal = useMemo(() => {
    let total = 0;
    let hasAny = false;
    for (const line of lines) {
      if (!line.metalTypeId || !line.karatId || !line.grams) continue;
      const rate = rates.find(
        (r) => r.metalTypeId === line.metalTypeId && r.karatId === line.karatId,
      );
      if (!rate) continue;
      const g = parseFloat(line.grams);
      const p = parseFloat(rate.pricePerGram);
      if (!isNaN(g) && !isNaN(p) && g > 0) {
        total += g * p;
        hasAny = true;
      }
    }
    return hasAny ? total : null;
  }, [lines, rates]);

  return (
    <div className="space-y-3">
      {/* Líneas */}
      {lines.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
          Añade al menos una línea de material
        </div>
      ) : (
        <div className="space-y-3">
          {lines.map((line, idx) => (
            <LineRow
              key={line.localId}
              line={line}
              index={idx}
              metals={metals}
              karats={karats}
              rates={rates}
              onChange={(patch) => updateLine(line.localId, patch)}
              onDelete={() => deleteLine(line.localId)}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* Botón añadir */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addLine}
        disabled={disabled}
        className="w-full"
      >
        <PlusIcon className="size-4" />
        Añadir línea
      </Button>

      {/* Total provisional */}
      {previewTotal !== null && (
        <>
          <Separator />
          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-muted-foreground">
              Total provisional (precios actuales)
            </span>
            <span className="text-lg font-bold tabular-nums">
              ~{formatCurrency(previewTotal)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground px-1">
            El precio se congela definitivamente al confirmar el cierre.
          </p>
        </>
      )}
    </div>
  );
}
