'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboardIcon,
  FileTextIcon,
  PackageIcon,
  AlertTriangleIcon,
  MenuIcon,
  UsersIcon,
  TrendingUpIcon,
  UserCogIcon,
  HistoryIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import { useAuth } from '@/lib/auth-provider';

// ── Ítems del tab inferior (los 4 más frecuentes) ─────────────────────────────

const BOTTOM_TABS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboardIcon },
  { label: 'Cierres', href: '/cierres', icon: FileTextIcon },
  { label: 'Recogidas', href: '/recogidas', icon: PackageIcon },
  { label: 'Incidencias', href: '/incidencias', icon: AlertTriangleIcon },
];

// ── Todos los ítems de navegación (para el Sheet) ────────────────────────────

const ALL_NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboardIcon },
  { label: 'Cierres', href: '/cierres', icon: FileTextIcon },
  { label: 'Clientes', href: '/clientes', icon: UsersIcon },
  { label: 'Recogidas', href: '/recogidas', icon: PackageIcon },
  { label: 'Incidencias', href: '/incidencias', icon: AlertTriangleIcon },
  { label: 'Tarifas', href: '/tarifas', icon: TrendingUpIcon, roles: ['admin', 'oficina'] },
  { label: 'Usuarios', href: '/usuarios', icon: UserCogIcon, roles: ['admin'] },
  { label: 'Auditoría', href: '/auditoria', icon: HistoryIcon, roles: ['admin'] },
];

// ── Componente ────────────────────────────────────────────────────────────────

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const visibleNavItems = ALL_NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden flex items-stretch border-t bg-card"
      aria-label="Navegación principal móvil"
    >
      {/* Pestañas rápidas */}
      {BOTTOM_TABS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <item.icon className="size-5 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}

      {/* Botón "Más" → abre Sheet con navegación completa */}
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Abrir menú completo"
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <MenuIcon className="size-5 shrink-0" />
            <span>Más</span>
          </button>
        </SheetTrigger>

        <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
          <SheetHeader className="px-4 pt-5 pb-4 border-b">
            <SheetTitle className="text-left font-bold">TQ Metales</SheetTitle>
          </SheetHeader>

          <nav className="py-3 px-2 space-y-0.5 overflow-y-auto">
            {visibleNavItems.map((item) => {
              const active = isActive(item.href);
              return (
                <SheetClose asChild key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <item.icon className="size-5 shrink-0" />
                    {item.label}
                  </Link>
                </SheetClose>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
