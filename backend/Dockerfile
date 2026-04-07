# ──────────────────────────────────────────────────────────────────────────────
# Etapa 1: Compilación
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Herramientas de sistema necesarias para compilar módulos nativos (bcrypt)
RUN apk add --no-cache python3 make g++

# Instalar dependencias (package-lock garantiza reproducibilidad)
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Generar cliente Prisma con el adaptador de pg
RUN npx prisma generate

# Copiar código fuente y compilar TypeScript → dist/
COPY . .
RUN npm run build

# ──────────────────────────────────────────────────────────────────────────────
# Etapa 2: Imagen de producción
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Usuario sin privilegios de root para mayor seguridad
RUN addgroup -S nestjs && adduser -S nestjs -G nestjs

# Copiar node_modules completos desde builder
# (se incluye el CLI de Prisma, devDep necesario para migrate deploy en runtime)
COPY --from=builder --chown=nestjs:nestjs /app/node_modules    ./node_modules
COPY --from=builder --chown=nestjs:nestjs /app/dist            ./dist
COPY --from=builder --chown=nestjs:nestjs /app/prisma          ./prisma
COPY --from=builder --chown=nestjs:nestjs /app/prisma.config.ts ./prisma.config.ts
COPY --chown=nestjs:nestjs package*.json ./

# Directorio persistente para documentos subidos (montado como volumen en compose)
RUN mkdir -p /app/uploads && chown nestjs:nestjs /app/uploads

USER nestjs

EXPOSE 3001

# Al arrancar: aplicar migraciones pendientes y luego iniciar el servidor
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
