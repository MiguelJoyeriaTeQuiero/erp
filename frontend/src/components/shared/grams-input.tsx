'use client';

import { forwardRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Formatea un valor numérico a 2 decimales como string limpio (sin ceros sobrantes al escribir). */
function sanitize(raw: string): string {
  // Permite: dígitos, un punto/coma decimal, hasta 2 cifras tras el punto
  return raw.replace(',', '.').replace(/[^0-9.]/g, '');
}

/** Redondea a 2 decimales al perder el foco. */
function round2(value: string): string {
  const n = parseFloat(value);
  if (isNaN(n) || n < 0) return '';
  return n.toFixed(2);
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface GramsInputProps extends Omit<React.ComponentProps<'input'>, 'type' | 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  /** Mostrar el sufijo "g". Por defecto: true */
  showSuffix?: boolean;
}

// ── Componente ────────────────────────────────────────────────────────────────

export const GramsInput = forwardRef<HTMLInputElement, GramsInputProps>(
  ({ value, onChange, showSuffix = true, className, onBlur, ...props }, ref) => {
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(sanitize(e.target.value));
      },
      [onChange],
    );

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        // Redondear a 2 decimales al perder el foco
        if (value) onChange(round2(value));
        onBlur?.(e);
      },
      [value, onChange, onBlur],
    );

    return (
      <div className="relative flex items-center">
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          pattern="^\d+(\.\d{0,2})?$"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          className={cn(
            'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 text-sm transition-colors outline-none',
            'placeholder:text-muted-foreground',
            'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50',
            'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
            showSuffix ? 'pl-2.5 pr-8' : 'px-2.5',
            className,
          )}
          {...props}
        />
        {showSuffix && (
          <span className="pointer-events-none absolute right-2.5 text-xs text-muted-foreground select-none">
            g
          </span>
        )}
      </div>
    );
  },
);

GramsInput.displayName = 'GramsInput';
