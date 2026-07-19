# ============================================================
# Stage 1: Build API
# ============================================================
FROM node:20-alpine AS api-build

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY api/package.json api/package-lock.json* api/

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

COPY package.json package-lock.json ./
COPY app/package.json app/package-lock.json* app/

RUN npm ci --workspace=app

COPY app ./app

WORKDIR /workspace/app
ENV NEXT_PUBLIC_API_URL=http://localhost:3001/api
RUN npx next build

# ============================================================
# Stage 3: Production API
# ============================================================
FROM node:20-slim AS api-production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=api-build /workspace/api/dist ./dist
COPY --from=api-build /workspace/api/package.json ./
COPY --from=api-build /workspace/node_modules ./node_modules
COPY --from=api-build /workspace/prisma ./prisma
COPY --from=api-build /workspace/node_modules/.prisma ./node_modules/.prisma

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/index.js"]

# ============================================================
# Stage 4: Production App
# ============================================================
FROM node:20-slim AS app-production

WORKDIR /app

COPY --from=app-build /workspace/app/package.json ./
COPY --from=app-build /workspace/app/next.config.* ./
COPY --from=app-build /workspace/app/public ./public
COPY --from=app-build /workspace/app/.next/standalone ./
COPY --from=app-build /workspace/app/.next/static ./.next/static

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
