# SPEC.md — Especificación Completa del Sistema de Gestión de Metales Preciosos

---

## 1. RESUMEN DEL PROBLEMA

Empresa mayorista de metales preciosos en Canarias. Compra oro y plata a compro-oros y particulares.

Flujo central: cliente llama → pacta venta ("cierre") → se recoge material (1 o N veces) → se valida en oficina → se resuelven discrepancias → se completa la operación.

El sistema debe garantizar trazabilidad total, control de estados, conversiones de quilataje por pureza, gestión de incidencias, generación de albaranes PDF, e interfaz práctica para uso diario desde oficina, tablet y móvil.

Volumen: +100 cierres/semana, ~10 usuarios simultáneos, 1 oficina central. Idioma: español.

---

## 2. SUPUESTOS DE NEGOCIO

### Clientes
- CIF/NIF es único por cliente. No duplicados.
- Documentos PDF sin tipología obligatoria (DNI, escrituras, etc.).
- La categoría puede cambiar sin afectar cierres ya confirmados.

### Cierres
- Identificador: CIE{AA}-{secuencial anual global}. Ejemplo: CIE26-1, CIE26-2...
- Secuencial se reinicia cada 1 de enero.
- Borrador editable. Confirmado: inmutable en contenido base.
- Confirmación explícita por usuario de oficina.
- Cancelación posible si no hay validaciones completadas.
- Si tiene adelanto y se cancela, se genera incidencia financiera (gestión manual fuera del sistema).

### Precios
- Tarifa dinámica cada 30 segundos (simulada con cron).
- Categoría de cliente aplica multiplicador sobre precio base.
- Precio congelado POR LÍNEA al confirmar.
- Si existe tarifa personalizada por cliente, tiene prioridad sobre categoría.

### Recogidas
- Comercial crea desde móvil/tablet en campo.
- Puede contener quilatajes distintos a los pactados (dispara conversión).
- Sin firma digital en MVP.

### Conversiones
- Fórmula: `gramos_equivalentes = gramos_entregados × (pureza_entregada / pureza_pactada)`
- Importe del cierre NUNCA cambia.
- Automática si mismo metal, distinto quilataje.
- Si metal distinto o desconocido → incidencia.

### Validación
- Línea a línea o por recogida completa (ambas coexisten).
- Múltiples sesiones por recogida.
- Corrección SIEMPRE requiere observación obligatoria.

### Incidencias
- Automáticas: falta material, chatarra, discrepancia gramos, material no convertible.
- Manuales: por oficina o validador.
- Resuelta = no reabreable (MVP).

### Adelantos
- Máximo 1 por cierre, máximo 75% del total.
- Métodos: efectivo, transferencia, otro.
- No modificable, solo cancelable con el cierre.

### Auditoría
- Registro: usuario, fecha/hora, acción, entidad, ID, before/after JSON.
- Inmutable. Sin updatedAt ni deletedAt.

---

## 3. MODELO DE DOMINIO

### 3.1 Enums

```
ClientType: COMPANY | INDIVIDUAL

ClosureStatus: DRAFT | CONFIRMED | WITH_ADVANCE | PENDING_COLLECTION | PARTIAL_COLLECTION |
               PENDING_VALIDATION | IN_VALIDATION | WITH_INCIDENTS | VALIDATED | COMPLETED | CANCELLED

CollectionStatus: REGISTERED | VALIDATED | WITH_INCIDENTS | COMPLETED | CANCELLED

IncidentType: INVALID_MATERIAL | PENDING_COLLECTION | DIFFERENCE | SCRAP |
              PENDING_CONVERSION | VALIDATION_DISCREPANCY | ADVANCE_REFUND

IncidentStatus: OPEN | IN_REVIEW | RESOLVED | CANCELLED

ValidationStatus: IN_PROGRESS | APPROVED | REJECTED

ConversionType: AUTOMATIC | MANUAL
ConversionStatus: PENDING | APPLIED | REJECTED

PaymentMethod: CASH | TRANSFER | OTHER

DeliveryNoteStatus: GENERATED | SENT | VOIDED

AuditAction: CREATE | UPDATE | DELETE | CONFIRM | CANCEL | APPROVE | REJECT | UPLOAD | DOWNLOAD | CONVERT
```

### 3.2 Entidades

#### User
- id: UUID PK
- email: string unique
- name: string
- passwordHash: string
- roleId: FK → Role
- isActive: boolean default true
- refreshToken: string nullable
- createdAt, updatedAt, deletedAt (nullable)

#### Role
- id: UUID PK
- name: string unique (admin, oficina, comercial, validador)
- description: string
- createdAt

#### Permission
- id: UUID PK
- code: string unique (ej: closure.create, closure.confirm, collection.create...)
- description: string
- module: string

#### RolePermission
- id: UUID PK
- roleId: FK → Role
- permissionId: FK → Permission
- Unique: [roleId, permissionId]

#### Client
- id: UUID PK
- type: ClientType
- commercialName: string
- legalName: string
- taxId: string unique (CIF/NIF)
- phone: string
- address: string
- contactPerson: string
- categoryId: FK → ClientCategory
- isActive: boolean default true
- createdBy: FK → User
- createdAt, updatedAt, deletedAt (nullable)

#### ClientCategory
- id: UUID PK
- name: string unique (estándar, preferente, premium, personalizada)
- slug: string unique
- priceMultiplier: Decimal(5,4) (ej: 1.0000, 1.0150, 1.0300)
- description: string nullable
- isActive: boolean default true
- sortOrder: int

#### ClientDocument
- id: UUID PK
- clientId: FK → Client
- originalName: string
- storedPath: string
- mimeType: string (solo application/pdf)
- sizeBytes: int (max 10MB)
- uploadedBy: FK → User
- createdAt, deletedAt (nullable)

#### MetalType
- id: UUID PK
- name: string (Oro, Plata)
- code: string unique (GOLD, SILVER)
- isActive: boolean default true
- sortOrder: int

#### KaratCatalog
- id: UUID PK
- metalTypeId: FK → MetalType
- label: string (18k, 14k, 925, etc.)
- purity: Decimal(5,4) (0.7500, 0.5833, 0.9250...)
- isCommon: boolean (true = botón rápido en UI)
- sortOrder: int
- isActive: boolean default true
- Unique: [metalTypeId, label]

Purezas de referencia:
| Quilataje | Metal | Pureza |
|-----------|-------|--------|
| 24k       | Oro   | 0.9999 |
| 22k       | Oro   | 0.9167 |
| 18k       | Oro   | 0.7500 |
| 14k       | Oro   | 0.5833 |
| 9k        | Oro   | 0.3750 |
| 999       | Plata | 0.9990 |
| 925       | Plata | 0.9250 |
| 825       | Plata | 0.8250 |

#### PriceRate
- id: UUID PK
- metalTypeId: FK → MetalType
- karatId: FK → KaratCatalog
- categoryId: FK → ClientCategory
- pricePerGram: Decimal(12,2)
- validFrom: datetime
- validUntil: datetime nullable
- isActive: boolean default true
- createdBy: FK → User nullable
- createdAt
- Index: [metalTypeId, karatId, categoryId, isActive]

#### DealClosure
- id: UUID PK
- code: string unique (CIE26-1)
- sequenceNumber: int
- year: int
- clientId: FK → Client
- status: ClosureStatus default DRAFT
- totalAmount: Decimal(12,2)
- advanceAmount: Decimal(12,2) default 0
- finalAmount: Decimal(12,2) (totalAmount - advanceAmount)
- observations: text nullable
- version: int default 1 (optimistic locking)
- createdBy: FK → User
- confirmedBy: FK → User nullable
- confirmedAt: datetime nullable
- completedAt: datetime nullable
- cancelledAt: datetime nullable
- cancelledBy: FK → User nullable
- cancellationReason: text nullable
- createdAt, updatedAt, deletedAt (nullable)
- Index: [status], [clientId], [year, sequenceNumber]

#### DealClosureLine
- id: UUID PK
- closureId: FK → DealClosure
- metalTypeId: FK → MetalType
- karatId: FK → KaratCatalog
- grams: Decimal(10,2)
- pricePerGram: Decimal(12,2) (congelado al confirmar)
- lineAmount: Decimal(12,2) (grams × pricePerGram)
- puritySnapshot: Decimal(5,4)
- sortOrder: int
- createdAt, updatedAt

#### AdvancePayment
- id: UUID PK
- closureId: FK → DealClosure (unique, relación 1:0..1)
- amount: Decimal(12,2) (max 75% totalAmount)
- paymentMethod: PaymentMethod
- pricePerGramSnapshot: Decimal(12,2)
- gramsSnapshot: Decimal(10,2)
- authorizedBy: FK → User
- observations: text nullable
- createdAt
- cancelledAt: datetime nullable

#### Collection
- id: UUID PK
- closureId: FK → DealClosure
- status: CollectionStatus default REGISTERED
- collectorId: FK → User
- observations: text nullable
- isPartial: boolean
- collectedAt: datetime
- createdAt, updatedAt

#### CollectionLine
- id: UUID PK
- collectionId: FK → Collection
- metalTypeId: FK → MetalType
- karatId: FK → KaratCatalog
- gramsDeclared: Decimal(10,2)
- puritySnapshot: Decimal(5,4)
- createdAt, updatedAt

#### Conversion
- id: UUID PK
- collectionLineId: FK → CollectionLine
- closureLineId: FK → DealClosureLine (línea pactada contra la que se convierte)
- sourceKaratId: FK → KaratCatalog
- targetKaratId: FK → KaratCatalog
- sourceGrams: Decimal(10,2)
- sourcePurity: Decimal(5,4)
- targetPurity: Decimal(5,4)
- equivalentGrams: Decimal(10,2)
- conversionType: ConversionType
- status: ConversionStatus default PENDING
- observation: text nullable (obligatorio si MANUAL)
- appliedBy: FK → User
- createdAt, updatedAt

#### ValidationSession
- id: UUID PK
- collectionId: FK → Collection nullable
- closureId: FK → DealClosure
- validatorId: FK → User
- status: ValidationStatus default IN_PROGRESS
- observations: text nullable
- createdAt, updatedAt

#### ValidationLine
- id: UUID PK
- sessionId: FK → ValidationSession
- closureLineId: FK → DealClosureLine nullable
- collectionLineId: FK → CollectionLine nullable
- gramsValidated: Decimal(10,2)
- karatValidatedId: FK → KaratCatalog
- purityValidated: Decimal(5,4)
- observation: text nullable (obligatorio si hay corrección)
- createdAt

#### Incident
- id: UUID PK
- closureId: FK → DealClosure
- collectionId: FK → Collection nullable
- validationSessionId: FK → ValidationSession nullable
- type: IncidentType
- status: IncidentStatus default OPEN
- reason: text (obligatorio)
- resolution: text nullable
- resolvedBy: FK → User nullable
- resolvedAt: datetime nullable
- createdBy: FK → User
- createdAt, updatedAt

#### DeliveryNote
- id: UUID PK
- closureId: FK → DealClosure
- code: string unique
- filePath: string
- status: DeliveryNoteStatus default GENERATED
- generatedBy: FK → User
- createdAt, updatedAt

#### AuditLog
- id: UUID PK
- userId: FK → User
- entityType: string
- entityId: string
- action: AuditAction
- beforeData: Json nullable
- afterData: Json nullable
- ipAddress: string nullable
- userAgent: string nullable
- createdAt
- (Sin updatedAt ni deletedAt — inmutable)

---

## 4. ESTADOS Y TRANSICIONES

### 4.1 Máquina de estados del cierre (DealClosure)

```
DRAFT ──confirmar()──→ CONFIRMED
CONFIRMED ──registrarAdelanto()──→ WITH_ADVANCE
CONFIRMED | WITH_ADVANCE ──crearRecogida()──→ PENDING_COLLECTION
PENDING_COLLECTION ──registrarRecogida(parcial)──→ PARTIAL_COLLECTION
PENDING_COLLECTION ──registrarRecogida(completa)──→ PENDING_VALIDATION
PARTIAL_COLLECTION ──registrarRecogida(completa)──→ PENDING_VALIDATION
PARTIAL_COLLECTION ──(quedan gramos)──→ PENDING_COLLECTION
PENDING_VALIDATION ──iniciarValidacion()──→ IN_VALIDATION
IN_VALIDATION ──detectarDiscrepancia()──→ WITH_INCIDENTS
IN_VALIDATION ──aprobarValidacion()──→ VALIDATED
WITH_INCIDENTS ──resolverTodas()──→ PENDING_VALIDATION
WITH_INCIDENTS ──nuevaRecogida()──→ PENDING_COLLECTION
VALIDATED ──completar()──→ COMPLETED
Cualquiera (excepto COMPLETED) ──cancelar()──→ CANCELLED
```

Estados terminales: COMPLETED, CANCELLED.

Transiciones inválidas:
- COMPLETED → cualquiera
- CANCELLED → cualquiera
- DRAFT → PENDING_COLLECTION (debe confirmarse)
- CONFIRMED → COMPLETED (debe pasar por recogida+validación)

### 4.2 Otros estados

Recogida: REGISTERED → VALIDATED → COMPLETED | CANCELLED | WITH_INCIDENTS
Incidencia: OPEN → IN_REVIEW → RESOLVED | CANCELLED
Validación: IN_PROGRESS → APPROVED | REJECTED
Conversión: PENDING → APPLIED | REJECTED
Albarán: GENERATED → SENT | VOIDED

### 4.3 Cambios automáticos
1. Confirmar cierre → genera albarán PDF, congela precios
2. Crear 1ª recogida → cierre pasa a PENDING_COLLECTION
3. Completar recogida → compara acumulado vs pactado → PENDING_VALIDATION o PARTIAL_COLLECTION
4. Quilataje distinto en recogida → crea Conversion PENDING (mismo metal) o Incident (otro metal)
5. Rechazar líneas en validación → genera incidencias, cierre → WITH_INCIDENTS
6. Resolver todas las incidencias → cierre → PENDING_VALIDATION
7. Cancelar cierre con adelanto → genera Incident tipo ADVANCE_REFUND

---

## 5. API REST

### Convenciones
- Base: /api/v1
- Auth: Bearer JWT
- Paginación: ?page=1&limit=20 → { data, meta: { total, page, limit, totalPages } }
- Decimales como string en JSON ("123.45")
- Errores: { statusCode, message, error, details? }
- Fechas: ISO 8601

### Endpoints

#### Auth
- POST /auth/login — público
- POST /auth/refresh — autenticado
- POST /auth/logout — autenticado
- GET /auth/me — autenticado

#### Users (admin)
- GET /users
- POST /users
- GET /users/:id
- PATCH /users/:id
- DELETE /users/:id (soft delete)

#### Catalog (metals, karats, categories)
- GET /catalog/metals — autenticado
- GET /catalog/karats?metalTypeId=xxx — autenticado
- GET /catalog/karats/common — autenticado
- POST /catalog/karats — admin
- PATCH /catalog/karats/:id — admin
- GET /catalog/client-categories — autenticado
- POST /catalog/client-categories — admin

#### Clients
- GET /clients?search=&type=&categoryId=&page=&limit= — autenticado
- POST /clients — admin, oficina
- GET /clients/:id — autenticado
- PATCH /clients/:id — admin, oficina
- DELETE /clients/:id — admin (soft delete)
- GET /clients/:id/closures — autenticado

#### Client Documents
- GET /clients/:clientId/documents — autenticado
- POST /clients/:clientId/documents — admin, oficina (multipart, max 10MB, solo PDF)
- GET /clients/:clientId/documents/:docId/download — autenticado
- DELETE /clients/:clientId/documents/:docId — admin, oficina (soft delete)

#### Pricing
- GET /pricing/rates?metalTypeId=&karatId=&categoryId= — autenticado
- GET /pricing/rates/current?metalTypeId=&karatId=&categoryId= — autenticado
- POST /pricing/rates — admin
- GET /pricing/rates/history — admin

#### Closures
- GET /closures?status=&clientId=&createdBy=&dateFrom=&dateTo=&page=&limit=&sortBy=&sortOrder= — autenticado
- POST /closures — admin, oficina
- GET /closures/:id — autenticado (incluye líneas, recogidas, validaciones, incidencias)
- PATCH /closures/:id — admin, oficina (solo DRAFT)
- POST /closures/:id/confirm — admin, oficina
- POST /closures/:id/cancel — admin, oficina
- POST /closures/:id/complete — admin, oficina
- GET /closures/:id/summary — autenticado (conciliación pactado vs recogido vs validado)
- GET /closures/:id/audit — autenticado

#### Closure Lines (solo estado DRAFT)
- POST /closures/:id/lines — admin, oficina
- PATCH /closures/:id/lines/:lineId — admin, oficina
- DELETE /closures/:id/lines/:lineId — admin, oficina

#### Advances
- POST /closures/:id/advance — admin, oficina
- GET /closures/:id/advance — autenticado

#### Collections
- GET /collections?closureId=&collectorId=&status=&dateFrom=&dateTo= — autenticado
- POST /closures/:closureId/collections — admin, oficina, comercial
- GET /collections/:id — autenticado
- PATCH /collections/:id — admin, oficina, comercial
- POST /collections/:id/lines — admin, oficina, comercial

#### Conversions
- GET /closures/:closureId/conversions — autenticado
- POST /conversions/:id/apply — admin, oficina, validador
- POST /conversions/:id/reject — admin, oficina, validador

#### Validations
- POST /closures/:closureId/validations — admin, oficina, validador
- GET /validations/:id — autenticado
- POST /validations/:id/lines — admin, oficina, validador
- POST /validations/:id/approve — admin, oficina, validador
- POST /validations/:id/reject — admin, oficina, validador

#### Incidents
- GET /incidents?closureId=&type=&status=&dateFrom=&dateTo= — autenticado
- POST /incidents — admin, oficina, validador
- GET /incidents/:id — autenticado
- PATCH /incidents/:id — admin, oficina, validador
- POST /incidents/:id/resolve — admin, oficina, validador
- POST /incidents/:id/cancel — admin, oficina

#### Delivery Notes
- GET /closures/:closureId/delivery-note — autenticado
- POST /closures/:closureId/delivery-note/regenerate — admin, oficina

#### Audit
- GET /audit?entityType=&entityId=&userId=&action=&dateFrom=&dateTo= — admin
- GET /audit/entity/:entityType/:entityId — autenticado

---

## 6. PERMISOS POR ROL

| Acción | admin | oficina | comercial | validador |
|--------|-------|---------|-----------|-----------|
| Gestionar usuarios | ✓ | — | — | — |
| Gestionar catálogo/tarifas | ✓ | — | — | — |
| Ver auditoría global | ✓ | — | — | — |
| Crear/editar cliente | ✓ | ✓ | — | — |
| Ver clientes | ✓ | ✓ | ✓ | ✓ |
| Subir documentos | ✓ | ✓ | — | — |
| Crear cierre | ✓ | ✓ | — | — |
| Editar borrador | ✓ | ✓ | — | — |
| Confirmar cierre | ✓ | ✓ | — | — |
| Cancelar cierre | ✓ | ✓ | — | — |
| Completar cierre | ✓ | ✓ | — | — |
| Ver cierres | ✓ | ✓ | ✓ | ✓ |
| Registrar adelanto | ✓ | ✓ | — | — |
| Crear recogida | ✓ | ✓ | ✓ | — |
| Ver recogidas | ✓ | ✓ | ✓ | ✓ |
| Aprobar/rechazar conversión | ✓ | ✓ | — | ✓ |
| Crear sesión validación | ✓ | ✓ | — | ✓ |
| Aprobar validación | ✓ | — | — | ✓ |
| Crear incidencia | ✓ | ✓ | — | ✓ |
| Resolver incidencia | ✓ | ✓ | — | ✓ |
| Ver incidencias | ✓ | ✓ | ✓ | ✓ |

---

## 7. SERVICIOS DE DOMINIO

### ConversionService
- `calculateEquivalent(sourceGrams, sourcePurity, targetPurity)`: Decimal
- `createAutoConversion(collectionLine, closureLine)`: Conversion
- `applyConversion(conversionId, userId)`: void
- `rejectConversion(conversionId, userId, reason)`: void

### StateMachineService
- `canTransition(currentStatus, targetStatus)`: boolean
- `transition(closure, targetStatus, userId)`: DealClosure
- `getAvailableTransitions(currentStatus)`: ClosureStatus[]
- Valida todas las precondiciones antes de permitir transición

### PricingCalculatorService
- `calculateLineAmount(grams, pricePerGram)`: Decimal
- `calculateTotalAmount(lines)`: Decimal
- `getCurrentPrice(metalTypeId, karatId, categoryId)`: Decimal
- `freezePrices(closure)`: void — snapshot de precios en cada línea

### ReconciliationService
- `getReconciliationSummary(closureId)`: { agreed[], collected[], validated[], pending[], incidents[] }
- `isFullyCollected(closureId)`: boolean
- `isFullyValidated(closureId)`: boolean
- `canComplete(closureId)`: boolean

### IncidentGeneratorService
- `checkCollectionGaps(closureId, collectionId)`: Incident[]
- `checkValidationDiscrepancies(validationSessionId)`: Incident[]
- `createAdvanceRefundIncident(closureId)`: Incident
- `areAllResolved(closureId)`: boolean

---

## 8. FRONTEND — PANTALLAS

### Layout
- Desktop/tablet: sidebar colapsable + header con breadcrumbs
- Mobile: bottom nav (Dashboard, Cierres, Recogidas, Incidencias) + hamburguesa

### Rutas
```
(auth)/login
(dashboard)/dashboard
(dashboard)/clientes — listado
(dashboard)/clientes/nuevo
(dashboard)/clientes/[id] — detalle + documentos
(dashboard)/clientes/[id]/editar
(dashboard)/cierres — listado con filtros
(dashboard)/cierres/nuevo
(dashboard)/cierres/[id] — detalle completo + timeline
(dashboard)/cierres/[id]/adelanto
(dashboard)/cierres/[id]/recogidas/nueva
(dashboard)/cierres/[id]/recogidas/[recogidaId]
(dashboard)/cierres/[id]/validacion
(dashboard)/cierres/[id]/albaran
(dashboard)/recogidas — listado global
(dashboard)/incidencias — listado global
(dashboard)/incidencias/[id] — detalle + resolución
(dashboard)/tarifas
(dashboard)/usuarios
(dashboard)/auditoria
```

### Hooks
- useAuth: login, logout, refresh, me
- useClients: list, detail, create, update, delete
- useClientDocuments: list, upload, delete
- useClosures: list, detail, summary, audit, create, update, confirm, cancel, complete
- useClosureLines: addLine, updateLine, deleteLine
- useAdvances: detail, create
- useCollections: list, detail, create, update, addLine
- useValidations: detail, createSession, addLine, approve, reject
- useIncidents: list, detail, create, update, resolve, cancel
- usePricing: currentRates, history, createRate
- useAudit: list, byEntity
- useCatalog: metals, karats, categories

### Componentes compartidos
- DataTable (TanStack Table wrapper con paginación, filtros, sort)
- StatusBadge (color por estado)
- Timeline (cronología inversa con iconos)
- MetalKaratSelector (botones rápidos + desplegable)
- GramsInput (decimal 2 cifras con validación)
- PriceDisplay (precio actual + indicador de refresco)
- FileUpload (drag&drop, validación tipo/tamaño)
- ConfirmDialog (modal de confirmación)
- ComparisonTable (3 columnas: pactado/recogido/validado)
- EmptyState, LoadingSkeleton

---

## 9. SEEDS

### Nivel 1 — Catálogo
- MetalType: Oro (GOLD), Plata (SILVER)
- KaratCatalog: 24k, 22k, 18k, 14k, 9k (oro) + 999, 925, 825 (plata) con purezas
- ClientCategory: estándar (1.0000), preferente (1.0150), premium (1.0300), personalizada (1.0000)
- Roles: admin, oficina, comercial, validador
- Permisos: todos los granulares por módulo

### Nivel 2 — Usuarios
- admin@demo.com (admin) — Password: Demo1234!
- oficina@demo.com (oficina)
- comercial@demo.com (comercial)
- validador@demo.com (validador)

### Nivel 3 — Clientes
- 3 empresas/compro-oro (distintas categorías)
- 2 personas físicas (categoría estándar)

### Nivel 4 — Tarifas
- Precios base vigentes para todas las combinaciones

### Nivel 5 — Operaciones demo
Un cierre por cada caso de uso:
1. Flujo completo sin adelanto (COMPLETED)
2. Con adelanto + recogida parcial (PENDING_COLLECTION)
3. Con conversión de quilataje (VALIDATED)
4. Con chatarra detectada (WITH_INCIDENTS)
5. Cancelado con adelanto (CANCELLED)
6. Persona física con documentos (CONFIRMED)

---

## 10. CASOS DE USO OBLIGATORIOS

### Caso 1 — Flujo simple
Cliente pacta → oficina crea cierre → confirma → comercial recoge todo → oficina valida OK → completado.

### Caso 2 — Con adelanto y recogida parcial
Cliente pacta → se registra adelanto → comercial recoge parte → queda pendiente → 2ª recogida completa → validación OK → completado.

### Caso 3 — Conversión de quilataje
Se pacta 18k → recogida entrega 14k → conversión automática por pureza → validación confirma equivalencia → completado.

### Caso 4 — Chatarra detectada
Comercial recoge → oficina detecta chatarra → incidencia → nueva recogida → completado.

### Caso 5 — Cancelación
Se cancela → trazabilidad. Si tenía adelanto → incidencia ADVANCE_REFUND.

### Caso 6 — Persona física
Crear ficha → subir PDFs documentación → cierre → albarán.

---

## 11. DECISIONES TÉCNICAS

- Decimal para dinero (12,2), gramos (10,2), purezas (5,4) — NUNCA float
- Optimistic locking con campo version en DealClosure
- Transacciones Prisma $transaction con Serializable para operaciones críticas
- Secuencia PostgreSQL para código de cierre
- Almacenamiento: interfaz IStorageService (local → S3)
- PDFs: pdfkit en backend
- Auditoría: AuditInterceptor global + llamadas explícitas en servicios de dominio
- Permisos: JWT → RolesGuard → PermissionsGuard (3 niveles)
- Frontend: hooks encapsulan TanStack Query, componentes nunca llaman API directo
