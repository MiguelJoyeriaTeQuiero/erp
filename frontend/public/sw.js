/**
 * Service Worker — TQ Metales ERP
 *
 * Estrategia:
 *  - Activos estáticos de Next.js (_next/static): cache-first (inmutables por hash)
 *  - Fuentes de Google Fonts: cache-first con TTL largo
 *  - Navegación HTML: network-first → fallback a /offline
 *  - Peticiones a la API: network-only (datos financieros no se cachean)
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `metales-static-${CACHE_VERSION}`;
const FONT_CACHE = `metales-fonts-${CACHE_VERSION}`;
const SHELL_CACHE = `metales-shell-${CACHE_VERSION}`;

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Pre-cachear la página offline para poder servirla sin red
      .then((cache) => cache.add('/offline'))
      .catch(() => {}) // silenciar si /offline no está disponible en el primer install
      .then(() => self.skipWaiting()),
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  const CURRENT_CACHES = [STATIC_CACHE, FONT_CACHE, SHELL_CACHE];

  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !CURRENT_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo GET
  if (request.method !== 'GET') return;

  // ── Fuentes de Google Fonts (CSS y archivos) ─────────────────────────────
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  // Solo gestionar peticiones al mismo origen a partir de aquí
  if (url.origin !== self.location.origin) return;

  // ── Activos estáticos de Next.js (_next/static/**) ───────────────────────
  // Tienen hash en el nombre → immutables → cache-first sin expiración
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── Imágenes y favicons públicos ─────────────────────────────────────────
  if (url.pathname.startsWith('/icons/') || url.pathname.match(/\.(svg|png|ico|webp|jpg|jpeg)$/)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── Navegación de páginas (HTML) ─────────────────────────────────────────
  // Network-first: siempre intentar red, caer en /offline si no hay conexión
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/offline').then(
          (cached) =>
            cached ??
            new Response('<h1>Sin conexión</h1>', {
              status: 503,
              headers: { 'Content-Type': 'text/html' },
            }),
        ),
      ),
    );
    return;
  }

  // El resto (scripts de página, Next.js chunks dinámicos): network-first con
  // fallback a caché si existe
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cachear chunks dinámicos de Next.js
        if (response.ok && url.pathname.startsWith('/_next/')) {
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}
