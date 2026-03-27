# Te Quiero Metales — ERP de Gestión de Metales Preciosos

Sistema de gestión web para empresa mayorista de compra de oro y plata en Canarias.
Cubre el ciclo de vida completo de una operación: desde el registro del cierre con el cliente hasta la validación del material en laboratorio, incluyendo recogidas, conversiones de quilataje, adelantos e incidencias.

---

## Índice

- [Características principales](#características-principales)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Requisitos previos](#requisitos-previos)
- [Instalación con Docker](#instalación-con-docker-recomendado)
- [Instalación en desarrollo local](#instalación-en-desarrollo-local)
- [Variables de entorno](#variables-de-entorno)
- [Usuarios demo](#usuarios-demo)
- [Casos de uso principales](#casos-de-uso-principales)
- [Estructura del proyecto](#estructura-del-proyecto)
- [API y documentación Swagger](#api-y-documentación-swagger)
- [Tests](#tests)
- [Comandos útiles](#comandos-útiles)
- [Backlog de mejoras futuras](#backlog-de-mejoras-futuras)

---

## Características principales

- **Gestión de cierres** — registro, confirmación y seguimiento de operaciones de compra con clientes (empresa y particular)
- **Control de precios** — tarifas por metal, quilataje y categoría de cliente con historial de cambios y cron de actualización
- **Recogidas** — registro de entregas de material (parciales y totales) con geolocalización y firma
- **Conversiones de quilataje** — cuando el cliente entrega un metal distinto al pactado, el sistema calcula automáticamente el equivalente en gramos
- **Validación en laboratorio** — sesiones de validación con medición de pureza real; generación automática de incidencias si hay discrepancias
- **Adelantos** — hasta el 75 % del total del cierre, con control de un único adelanto por operación
- **Incidencias automáticas** — chatarra, material faltante, diferencia de gramos, material no convertible, reembolso de adelanto
- **Auditoría completa** — registro de todas las operaciones de escritura con usuario, IP y timestamps
- **Generación de PDF** — albarán de recogida exportable
- **Control de acceso por rol** — admin, oficina, comercial, validador con permisos granulares
- **Documentación Swagger** — OpenAPI completa con autenticación Bearer

---

## Stack tecnológico

### Backend
| Tecnología | Versión | Propósito |
|---|---|---|
| **NestJS** | 11.x | Framework API REST |
| **PostgreSQL** | 16 | Base de datos relacional |
| **Prisma ORM** | 7.x | ORM con adaptador pg nativo |
| **JWT + Passport** | — | Autenticación con refresh token |
| **class-validator** | 0.14 | Validación de DTOs |
| **pdfkit** | 0.18 | Generación de albaranes PDF |
| **@nestjs/schedule** | 6.x | Cron jobs de actualización de precios |
| **bcrypt** | 6.x | Hash de contraseñas |
| **Swagger/OpenAPI** | 11.x | Documentación automática de la API |

### Frontend
| Tecnología | Versión | Propósito |
|---|---|---|
| **Next.js** | 16.x | Framework React con App Router |
| **React** | 19.x | Interfaz de usuario |
| **TypeScript** | 5.x | Tipado estático |
| **Tailwind CSS** | 4.x | Estilos utility-first |
| **shadcn/ui** | 4.x | Componentes de UI accesibles |
| **TanStack Query** | 5.x | Fetching, caché y sincronización de datos |
| **TanStack Table** | 8.x | Tablas con paginación y filtros |
| **React Hook Form** | 7.x | Gestión de formularios |
| **Zod** | 4.x | Validación de esquemas |
| **date-fns** | 4.x | Formateo de fechas en español |
| **nuqs** | 2.x | Query params tipados en URL |

### Infraestructura
| Tecnología | Propósito |
|---|---|
| **Docker + Compose** | Contenedorización completa (postgres, backend, frontend) |
| **Alpine Linux** | Imagen base ligera para contenedores |

---

## Arquitectura

```
┌──────────────────────────────────────────────────────┐
│                    Navegador                          │
│              Next.js App Router (puerto 3000)         │
│    React + TanStack Query + shadcn/ui + Tailwind      │
└─────────────────────┬────────────────────────────────┘
                      │ HTTP/JSON  (NEXT_PUBLIC_API_URL)
┌─────────────────────▼────────────────────────────────┐
│              NestJS API (puerto 3001)                 │
│                                                       │
│  Controllers → Guards → Services → Prisma ORM        │
│                                                       │
│  Módulos: auth, catalog, clients, closures,           │
│           collections, validations, incidents,        │
│           pricing, advances, pdf, audit               │
│                                                       │
│  Domain services (lógica de negocio pura):            │
│    StateMachine · Conversion · Reconciliation         │
│    PricingCalculator · IncidentGenerator              │
└─────────────────────┬────────────────────────────────┘
                      │ Prisma (adapter-pg)
┌─────────────────────▼────────────────────────────────┐
│              PostgreSQL 16 (puerto 5432)              │
│   11 entidades principales + audit + delivery notes   │
└──────────────────────────────────────────────────────┘
```

### Flujo de estados de un cierre

```
DRAFT → CONFIRMED → WITH_ADVANCE ──────────────────────┐
                  ↓                                     │
           PENDING_COLLECTION                           │
                  ↓                                     │
         PARTIAL_COLLECTION                             │
                  ↓                                     │
           IN_VALIDATION                                │
                  ↓                                     │
         WITH_INCIDENTS                                 │
                  ↓ (resueltas)                         │
      PENDING_VALIDATION                                │
                  ↓                                     │
            VALIDATED                                   │
                  ↓                                     │
           COMPLETED ←──────────────────────────────────┘
           CANCELLED  (desde cualquier estado no terminal)
```

---

## Requisitos previos

### Con Docker (recomendado)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ≥ 24.x
- Docker Compose ≥ 2.x (incluido en Docker Desktop)

### Desarrollo local
- Node.js ≥ 22.x
- npm ≥ 10.x
- PostgreSQL ≥ 16.x (instancia local o remota)

---

## Instalación con Docker (recomendado)

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd tequierometales-erp
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` y establecer obligatoriamente:
```dotenv
JWT_SECRET=<cadena-aleatoria-de-al-menos-32-caracteres>
JWT_REFRESH_SECRET=<otra-cadena-aleatoria-diferente>
```

> **Generar claves seguras:** `openssl rand -base64 48`

### 3. Construir e iniciar los servicios

```bash
docker compose up -d --build
```

Esto arranca tres contenedores:
- `tequierometales-db` — PostgreSQL 16
- `tequierometales-backend` — API NestJS (aplica migraciones automáticamente al iniciar)
- `tequierometales-frontend` — Next.js

Esperar a que el backend esté healthy (≈40 segundos):
```bash
docker compose ps
```

### 4. Cargar datos demo (seed)

```bash
docker compose exec backend npx prisma db seed
```

Esto crea el catálogo base, 4 usuarios demo, 5 clientes y 6 cierres en distintos estados que ilustran todos los casos de uso.

### 5. Acceder a la aplicación

| Servicio | URL |
|---|---|
| **Aplicación web** | http://localhost:3000 |
| **API REST** | http://localhost:3001/api/v1 |
| **Swagger / OpenAPI** | http://localhost:3001/api/docs |
| **PostgreSQL** | localhost:5432 |

### Parar los servicios

```bash
docker compose down          # Para y elimina contenedores (datos persistidos)
docker compose down -v       # Para + elimina datos de PostgreSQL y uploads
```

---

## Instalación en desarrollo local

### 1. Backend

```bash
cd backend
cp .env.example .env         # Ajustar DATABASE_URL con tu instancia de PostgreSQL
npm install
npx prisma migrate dev       # Crear/aplicar migraciones
npx prisma db seed           # Cargar datos demo
npm run start:dev            # Servidor en http://localhost:3001
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local   # Ajustar NEXT_PUBLIC_API_URL si es necesario
npm install
npm run dev                  # Servidor en http://localhost:3000
```

### Desarrollo con recarga automática

```bash
# Terminal 1 — Backend con watch
cd backend && npm run start:dev

# Terminal 2 — Frontend con HMR
cd frontend && npm run dev
```

---

## Variables de entorno

### Backend (`backend/.env`)

| Variable | Defecto | Obligatorio | Descripción |
|---|---|:---:|---|
| `DATABASE_URL` | — | ✅ | URL de conexión PostgreSQL |
| `JWT_SECRET` | — | ✅ | Clave para firmar access tokens |
| `JWT_REFRESH_SECRET` | — | ✅ | Clave para firmar refresh tokens (distinta) |
| `JWT_EXPIRES_IN` | `15m` | — | Duración del access token |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | — | Duración del refresh token |
| `PORT` | `3001` | — | Puerto del servidor NestJS |
| `NODE_ENV` | `development` | — | Entorno (`development` / `production`) |
| `CORS_ORIGIN` | `http://localhost:3000` | — | Origen permitido para CORS |
| `STORAGE_DRIVER` | `local` | — | Driver de almacenamiento (`local` / `s3`) |
| `STORAGE_LOCAL_PATH` | `./uploads` | — | Ruta local para archivos (driver local) |
| `STORAGE_S3_BUCKET` | — | — | Bucket de S3 (driver s3) |
| `STORAGE_S3_REGION` | — | — | Región AWS (driver s3) |
| `STORAGE_S3_ACCESS_KEY` | — | — | Access key AWS (driver s3) |
| `STORAGE_S3_SECRET_KEY` | — | — | Secret key AWS (driver s3) |
| `PRICE_UPDATE_INTERVAL_SECONDS` | `30` | — | Intervalo del cron de precios (segundos) |

### Frontend (`frontend/.env.local`)

| Variable | Defecto | Obligatorio | Descripción |
|---|---|:---:|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api/v1` | — | URL base del backend (vista desde el navegador) |

### Docker Compose (`.env` en la raíz)

| Variable | Defecto | Obligatorio | Descripción |
|---|---|:---:|---|
| `POSTGRES_USER` | `postgres` | — | Usuario de PostgreSQL |
| `POSTGRES_PASSWORD` | `postgres` | — | Contraseña de PostgreSQL |
| `POSTGRES_DB` | `tequierometales` | — | Nombre de la base de datos |
| `POSTGRES_PORT` | `5432` | — | Puerto expuesto de PostgreSQL |
| `JWT_SECRET` | — | ✅ | Clave JWT del backend |
| `JWT_REFRESH_SECRET` | — | ✅ | Clave refresh JWT del backend |
| `BACKEND_PORT` | `3001` | — | Puerto expuesto del backend |
| `FRONTEND_PORT` | `3000` | — | Puerto expuesto del frontend |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api/v1` | — | URL de la API (baked in en build) |
| `CORS_ORIGIN` | `http://localhost:3000` | — | Origen CORS permitido |
| `NODE_ENV` | `production` | — | Entorno de ejecución |

> ⚠️ **Despliegue en servidor remoto**: cambiar `localhost` por la IP o dominio del servidor en `NEXT_PUBLIC_API_URL` y `CORS_ORIGIN`. El frontend debe **reconstruirse** tras cambiar `NEXT_PUBLIC_API_URL` (se incrusta en el bundle en tiempo de compilación).

---

## Usuarios demo

Todos los usuarios tienen la contraseña: **`Demo1234!`**

| Email | Rol | Permisos principales |
|---|---|---|
| `admin@demo.com` | **Administrador** | Acceso total al sistema |
| `oficina@demo.com` | **Oficina** | Cierres, clientes, adelantos, validaciones, incidencias |
| `comercial@demo.com` | **Comercial** | Ver cierres, registrar recogidas |
| `validador@demo.com` | **Validador** | Crear sesiones de validación, aprobar/rechazar |

---

## Casos de uso principales

El seed incluye 6 cierres demo que ilustran todos los estados y flujos del sistema:

### Caso 1 — Flujo completo sin incidencias (`CIE25-001` · COMPLETADO)
**Cliente:** Oro Express (categoría Premium)
**Material:** 100 g Oro 18k · precio congelado 42,49 €/g · total **4.249,00 €**

> El flujo más habitual. El cliente entrega el material pactado, el comercial registra la recogida íntegra, el validador aprueba la sesión y el usuario de oficina completa la operación.

```
DRAFT → CONFIRMED → PENDING_COLLECTION → IN_VALIDATION → VALIDATED → COMPLETED
```

### Caso 2 — Recogida parcial con adelanto (`CIE25-002` · RECOGIDA PARCIAL)
**Cliente:** Metales Canarias (categoría Preferente)
**Material:** 200 g Oro 18k · precio 41,87 €/g · total **8.374,00 €**
**Adelanto:** 6.280,50 € por transferencia bancaria (75 %)
**Recogida:** 80 g entregados de 200 g pactados (pendiente segunda visita)

> Ilustra el adelanto previo a la recogida completa y la recogida en múltiples visitas.

### Caso 3 — Conversión de quilataje (`CIE25-003` · VALIDADO)
**Cliente:** GoldPoint Tenerife (categoría Estándar)
**Pactado:** 100 g Oro 18k · precio 41,25 €/g · total **4.125,00 €**
**Entregado:** 100 g Oro 14k → conversión automática → **77,77 g equivalentes** en Oro 18k

> El cliente entrega un quilataje diferente al pactado. El sistema calcula automáticamente el equivalente (`gramos × pureza_entregada / pureza_pactada`) y lo somete a aprobación. El importe del cierre **no cambia**; solo los gramos equivalentes recibidos.

### Caso 4 — Chatarra detectada en validación (`CIE25-004` · CON INCIDENCIAS)
**Cliente:** Juan García Martínez (particular, categoría Estándar)
**Material:** 500 g Plata 925 · precio 0,74 €/g · total **370,00 €**
**Resultado:** pureza real medida = **0,1500** (< umbral mínimo 0,2000) → material clasificado como **chatarra**

> La validación de laboratorio detecta que la pureza real está muy por debajo de la declarada. Se genera automáticamente una incidencia de tipo SCRAP. El cierre queda bloqueado hasta resolver la incidencia con el cliente.

### Caso 5 — Cancelación con adelanto pendiente de reembolso (`CIE25-005` · CANCELADO)
**Cliente:** María López Fernández (particular, categoría Estándar)
**Material:** 50 g Oro 18k · precio 41,25 €/g · total **2.062,50 €**
**Adelanto cobrado:** 1.546,88 € en efectivo (75 %)

> El cierre se cancela tras haberse abonado un adelanto. El sistema genera automáticamente una incidencia de tipo ADVANCE_REFUND para gestionar la devolución al cliente.

### Caso 6 — Cierre con múltiples líneas (`CIE25-006` · CONFIRMADO)
**Cliente:** Juan García Martínez (particular, categoría Estándar)
**Línea 1:** 30 g Oro 14k · 32,08 €/g · **962,40 €**
**Línea 2:** 45 g Oro 9k · 20,63 €/g · **928,35 €**
**Total: 1.890,75 €**

> Cierre recién confirmado con dos líneas de materiales distintos. Pendiente de primera recogida. Ilustra que los precios se congelan línea a línea en el momento de confirmación.

---

## Estructura del proyecto

```
tequierometales-erp/
├── .env.example                  # Plantilla de variables para docker-compose
├── docker-compose.yml            # Orquestación de servicios
│
├── backend/
│   ├── Dockerfile
│   ├── prisma/
│   │   ├── schema.prisma         # Esquema completo de la BD (11 entidades)
│   │   ├── seed.ts               # Seed: catálogo, usuarios, clientes, cierres demo
│   │   └── migrations/           # Historial de migraciones SQL
│   ├── src/
│   │   ├── main.ts               # Bootstrap: Swagger, CORS, ValidationPipe
│   │   ├── app.module.ts         # Módulo raíz
│   │   ├── common/
│   │   │   ├── decorators/       # @CurrentUser, @Roles, @ApiPaginatedResponse
│   │   │   ├── dto/              # PaginationDto, respuestas paginadas
│   │   │   ├── filters/          # HttpExceptionFilter global
│   │   │   ├── guards/           # JwtAuthGuard, RolesGuard
│   │   │   ├── interceptors/     # AuditInterceptor (operaciones de escritura)
│   │   │   └── pipes/            # ParseUuidPipe
│   │   ├── domain/               # Servicios de dominio (lógica pura, sin HTTP)
│   │   │   ├── conversion.service.ts        # Fórmula de equivalencia de quilatajes
│   │   │   ├── state-machine.service.ts     # Transiciones válidas entre estados
│   │   │   ├── pricing-calculator.service.ts # Cálculo y congelado de precios
│   │   │   ├── reconciliation.service.ts    # Conciliación recogida/validación
│   │   │   └── incident-generator.service.ts # Generación automática de incidencias
│   │   ├── modules/
│   │   │   ├── auth/             # Login, refresh token, JWT strategy
│   │   │   ├── users/            # CRUD usuarios y roles
│   │   │   ├── catalog/          # MetalTypes, KaratCatalog, ClientCategories
│   │   │   ├── clients/          # Clientes (empresa/particular)
│   │   │   ├── client-documents/ # Subida y descarga de documentos
│   │   │   ├── closures/         # Cierres (ciclo de vida completo)
│   │   │   ├── advances/         # Adelantos de pago
│   │   │   ├── collections/      # Recogidas de material
│   │   │   ├── validations/      # Sesiones de validación en laboratorio
│   │   │   ├── incidents/        # Incidencias (manuales y automáticas)
│   │   │   ├── pricing/          # Tarifas de precio + cron de actualización
│   │   │   ├── pdf/              # Generación de albaranes PDF
│   │   │   ├── audit/            # Consulta del log de auditoría
│   │   │   └── prisma/           # PrismaService (singleton)
│   │   └── storage/              # Abstracción local/S3 para archivos
│   └── test/
│       ├── unit/                 # Tests unitarios de servicios de dominio (140 tests)
│       └── e2e/                  # Tests end-to-end (auth + closures lifecycle)
│
└── frontend/
    ├── Dockerfile
    ├── next.config.ts            # output: standalone (optimizado para Docker)
    └── src/
        ├── app/
        │   ├── (auth)/
        │   │   └── login/        # Pantalla de inicio de sesión
        │   └── (dashboard)/
        │       ├── layout.tsx    # Sidebar + header con navegación
        │       ├── dashboard/    # KPIs + tabla de cierres recientes
        │       ├── cierres/      # Listado, detalle, nuevo cierre
        │       ├── clientes/     # Listado, detalle, nuevo cliente
        │       ├── recogidas/    # Listado de recogidas
        │       ├── tarifas/      # Gestión de precios
        │       ├── incidencias/  # Listado y detalle de incidencias
        │       ├── usuarios/     # Gestión de usuarios (solo admin)
        │       └── auditoria/    # Log de auditoría (solo admin)
        ├── components/
        │   ├── ui/               # Componentes shadcn/ui
        │   ├── layout/           # Sidebar, Header, Breadcrumbs
        │   ├── shared/           # StatusBadge, DataTable, Pagination, etc.
        │   ├── closures/         # Formularios y tablas de cierres
        │   └── clients/          # Formularios y tablas de clientes
        ├── hooks/                # TanStack Query hooks por dominio
        │   ├── use-auth.ts
        │   ├── use-closures.ts
        │   ├── use-clients.ts
        │   ├── use-collections.ts
        │   ├── use-incidents.ts
        │   ├── use-pricing.ts
        │   └── ...
        ├── lib/
        │   ├── api-client.ts     # Fetch centralizado con JWT y refresh automático
        │   ├── auth-provider.tsx # Contexto de autenticación
        │   ├── formatters.ts     # Formateo de moneda, gramos, fechas
        │   ├── permissions.ts    # Utilidades de control de acceso
        │   └── validators.ts     # Esquemas Zod para formularios
        └── types/
            └── api.ts            # Tipos TypeScript de todos los endpoints
```

---

## API y documentación Swagger

Con el servidor en marcha, la documentación interactiva está disponible en:

```
http://localhost:3001/api/docs
```

Incluye todos los endpoints organizados por módulo, esquemas de request/response y autenticación Bearer. Se puede probar directamente desde el navegador haciendo clic en **Authorize** e introduciendo el token obtenido en `POST /api/v1/auth/login`.

### Endpoints principales

| Módulo | Prefijo | Descripción |
|---|---|---|
| Autenticación | `/api/v1/auth` | Login, refresh, logout, perfil |
| Usuarios | `/api/v1/users` | CRUD de usuarios y roles |
| Catálogo | `/api/v1/catalog` | Metales, quilatajes, categorías de cliente |
| Clientes | `/api/v1/clients` | Clientes y documentos adjuntos |
| Cierres | `/api/v1/closures` | Ciclo de vida completo |
| Adelantos | `/api/v1/advances` | Registro de adelantos |
| Recogidas | `/api/v1/collections` | Recogidas y conversiones |
| Validaciones | `/api/v1/validations` | Sesiones de validación |
| Incidencias | `/api/v1/incidents` | Gestión de incidencias |
| Tarifas | `/api/v1/pricing` | Tarifas por metal/quilataje/categoría |
| PDF | `/api/v1/pdf` | Generación de albaranes |
| Auditoría | `/api/v1/audit` | Log de operaciones |

---

## Tests

### Tests unitarios (servicios de dominio)

```bash
cd backend
npm test                    # Ejecutar todos los tests unitarios
npm run test:cov            # Con informe de cobertura
npm run test:watch          # Modo watch (desarrollo)
```

**Suite actual: 140 tests · 0 fallos**

| Archivo | Descripción | Tests |
|---|---|---|
| `conversion.service.spec.ts` | Fórmula de equivalencia, edge cases | 17 |
| `state-machine.service.spec.ts` | Transiciones válidas e inválidas | 36 |
| `pricing-calculator.service.spec.ts` | Cálculo de importes y congelado | 18 |
| `reconciliation.service.spec.ts` | Conciliación recogida/validación | 22 |
| `incident-generator.service.spec.ts` | Generación automática de incidencias | 27 |

### Tests end-to-end

Requieren base de datos accesible (`DATABASE_URL` en `backend/.env`):

```bash
cd backend
npm run test:e2e            # auth.e2e-spec.ts + closures.e2e-spec.ts
```

Los tests e2e crean y limpian sus propios datos de prueba aislados del seed.

---

## Comandos útiles

### Docker

```bash
# Ver logs en tiempo real
docker compose logs -f backend
docker compose logs -f frontend

# Reiniciar un servicio
docker compose restart backend

# Reconstruir imagen tras cambios de código
docker compose up -d --build backend

# Acceder al shell del contenedor
docker compose exec backend sh
docker compose exec postgres psql -U postgres -d tequierometales

# Aplicar nuevas migraciones manualmente
docker compose exec backend npx prisma migrate deploy

# Volver a ejecutar el seed
docker compose exec backend npx prisma db seed

# Ver estado de los contenedores
docker compose ps
```

### Desarrollo local

```bash
# Backend
npm run start:dev          # Servidor con hot-reload
npm run build              # Compilar TypeScript
npm run lint               # Linting con ESLint

# Prisma
npx prisma studio          # Interfaz visual de la BD (http://localhost:5555)
npx prisma migrate dev     # Crear migración desde cambios en el schema
npx prisma migrate reset   # Resetear BD y re-aplicar seed (solo desarrollo)
npx prisma generate        # Re-generar cliente tras cambios en schema.prisma

# Frontend
npm run dev                # Servidor de desarrollo con HMR
npm run build              # Build de producción
npm run lint               # Linting con ESLint
```

### Generación de claves seguras

```bash
# JWT_SECRET y JWT_REFRESH_SECRET
openssl rand -base64 48

# Contraseña de PostgreSQL
openssl rand -hex 16
```

---

## Backlog de mejoras futuras

### Funcionalidad core
- [ ] **Notificaciones en tiempo real** — WebSockets para alertas de incidencias y cambios de estado sin refrescar la página
- [ ] **Albarán digital con firma** — captura de firma del cliente en pantalla táctil al registrar la recogida
- [ ] **Gestión de múltiples almacenes** — soporte para varias ubicaciones de laboratorio con trazabilidad del material
- [ ] **Portal de cliente** — acceso de solo lectura para que el cliente consulte el estado de sus operaciones

### Integraciones externas
- [ ] **Precio spot del metal** — integración con APIs de mercado (LBMA, Kitco) para sugerir tarifas base automáticamente
- [ ] **Notificaciones por WhatsApp** — mensaje automático al cliente al confirmar el cierre, registrar la recogida o completar la operación (Twilio / WhatsApp Business API)
- [ ] **Facturación electrónica** — generación de facturas en formato TicketBAI / VeriFactu según normativa fiscal española
- [ ] **Correo electrónico** — envío automático de albaranes PDF y resúmenes de operación (SMTP / SendGrid)

### Infraestructura y seguridad
- [ ] **Almacenamiento S3** — migración de documentos a AWS S3 / Cloudflare R2 para escalabilidad y backup
- [ ] **Autenticación de dos factores (2FA)** — TOTP (Google Authenticator) para usuarios con permisos críticos
- [ ] **Rate limiting** — protección contra fuerza bruta en endpoints de autenticación
- [ ] **Caché con Redis** — caché de tarifas y sesiones de usuario para reducir carga en BD

### Analítica y reporting
- [ ] **Dashboard avanzado** — gráficos de evolución de precios, volumen por cliente, rentabilidad por quilataje
- [ ] **Exportación a Excel** — descarga de listados de cierres, recogidas e incidencias en formato XLSX
- [ ] **Informes periódicos automáticos** — resumen semanal/mensual por email con métricas clave
- [ ] **Trazabilidad de lotes** — código de lote por grupo de material para seguimiento post-validación

### Experiencia de usuario
- [ ] **Aplicación móvil** — app React Native para comerciales de campo (recogidas con GPS y foto del material)
- [x] **Escáner de documentos** — botón "Usar cámara" en `FileUpload` con `capture="environment"` para escanear DNI/documentos desde la cámara trasera en móvil; previsualización inline de la imagen capturada
- [x] **Modo offline / PWA** — service worker (`public/sw.js`) con cache-first para activos estáticos y fallback a `/offline`; `manifest.ts` con colores de marca para instalación como app nativa; banner flotante de estado de conexión; botón "Instalar aplicación" en el menú de usuario cuando el navegador lo permite
- [x] **Tema oscuro** — dark mode completo con `next-themes`, toggle sol/luna en el header, paleta de marca en ambos modos

### Calidad y operaciones
- [ ] **CI/CD pipeline** — GitHub Actions para tests automáticos, linting y despliegue en cada push a main
- [ ] **Monitorización** — integración con Sentry (errores) y Grafana/Prometheus (métricas)
- [ ] **Backups automáticos** — cron de backup de PostgreSQL con retención configurable
- [ ] **Multi-empresa (multi-tenant)** — soporte para gestionar varias empresas del mismo grupo desde una única instancia

---

## Licencia

Software propietario — todos los derechos reservados.
© 2025 Te Quiero Metales
