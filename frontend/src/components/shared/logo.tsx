'use client';

import { cn } from '@/lib/utils';

// ── Icono corazón SVG (pequeño, inline) ───────────────────────────────────────

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 13.7C7.7 13.5 1 9.3 1 5.5 1 3.6 2.6 2 4.5 2c1 0 2 .5 2.7 1.3L8 4.1l.8-.8C9.5 2.5 10.5 2 11.5 2 13.4 2 15 3.6 15 5.5c0 3.8-6.7 8-7 8.2L8 13.7z" />
    </svg>
  );
}

// ── Componente Logo ───────────────────────────────────────────────────────────

interface LogoProps {
  /** collapsed → cuadrado con inicial; expanded → texto horizontal (sidebar); full → centrado (login) */
  variant?: 'collapsed' | 'expanded' | 'full';
  className?: string;
}

export function Logo({ variant = 'full', className }: LogoProps) {
  /* Versión colapsada: cuadrado dorado con la "M" */
  if (variant === 'collapsed') {
    return (
      <div
        className={cn(
          'flex items-center justify-center size-8 rounded-lg shrink-0 bg-sidebar-primary',
          className,
        )}
      >
        <span className="font-heading font-bold text-sm leading-none select-none text-sidebar-primary-foreground">
          M
        </span>
      </div>
    );
  }

  const isFull = variant === 'full';

  return (
    <div
      className={cn(
        'flex flex-col select-none',
        isFull ? 'items-center gap-1' : 'items-start gap-0.5',
        className,
      )}
    >
      {/* "Metales" en oro de marca, fuente heading ligera */}
      <span
        className={cn(
          'font-heading font-light leading-none tracking-tight',
          isFull ? 'text-5xl' : 'text-[1.15rem]',
        )}
        style={{ color: 'oklch(0.706 0.118 78)' }}
      >
        Metales
      </span>

      {/* "Te ♥ uiero Group" en blanco semitransparente */}
      <span
        className={cn(
          'font-sans font-medium tracking-widest uppercase flex items-center gap-px',
          isFull ? 'text-[10px] text-white/70' : 'text-[8.5px] text-white/60',
        )}
      >
        Te
        <HeartIcon
          className={cn(
            'shrink-0 mb-px',
            isFull ? 'size-[9px]' : 'size-[7px]',
          )}
        />
        uiero&nbsp;Group
      </span>
    </div>
  );
}
