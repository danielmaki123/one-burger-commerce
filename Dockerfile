FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ARG APP_BUILD_VERSION
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN BUILD_VERSION="${APP_BUILD_VERSION:-build-$(date -u +%Y%m%d-%H%M%S)}" \
  && APP_BUILD_VERSION="$BUILD_VERSION" npx prisma generate \
  && APP_BUILD_VERSION="$BUILD_VERSION" npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
# The container entrypoint is `npm run start:production`, which runs
# scripts/start-production.mjs (environment validation + migrations + next start).
# Without this copy the container exits immediately with MODULE_NOT_FOUND.
COPY --from=builder /app/scripts ./scripts
# Ops scripts (first-admin bootstrap, staging seeds) import domain code from
# src/, so the runtime image has to ship it too or those commands fail.
COPY --from=builder /app/src ./src

EXPOSE 3000

# Readiness performs a real database round trip and answers 503 when the
# database is unreachable, so an unhealthy container is not promoted.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/readiness').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start:production"]
