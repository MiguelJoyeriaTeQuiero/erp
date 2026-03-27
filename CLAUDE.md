# Instrucciones del Proyecto — Sistema de Gestión de Metales Preciosos

## Contexto
Sistema de gestión web para empresa mayorista de compra de oro y plata en Canarias.
Lee `SPEC.md` para el diseño completo (dominio, estados, API, estructura).

## Stack obligatorio

### Backend
- NestJS con TypeScript
- PostgreSQL + Prisma ORM
- JWT + refresh token (passport-jwt)
- Swagger/OpenAPI
- class-validator + class-transformer para DTOs
- pdfkit para generación de PDFs
- @nestjs/schedule para cron jobs
- bcrypt para passwords

### Frontend
- Next.js 14+ con App Router
- TypeScript strict
- Tailwind CSS
- shadcn/ui (instalar con npx shadcn-ui@latest init)
- React Hook Form + @hookform/resolvers
- Zod para validación
- @tanstack/react-query para data fetching
- @tanstack/react-table para tablas
- date-fns con locale es para fechas
- nuqs para query params en URL

### Infraestructura
- Docker + docker-compose (PostgreSQL, backend, frontend)
- Variables de entorno via .env (nunca hardcoded)

## Convenciones de código

### General
- Código fuente en inglés (nombres de variables, funciones, clases, archivos)
- Interfaz de usuario completamente en ESPAÑOL
- Comentarios en español donde aporten valor
- Usar Decimal de Prisma para dinero y gramos, NUNCA float
- Todos los importes en euros, 2 decimales
- Todos los gramos, 2 decimales
- Purezas con 4 decimales

### Backend (NestJS)
- Un módulo por dominio de negocio
- Controladores solo validan entrada y delegan al servicio
- Lógica de negocio compleja en `src/domain/` (servicios puros, sin dependencia HTTP)
- DTOs con class-validator, siempre con decoradores de validación
- Usar @ApiTags, @ApiOperation, @ApiResponse en todos los controladores
- Guards: JwtAuthGuard global, RolesGuard por endpoint
- Interceptores: AuditInterceptor global para operaciones de escritura
- Transacciones Prisma con $transaction para operaciones multi-tabla
- Soft delete con campo deletedAt donde aplique
- Campos createdAt y updatedAt en todas las tablas
- Campos createdBy / updatedBy donde sea relevante
- Paginación: page + limit en query params, respuesta con meta { total, page, limit, totalPages }
- Errores HTTP estándar con mensajes descriptivos en español

### Frontend (Next.js)
- App Router con route groups: (auth) y (dashboard)
- Cada hook en /hooks encapsula queries+mutations de TanStack Query
- Componentes nunca llaman a la API directamente, siempre via hooks
- Formularios con React Hook Form + Zod resolver
- Componentes compartidos en /components/shared
- Componentes de dominio en /components/{dominio}
- api-client.ts centraliza fetch con JWT automático y refresh
- Formateo de moneda: new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
- Formateo de gramos: new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
- Todos los textos de UI en español
- Responsive obligatorio: mobile-first con breakpoints sm/md/lg

### Estructura de carpetas
```
backend/
├── prisma/           # Schema, seeds, migrations
├── src/
│   ├── common/       # Decorators, guards, interceptors, pipes, filters, dto, types, utils
│   ├── modules/      # auth, users, clients, client-documents, closures, advances,
│   │                 # collections, validations, incidents, pricing, catalog, audit, pdf
│   ├── domain/       # conversion.service, reconciliation.service, state-machine.service,
│   │                 # incident-generator.service, pricing-calculator.service
│   └── storage/      # Abstracción local/S3
├── test/
frontend/
├── src/
│   ├── app/          # Rutas Next.js
│   ├── components/   # ui (shadcn), layout, shared, closures, collections, validations, incidents, pricing
│   ├── hooks/        # use-auth, use-clients, use-closures, use-collections, etc.
│   ├── lib/          # api-client, auth-provider, query-provider, validators, formatters, constants, permissions
│   └── types/        # Tipos TypeScript
```

## Reglas de negocio críticas (resumen)
- Un cierre confirmado NO puede editarse. Solo acciones derivadas (recogidas, validaciones, incidencias)
- El precio se congela POR LÍNEA al confirmar el cierre
- Conversión: gramos_equivalentes = gramos_entregados × (pureza_entregada / pureza_pactada)
- El importe del cierre NUNCA cambia por conversión
- Adelanto máximo: 75% del total del cierre
- Máximo 1 adelanto por cierre
- La operación solo se completa tras validación positiva de TODO el material
- Correcciones en validación requieren observación obligatoria
- Código cierre: CIE{2 últimos dígitos año}-{secuencial anual}
- Incidencias se generan automáticamente cuando: falta material, chatarra detectada, discrepancia gramos, material no convertible

## Orden de implementación sugerido
1. Prisma schema + migraciones + seed base (catálogo, roles, usuarios demo)
2. Módulo auth (JWT + refresh + guards)
3. Módulo catalog (metales, quilatajes, categorías)
4. Módulo clients + client-documents
5. Servicios de dominio (conversion, state-machine, pricing-calculator, reconciliation, incident-generator)
6. Módulo closures + closure-lines + advances
7. Módulo pricing (tarifas + cron)
8. Módulo collections + collection-lines
9. Módulo validations
10. Módulo incidents
11. Módulo audit
12. Módulo pdf (generación albarán)
13. Frontend: layout, auth, dashboard
14. Frontend: clientes
15. Frontend: cierres (el más complejo)
16. Frontend: recogidas
17. Frontend: validación
18. Frontend: incidencias
19. Frontend: tarifas, usuarios, auditoría
20. Docker, tests, README

## NO hacer
- No usar float para dinero o gramos
- No poner lógica de negocio en controladores
- No hacer queries directas a Prisma desde controladores
- No hardcodear textos en inglés en la UI
- No crear endpoints sin documentación Swagger
- No omitir validación backend (no confiar solo en frontend)
- No omitir auditoría en acciones de escritura
- No permitir editar un cierre confirmado
- No permitir completar un cierre sin validación
