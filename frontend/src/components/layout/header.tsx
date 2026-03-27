'use client';

import { MenuIcon, LogOutIcon, SmartphoneIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Breadcrumbs } from './breadcrumbs';
import { useAuth } from '@/lib/auth-provider';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { usePwaInstall } from '@/components/shared/pwa-provider';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  oficina: 'Oficina',
  comercial: 'Comercial',
  validador: 'Validador',
};

// ── Componente ────────────────────────────────────────────────────────────────

interface HeaderProps {
  /** Llamado al pulsar el botón hamburguesa (móvil) */
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth();
  const { canInstall, install } = usePwaInstall();

  const initials = user ? getInitials(user.name) : 'U';
  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role) : '';

  return (
    <header className="sticky top-0 z-30 flex items-center h-14 border-b bg-card px-4 gap-3 shrink-0">
      {/* Hamburguesa — solo en móvil */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onMenuToggle}
        aria-label="Abrir menú de navegación"
      >
        <MenuIcon className="size-5" />
      </Button>

      {/* Breadcrumbs — ocultos en móvil pequeño */}
      <div className="flex-1 hidden sm:block overflow-hidden">
        <Breadcrumbs />
      </div>

      {/* Espaciador en móvil cuando no hay breadcrumbs */}
      <div className="flex-1 sm:hidden" />

      {/* Cambiar tema claro / oscuro */}
      <ThemeToggle />

      {/* Menú de usuario */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full shrink-0"
            aria-label="Menú de usuario"
          >
            <Avatar className="size-8">
              <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal py-2">
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-sm truncate">{user?.name}</span>
              <span className="text-muted-foreground text-xs truncate">{user?.email}</span>
              <span className="text-muted-foreground text-xs">{roleLabel}</span>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {/* Instalar como app nativa (solo visible cuando el navegador lo permite) */}
          {canInstall && (
            <>
              <DropdownMenuItem onClick={() => void install()} className="cursor-pointer">
                <SmartphoneIcon className="size-4 mr-2 shrink-0" />
                Instalar aplicación
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem
            onClick={() => void logout()}
            className="text-destructive focus:text-destructive cursor-pointer"
          >
            <LogOutIcon className="size-4 mr-2 shrink-0" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
