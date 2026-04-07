'use client';

import { RefreshCwIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentRates } from '@/hooks/use-pricing';
import { formatRelative } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { PriceRate } from '@/types/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Agrupa rates por metal+karat y devuelve min/max si hay varias categorías */
function summarize(rates: PriceRate[], metalCode: string, karatLabel: string) {
  const filtered = rates.filter(
    (r) => r.metalType?.code === metalCode && r.karat?.label === karatLabel,
  );
  if (filtered.length === 0) return null;

  const prices = filtered.map((r) => parseFloat(r.pricePerGram));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { min, max, count: filtered.length, updatedAt: filtered[0].validFrom };
}

function PriceRow({
  label,
  metalCode,
  karatLabel,
  dotColor,
  rates,
}: {
  label: string;
  metalCode: string;
  karatLabel: string;
  dotColor: string;
  rates: PriceRate[];
}) {
  const summary = summarize(rates, metalCode, karatLabel);

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-2.5">
        <span className={cn('size-2.5 rounded-full flex-shrink-0', dotColor)} />
        <div>
          <p className="text-sm font-semibold leading-none">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">precio por gramo (EUR)</p>
        </div>
      </div>

      {summary ? (
        <div className="text-right">
          <p className="text-base font-bold tabular-nums">
            {summary.min === summary.max ? (
              <>
                {summary.min.toLocaleString('es-ES', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                €/g
              </>
            ) : (
              <>
                {summary.min.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {' – '}
                {summary.max.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                €/g
              </>
            )}
          </p>
          {summary.count > 1 && (
            <p className="text-xs text-muted-foreground">{summary.count} categorías</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">Sin tarifa activa</p>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export function SpotPricesCard() {
  const { data: rates = [], isLoading, dataUpdatedAt } = useCurrentRates();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Cotizaciones actuales</CardTitle>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCwIcon className="size-3" />
          {dataUpdatedAt
            ? `Actualizado ${formatRelative(new Date(dataUpdatedAt).toISOString())}`
            : 'Actualizando…'}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-3 py-2">
            <div className="h-10 animate-pulse rounded-lg bg-muted" />
            <div className="h-10 animate-pulse rounded-lg bg-muted" />
          </div>
        ) : (
          <div>
            <PriceRow
              label="Oro 24k"
              metalCode="GOLD"
              karatLabel="24k"
              dotColor="bg-yellow-400"
              rates={rates}
            />
            <PriceRow
              label="Plata 1000"
              metalCode="SILVER"
              karatLabel="1000"
              dotColor="bg-slate-400"
              rates={rates}
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Se refresca automáticamente cada 35 segundos
        </p>
      </CardContent>
    </Card>
  );
}
