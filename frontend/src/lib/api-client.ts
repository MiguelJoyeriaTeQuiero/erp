// ── Configuración ─────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const ACCESS_TOKEN_KEY = 'metales_access_token';
const REFRESH_TOKEN_KEY = 'metales_refresh_token';

// ── Token helpers ─────────────────────────────────────────────────────────────

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function getAccessToken(): string | null {
  return isBrowser() ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
}

export function setTokens(accessToken: string, refreshToken: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ── Error class ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Refresh logic (evita solicitudes concurrentes) ────────────────────────────

let refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  const refreshToken = isBrowser() ? localStorage.getItem(REFRESH_TOKEN_KEY) : null;
  if (!refreshToken) return null;

  refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) {
        clearTokens();
        if (isBrowser()) window.dispatchEvent(new CustomEvent('auth:expired'));
        return null;
      }
      const json = (await res.json()) as { data: { accessToken: string; refreshToken: string } };
      setTokens(json.data.accessToken, json.data.refreshToken);
      return json.data.accessToken;
    })
    .catch(() => {
      clearTokens();
      if (isBrowser()) window.dispatchEvent(new CustomEvent('auth:expired'));
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

// ── Procesamiento de respuesta ────────────────────────────────────────────────

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as unknown as T;

  const contentType = res.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    if (!res.ok) throw new ApiError(`Error ${res.status}`, res.status);
    return undefined as unknown as T;
  }

  const json = (await res.json()) as unknown;

  if (!res.ok) {
    const err = json as { message?: string | string[]; statusCode?: number };
    const message = Array.isArray(err.message)
      ? err.message.join(', ')
      : (err.message ?? 'Error desconocido');
    throw new ApiError(message, res.status);
  }

  return json as T;
}

// ── Función principal ─────────────────────────────────────────────────────────

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const isFormData = init.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...(init.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  let res = await fetch(url, { ...init, headers });

  if (res.status === 401) {
    const newToken = await tryRefresh();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { ...init, headers });
    } else {
      throw new ApiError('Sesión expirada. Por favor, inicia sesión de nuevo.', 401);
    }
  }

  return handleResponse<T>(res);
}

// ── Helpers de método ─────────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, init?: RequestInit) =>
    apiFetch<T>(path, { ...init, method: 'GET' }),

  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    apiFetch<T>(path, {
      ...init,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    apiFetch<T>(path, {
      ...init,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown, init?: RequestInit) =>
    apiFetch<T>(path, {
      ...init,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  del: <T>(path: string, init?: RequestInit) =>
    apiFetch<T>(path, { ...init, method: 'DELETE' }),
};

// ── Tipos para respuestas del backend ─────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedApiResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
