import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  PlusCircleIcon,
  PencilIcon,
  Trash2Icon,
  CheckCircleIcon,
  XCircleIcon,
  UploadIcon,
  DownloadIcon,
  RefreshCwIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface TimelineEntry {
  id: string;
  action: string;
  entityType: string;
  createdAt: string | Date;
  user?: { id: string; name: string; email: string } | null;
  /** Descripción opcional adicional (ej: nombre del documento, motivo) */
  description?: string;
}

// ── Mapeo de acción → icono + color + etiqueta ────────────────────────────────

interface ActionConfig {
  icon: React.ElementType;
  iconClass: string;
  dotClass: string;
  label: string;
}

const ACTION_CONFIG: Record<string, ActionConfig> = {
  CREATE:   { icon: PlusCircleIcon,  iconClass: 'text-emerald-600', dotClass: 'bg-emerald-500', label: 'Creado' },
  UPDATE:   { icon: PencilIcon,      iconClass: 'text-blue-600',    dotClass: 'bg-blue-500',    label: 'Actualizado' },
  DELETE:   { icon: Trash2Icon,      iconClass: 'text-red-600',     dotClass: 'bg-red-500',     label: 'Eliminado' },
  CONFIRM:  { icon: CheckCircleIcon, iconClass: 'text-emerald-600', dotClass: 'bg-emerald-500', label: 'Confirmado' },
  CANCEL:   { icon: XCircleIcon,     iconClass: 'text-red-600',     dotClass: 'bg-red-500',     label: 'Cancelado' },
  APPROVE:  { icon: CheckCircleIcon, iconClass: 'text-emerald-600', dotClass: 'bg-emerald-500', label: 'Aprobado' },
  REJECT:   { icon: XCircleIcon,     iconClass: 'text-red-600',     dotClass: 'bg-red-500',     label: 'Rechazado' },
  UPLOAD:   { icon: UploadIcon,      iconClass: 'text-blue-600',    dotClass: 'bg-blue-500',    label: 'Documento subido' },
  DOWNLOAD: { icon: DownloadIcon,    iconClass: 'text-blue-600',    dotClass: 'bg-blue-500',    label: 'Descargado' },
  CONVERT:  { icon: RefreshCwIcon,   iconClass: 'text-violet-600',  dotClass: 'bg-violet-500',  label: 'Conversión aplicada' },
};

const DEFAULT_ACTION: ActionConfig = {
  icon: PencilIcon,
  iconClass: 'text-muted-foreground',
  dotClass: 'bg-muted-foreground',
  label: 'Acción',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: es });
}

function formatAbsolute(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, "d MMM yyyy 'a las' HH:mm", { locale: es });
}

// ── Componente ────────────────────────────────────────────────────────────────

interface TimelineProps {
  entries: TimelineEntry[];
  className?: string;
}

export function Timeline({ entries, className }: TimelineProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Sin actividad registrada
      </p>
    );
  }

  return (
    <ol className={cn('relative space-y-0', className)}>
      {entries.map((entry, index) => {
        const config = ACTION_CONFIG[entry.action] ?? DEFAULT_ACTION;
        const Icon = config.icon;
        const isLast = index === entries.length - 1;

        return (
          <li key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
            {/* Línea vertical */}
            {!isLast && (
              <span
                className="absolute left-4 top-8 h-full w-px bg-border"
                aria-hidden
              />
            )}

            {/* Icono */}
            <span
              className={cn(
                'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-card border',
                config.iconClass,
              )}
              aria-hidden
            >
              <Icon className="size-4" />
            </span>

            {/* Contenido */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="text-sm font-medium text-foreground">
                  {config.label}
                </span>
                {entry.user && (
                  <span className="text-xs text-muted-foreground">
                    por {entry.user.name}
                  </span>
                )}
              </div>

              {entry.description && (
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  {entry.description}
                </p>
              )}

              <time
                dateTime={typeof entry.createdAt === 'string' ? entry.createdAt : entry.createdAt.toISOString()}
                title={formatAbsolute(entry.createdAt)}
                className="text-[11px] text-muted-foreground/70"
              >
                {formatRelative(entry.createdAt)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
