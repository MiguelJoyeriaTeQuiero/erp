'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUpIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(price: number | string): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(price));
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface PriceDisplayProps {
  pricePerGram: number | string;
  /** Etiqueta del metal (ej: "Oro") */
  metalLabel?: string;
  /** Etiqueta del quilataje (ej: "18k") */
  karatLabel?: string;
  updatedAt?: Date | string | null;
  /** Mostrar indicador de actualización pulsante. Por defecto: true */
  showIndicator?: boolean;
  className?: string;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function PriceDisplay({
  pricePerGram,
  metalLabel,
  karatLabel,
  updatedAt,
  showIndicator = true,
  className,
}: PriceDisplayProps) {
  // Re-renderizar cada 30s para actualizar el "hace X segundos"
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const relativeTime = updatedAt
    ? formatDistanceToNow(typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt, {
        addSuffix: true,
        locale: es,
      })
    : null;

  return (
    <div
      className={cn(
        'inline-flex flex-col gap-0.5 rounded-lg border bg-card px-3 py-2',
        className,
      )}
    >
      {/* Metal + quilataje */}
      {(metalLabel ?? karatLabel) && (
        <span className="text-xs text-muted-foreground">
          {[metalLabel, karatLabel].filter(Boolean).join(' — ')}
        </span>
      )}

      {/* Precio */}
      <div className="flex items-center gap-2">
        <TrendingUpIcon className="size-4 text-muted-foreground shrink-0" />
        <span className="text-lg font-semibold tabular-nums">
          {formatPrice(pricePerGram)}
          <span className="text-xs font-normal text-muted-foreground ml-1">/g</span>
        </span>

        {/* Indicador pulsante de "en vivo" */}
        {showIndicator && (
          <span className="relative flex size-2 shrink-0 ml-1" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
        )}
      </div>

      {/* Tiempo desde última actualización */}
      {relativeTime && (
        <span className="text-[11px] text-muted-foreground/70">
          Actualizado {relativeTime}
        </span>
      )}
    </div>
  );
}
