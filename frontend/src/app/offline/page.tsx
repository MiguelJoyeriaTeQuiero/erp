/**
 * Página mostrada por el Service Worker cuando el usuario navega
 * a una ruta mientras no tiene conexión a Internet.
 */

'use client';

import { WifiOffIcon, RefreshCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-8 p-8"
      style={{ backgroundColor: 'oklch(0.250 0.055 213)' }}
    >
      {/* Icono de desconexión */}
      <div
        className="flex items-center justify-center size-24 rounded-full"
        style={{ backgroundColor: 'oklch(0.420 0.058 213)' }}
      >
        <WifiOffIcon className="size-12" style={{ color: 'oklch(0.706 0.118 78)' }} />
      </div>

      {/* Texto */}
      <div className="text-center max-w-xs">
        <h1
          className="text-3xl font-semibold mb-3"
          style={{ color: 'oklch(0.706 0.118 78)' }}
        >
          Sin conexión
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'oklch(0.945 0 0 / 70%)' }}>
          No se ha podido conectar con el servidor. Comprueba tu conexión a
          Internet y vuelve a intentarlo.
        </p>
      </div>

      {/* Botón de reintento */}
      <Button
        onClick={() => window.location.reload()}
        size="lg"
        className="gap-2"
        style={{
          backgroundColor: 'oklch(0.706 0.118 78)',
          color: 'oklch(0.145 0 0)',
        }}
      >
        <RefreshCwIcon className="size-4" />
        Reintentar
      </Button>

      {/* Nombre de la app */}
      <p className="text-xs" style={{ color: 'oklch(0.945 0 0 / 40%)' }}>
        TQ Metales — Gestión
      </p>
    </div>
  );
}
