'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRightIcon, HomeIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Mapeo de segmentos URL a etiquetas en español ─────────────────────────────

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  clientes: 'Clientes',
  nuevo: 'Nuevo',
  editar: 'Editar',
  cierres: 'Cierres',
  adelanto: 'Adelanto',
  recogidas: 'Recogidas',
  validacion: 'Validación',
  albaran: 'Albarán',
  incidencias: 'Incidencias',
  tarifas: 'Tarifas',
  usuarios: 'Usuarios',
  auditoria: 'Auditoría',
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getLabel(segment: string): string {
  return SEGMENT_LABELS[segment] ?? segment;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length <= 1) return null;

  // Construir la lista de migas de pan acumulando rutas
  const crumbs: { label: string; href: string }[] = [];
  let accumulated = '';

  for (const seg of segments) {
    accumulated += `/${seg}`;
    crumbs.push({
      label: UUID_RE.test(seg) ? 'Detalle' : getLabel(seg),
      href: accumulated,
    });
  }

  return (
    <nav
      aria-label="Ruta de navegación"
      className={cn('flex items-center gap-1 text-sm text-muted-foreground', className)}
    >
      <Link
        href="/dashboard"
        className="hover:text-foreground transition-colors"
        aria-label="Inicio"
      >
        <HomeIcon className="size-4" />
      </Link>

      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1">
            <ChevronRightIcon className="size-3.5 shrink-0" />
            {isLast ? (
              <span className="font-medium text-foreground truncate max-w-[160px]">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="hover:text-foreground transition-colors truncate max-w-[120px]"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
