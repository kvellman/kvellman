# kvellman origin (Community) production image.
# Multi-stage: build the Nuxt app, then run the self-contained Nitro output. The runner keeps the
# installed node_modules so drizzle-kit can apply migrations at container start.

FROM node:22-slim AS builder
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

# Install with the full source present (pnpm workspace: packages/*). Correctness over layer caching.
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm i18n:compile && pnpm build

FROM node:22-slim AS runner
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app

# Self-contained server bundle.
COPY --from=builder /app/.output ./.output
# Migration tooling + files (drizzle-kit + drizzle-orm/postgres live in node_modules).
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/server/db/schema.ts ./server/db/schema.ts
COPY --from=builder /app/package.json ./package.json
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
