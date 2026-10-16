FROM node:24-bookworm-slim AS runtime-base

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM runtime-base AS base

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

RUN corepack enable \
  && corepack prepare pnpm@10.6.2 --activate

FROM base AS dependencies

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build

COPY . .

# Prisma config reads DATABASE_URL during generation, even though generation
# itself does not connect to the database.
RUN DATABASE_URL='postgresql://webhook:local-dev-password@postgres:5432/webhook_service?schema=public' \
  pnpm db:generate \
  && pnpm build

FROM base AS production-dependencies

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM runtime-base AS production

ENV NODE_ENV=production

COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./package.json

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
