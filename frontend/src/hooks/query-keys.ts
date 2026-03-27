/**
 * Fábrica de query keys jerárquicas para TanStack Query.
 *
 * La jerarquía permite invalidar subconjuntos:
 *   queryClient.invalidateQueries({ queryKey: queryKeys.closures.all })
 *   → invalida todos: list, detail, summary, audit, etc.
 *
 *   queryClient.invalidateQueries({ queryKey: queryKeys.closures.detail(id) })
 *   → invalida solo el detalle de ese cierre.
 */

// ── Tipos auxiliares ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Filters = Record<string, any>;

// ── Fábrica ────────────────────────────────────────────────────────────────────

export const queryKeys = {
  // Catálogo
  catalog: {
    all:        ['catalog'] as const,
    metals:     () => ['catalog', 'metals'] as const,
    karats:     (metalTypeId?: string) => ['catalog', 'karats', metalTypeId ?? 'all'] as const,
    categories: () => ['catalog', 'categories'] as const,
  },

  // Usuarios
  users: {
    all:    ['users'] as const,
    lists:  () => ['users', 'list'] as const,
    list:   (filters: Filters) => ['users', 'list', filters] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
  },

  // Clientes
  clients: {
    all:      ['clients'] as const,
    lists:    () => ['clients', 'list'] as const,
    list:     (filters: Filters) => ['clients', 'list', filters] as const,
    detail:   (id: string) => ['clients', 'detail', id] as const,
    closures: (id: string) => ['clients', 'detail', id, 'closures'] as const,
  },

  // Documentos de cliente
  clientDocuments: {
    all:    (clientId: string) => ['clients', 'detail', clientId, 'documents'] as const,
    list:   (clientId: string) => ['clients', 'detail', clientId, 'documents', 'list'] as const,
  },

  // Cierres
  closures: {
    all:     ['closures'] as const,
    lists:   () => ['closures', 'list'] as const,
    list:    (filters: Filters) => ['closures', 'list', filters] as const,
    detail:  (id: string) => ['closures', 'detail', id] as const,
    summary: (id: string) => ['closures', 'detail', id, 'summary'] as const,
    audit:   (id: string) => ['closures', 'detail', id, 'audit'] as const,
    conversions: (id: string) => ['closures', 'detail', id, 'conversions'] as const,
    advance: (id: string) => ['closures', 'detail', id, 'advance'] as const,
  },

  // Recogidas
  collections: {
    all:    ['collections'] as const,
    lists:  () => ['collections', 'list'] as const,
    list:   (filters: Filters) => ['collections', 'list', filters] as const,
    detail: (id: string) => ['collections', 'detail', id] as const,
  },

  // Validaciones
  validations: {
    all:       ['validations'] as const,
    detail:    (id: string) => ['validations', 'detail', id] as const,
    byClosure: (closureId: string) => ['validations', 'closure', closureId] as const,
  },

  // Incidencias
  incidents: {
    all:    ['incidents'] as const,
    lists:  () => ['incidents', 'list'] as const,
    list:   (filters: Filters) => ['incidents', 'list', filters] as const,
    detail: (id: string) => ['incidents', 'detail', id] as const,
  },

  // Tarifas
  pricing: {
    all:     ['pricing'] as const,
    current: (filters: Filters) => ['pricing', 'current', filters] as const,
    history: (filters: Filters) => ['pricing', 'history', filters] as const,
  },

  // Auditoría
  audit: {
    all:      ['audit'] as const,
    lists:    () => ['audit', 'list'] as const,
    list:     (filters: Filters) => ['audit', 'list', filters] as const,
    byEntity: (entityType: string, entityId: string) =>
      ['audit', 'entity', entityType, entityId] as const,
  },
} as const;
