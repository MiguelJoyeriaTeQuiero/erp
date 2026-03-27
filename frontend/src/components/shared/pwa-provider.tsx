'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Prompt de instalación (BeforeInstallPromptEvent) ──────────────────────────
// Se guarda a nivel de módulo para que persista entre renders

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let deferredInstallPrompt: any = null;

// ── Componente de registro del Service Worker ─────────────────────────────────

/**
 * Componente invisible que registra el SW y captura el prompt de instalación.
 * Debe montarse una sola vez en el RootLayout.
 */
export function PwaProvider() {
  useEffect(() => {
    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[SW] Error de registro:', err);
      });
    }

    // Capturar el prompt de instalación de la PWA antes de que el navegador
    // lo muestre automáticamente, para poder activarlo manualmente.
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      window.dispatchEvent(new Event('pwa:installable'));
    };

    const onInstalled = () => {
      deferredInstallPrompt = null;
      window.dispatchEvent(new Event('pwa:installed'));
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  return null;
}

// ── Hook para control de la instalación PWA ───────────────────────────────────

/**
 * Hook que expone si la app es instalable y una función para lanzar el prompt.
 */
export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Si el prompt ya estaba disponible antes de montar el componente
    setCanInstall(!!deferredInstallPrompt);

    const onInstallable = () => setCanInstall(true);
    const onInstalled = () => setCanInstall(false);

    window.addEventListener('pwa:installable', onInstallable);
    window.addEventListener('pwa:installed', onInstalled);

    return () => {
      window.removeEventListener('pwa:installable', onInstallable);
      window.removeEventListener('pwa:installed', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredInstallPrompt) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await deferredInstallPrompt.prompt();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    setCanInstall(false);
  }, []);

  return { canInstall, install };
}
