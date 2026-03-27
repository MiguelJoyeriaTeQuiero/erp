import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// ── Moneda ─────────────────────────────────────────────────────────────────────

const currencyFmt = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "1.234,50 €" */
export function formatCurrency(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '—';
  return currencyFmt.format(n);
}

// ── Gramos ─────────────────────────────────────────────────────────────────────

const gramsFmt = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "12,50 g" */
export function formatGrams(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '—';
  return `${gramsFmt.format(n)} g`;
}

// ── Pureza (4 decimales, sin trailing zeros si todos son cero) ─────────────────

/** "0,7500" */
export function formatPurity(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '—';
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(n);
}

/** "75 %" */
export function formatPurityPercent(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '—';
  return `${(n * 100).toFixed(2).replace('.', ',')} %`;
}

// ── Fechas ─────────────────────────────────────────────────────────────────────

/** "12/03/2026" */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd/MM/yyyy', { locale: es });
  } catch {
    return '—';
  }
}

/** "12 mar 2026, 14:30" */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  try {
    return format(new Date(value), "d MMM yyyy, HH:mm", { locale: es });
  } catch {
    return '—';
  }
}

/** "hace 3 días" */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return '—';
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true, locale: es });
  } catch {
    return '—';
  }
}

// ── Tamaño de archivo ──────────────────────────────────────────────────────────

/** "2,4 MB" */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Tipo de cliente ────────────────────────────────────────────────────────────

export function formatClientType(type: string): string {
  return type === 'COMPANY' ? 'Empresa' : 'Particular';
}

// ── Método de pago ─────────────────────────────────────────────────────────────

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};

export function formatPaymentMethod(method: string): string {
  return PAYMENT_LABELS[method] ?? method;
}
