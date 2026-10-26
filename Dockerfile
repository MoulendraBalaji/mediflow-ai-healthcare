# ============================================================
# Stage 1: Build API
# ============================================================
FROM node:20-alpine AS api-build

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY api/package.json api/

RUN npm ci --workspace=api

COPY prisma ./prisma
COPY api ./api

RUN cd api && npx prisma generate --schema ../prisma/schema.prisma
RUN cd api && npx tsc

# ============================================================
# Stage 2: Build App
# ============================================================
FROM node:20-alpine AS app-build

WORKDIR /workspace

# NEXT_PUBLIC_* values are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY package.json package-lock.json ./
COPY app/package.json app/

RUN npm ci --workspace=app

COPY app ./app

WORKDIR /workspace/app
RUN npx next build

# ============================================================
# Stage 3: Production API
# ============================================================
FROM node:20-slim AS api-production

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=api-build /workspace/node_modules ./node_modules
COPY --from=api-build /workspace/api/dist ./dist
COPY --from=api-build /workspace/api/package.json ./
COPY --from=api-build /workspace/prisma ./prisma

RUN chown -R node:node /app

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

USER node

# Apply committed migrations, then start. If the database is unreachable the
# API still boots in degraded mode and /health reports db: "down".
CMD ["sh", "-c", "npx prisma migrate deploy --schema prisma/schema.prisma && node dist/index.js"]

# ============================================================
# Stage 4: Production App
# ============================================================
FROM node:20-slim AS app-production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=app-build /workspace/app/public ./public
COPY --from=app-build /workspace/app/.next/standalone ./
COPY --from=app-build /workspace/app/.next/static ./.next/static

RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["node", "server.js"]
