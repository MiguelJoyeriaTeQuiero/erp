/**
 * Construye un query string a partir de un objeto, omitiendo valores nulos/vacíos.
 * Retorna la cadena sin el "?" inicial para poder concatenar o usar directamente.
 *
 * Ejemplo:
 *   qs({ page: 1, search: '', status: 'OPEN' }) → "page=1&status=OPEN"
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function qs(params: Record<string, any>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value as string | number | boolean));
  }

  const result = search.toString();
  return result ? `?${result}` : '';
}
