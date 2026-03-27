'use client';

import { useEffect, useState } from 'react';
import { WifiOffIcon, WifiIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Banner flotante que informa al usuario cuando pierde (o recupera) la conexión.
 * Se muestra en la parte inferior de la pantalla, centrado.
 */
export function OfflineBanner() {
  const [status, setStatus] = useState<'online' | 'offline' | 'reconnected' | null>(null);

  useEffect(() => {
    // Estado inicial (evitar hydration mismatch)
    if (!navigator.onLine) {
      setStatus('offline');
    }

    const handleOffline = () => setStatus('offline');

    const handleOnline = () => {
      setStatus('reconnected');
      // Ocultar el banner de "reconectado" tras 3 segundos
      setTimeout(() => setStatus(null), 3000);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!status) return null;

  const isOffline = status === 'offline';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg',
        'animate-in slide-in-from-bottom-4 duration-300',
        isOffline
          ? 'bg-destructive text-destructive-foreground'
          : 'bg-green-600 text-white',
      )}
    >
      {isOffline ? (
        <>
          <WifiOffIcon className="size-4 shrink-0" />
          Sin conexión — los datos pueden no estar actualizados
        </>
      ) : (
        <>
          <WifiIcon className="size-4 shrink-0" />
          Conexión restaurada
        </>
      )}
    </div>
  );
}
