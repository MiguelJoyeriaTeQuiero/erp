import { cn } from '@/lib/utils';

// ── Tipos de estado (en paralelo con los enums del backend) ───────────────────

export type ClosureStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'WITH_ADVANCE'
  | 'PENDING_COLLECTION'
  | 'PARTIAL_COLLECTION'
  | 'PENDING_VALIDATION'
  | 'IN_VALIDATION'
  | 'WITH_INCIDENTS'
  | 'VALIDATED'
  | 'COMPLETED'
  | 'CANCELLED';

export type CollectionStatus =
  | 'REGISTERED'
  | 'VALIDATED'
  | 'WITH_INCIDENTS'
  | 'COMPLETED'
  | 'CANCELLED';

export type IncidentStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CANCELLED';

export type ValidationStatus = 'IN_PROGRESS' | 'APPROVED' | 'REJECTED';

export type ConversionStatus = 'PENDING' | 'APPLIED' | 'REJECTED';

export type AnyStatus =
  | ClosureStatus
  | CollectionStatus
  | IncidentStatus
  | ValidationStatus
  | ConversionStatus;

// ── Configuración visual por estado ──────────────────────────────────────────

interface StatusConfig {
  label: string;
  className: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  // Cierre
  DRAFT:               { label: 'Borrador',             className: 'bg-secondary text-secondary-foreground' },
  CONFIRMED:           { label: 'Confirmado',           className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  WITH_ADVANCE:        { label: 'Con adelanto',         className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  PENDING_COLLECTION:  { label: 'Pdte. recogida',       className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  PARTIAL_COLLECTION:  { label: 'Recogida parcial',     className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  PENDING_VALIDATION:  { label: 'Pdte. validación',     className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  IN_VALIDATION:       { label: 'En validación',        className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  WITH_INCIDENTS:      { label: 'Con incidencias',      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  VALIDATED:           { label: 'Validado',             className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  COMPLETED:           { label: 'Completado',           className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  CANCELLED:           { label: 'Cancelado',            className: 'bg-muted text-muted-foreground' },

  // Recogida
  REGISTERED:          { label: 'Registrada',           className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  // VALIDATED, WITH_INCIDENTS, COMPLETED, CANCELLED — ya cubiertos arriba

  // Incidencia
  OPEN:                { label: 'Abierta',              className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  IN_REVIEW:           { label: 'En revisión',          className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  RESOLVED:            { label: 'Resuelta',             className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  // CANCELLED — ya cubierto arriba

  // Validación
  IN_PROGRESS:         { label: 'En progreso',          className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  APPROVED:            { label: 'Aprobada',             className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  REJECTED:            { label: 'Rechazada',            className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },

  // Conversión
  PENDING:             { label: 'Pendiente',            className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  APPLIED:             { label: 'Aplicada',             className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  // REJECTED — ya cubierto arriba
};

// ── Componente ────────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: AnyStatus | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: 'bg-secondary text-secondary-foreground',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-4xl px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}

// Helper para obtener solo la etiqueta en español
export function getStatusLabel(status: AnyStatus | string): string {
  return STATUS_CONFIG[status]?.label ?? status;
}
