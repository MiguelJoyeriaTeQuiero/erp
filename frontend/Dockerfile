# ──────────────────────────────────────────────────────────────────────────────
# Etapa 1: Dependencias
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app
COPY package*.json ./
RUN npm ci

# ──────────────────────────────────────────────────────────────────────────────
# Etapa 2: Compilación
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Las variables NEXT_PUBLIC_* se incrustan en el bundle en tiempo de compilación.
# Se pasan como build args desde docker-compose (o --build-arg en CLI).
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# ──────────────────────────────────────────────────────────────────────────────
# Etapa 3: Imagen de producción (modo standalone)
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Usuarios del sistema para Next.js (convención del equipo de Vercel)
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# El modo `output: 'standalone'` genera un servidor Node.js autocontenido
# en .next/standalone/ con todas sus dependencias ya incluidas
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# server.js es el punto de entrada generado por el modo standalone
CMD ["node", "server.js"]
