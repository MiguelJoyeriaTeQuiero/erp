'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboardIcon,
  FileTextIcon,
  UsersIcon,
  PackageIcon,
  AlertTriangleIcon,
  TrendingUpIcon,
  UserCogIcon,
  HistoryIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth-provider';
import { Logo } from '@/components/shared/logo';

// ── Definición de navegación ──────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboardIcon },
  { label: 'Cierres', href: '/cierres', icon: FileTextIcon },
  { label: 'Clientes', href: '/clientes', icon: UsersIcon },
  { label: 'Recogidas', href: '/recogidas', icon: PackageIcon },
  { label: 'Incidencias', href: '/incidencias', icon: AlertTriangleIcon },
  {
    label: 'Tarifas',
    href: '/tarifas',
    icon: TrendingUpIcon,
    roles: ['admin', 'oficina'],
  },
  {
    label: 'Usuarios',
    href: '/usuarios',
    icon: UserCogIcon,
    roles: ['admin'],
  },
  {
    label: 'Auditoría',
    href: '/auditoria',
    icon: HistoryIcon,
    roles: ['admin'],
  },
];

// ── Componente ────────────────────────────────────────────────────────────────

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'hidden lg:flex flex-col h-screen sticky top-0 shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-in-out overflow-hidden',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {/* Marca */}
        <div
          className={cn(
            'flex items-center h-14 border-b border-sidebar-border shrink-0 px-4 overflow-hidden',
            collapsed && 'justify-center px-0',
          )}
        >
          <Logo variant={collapsed ? 'collapsed' : 'expanded'} />
        </div>

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {visibleItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center justify-center h-10 w-full rounded-md transition-colors',
                        active
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                      )}
                    >
                      <Icon className="size-5 shrink-0" />
                      <span className="sr-only">{item.label}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 h-10 px-3 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                )}
              >
                <Icon className="size-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Botón de colapso */}
        <div
          className={cn(
            'border-t border-sidebar-border p-2',
            collapsed ? 'flex justify-center' : 'flex justify-end',
          )}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            aria-label={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
            className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            {collapsed ? (
              <ChevronRightIcon className="size-4" />
            ) : (
              <ChevronLeftIcon className="size-4" />
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
