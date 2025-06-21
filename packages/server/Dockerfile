# syntax=docker/dockerfile:1.4

########################################
# 0) image 
########################################
FROM node:24-alpine AS base

########################################
# 1) dependencies 
########################################
FROM base AS deps
WORKDIR /app

# activate Corepack for pnpm
RUN corepack enable

# need manifests from monorepo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

COPY packages  packages
COPY plugins   plugins
COPY mcps/snak/package.json    mcps/snak/package.json

# this tells Docker’s BuildKit to carve out a persistent, named cache volume \ -no-frozen-lockfile tells pnpm not to error out if pnpm-lock.yaml is out of sync with package.json files. It will install anyway (and may update the lockfile). --shamefully-hoist forces pnpm to flatten all binaries and dependencies into the top-level node_modules/.bin and node_modules folders
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --no-frozen-lockfile --shamefully-hoist

########################################
# 2) builder 
########################################
FROM deps AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY . .

# compile (Turbo build, Next build, tsup…)
RUN pnpm run build

########################################
# 3) runner 
########################################
FROM base AS runner
WORKDIR /app

RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules

COPY pnpm-workspace.yaml lerna.json package.json ./

COPY --from=builder /app/packages/server/package.json  packages/server/package.json
COPY --from=builder /app/packages/server/dist          packages/server/dist

COPY --from=builder /app/packages/core/package.json    packages/core/package.json
COPY --from=builder /app/packages/core/dist            packages/core/dist

COPY --from=builder /app/packages/database/package.json    packages/database/package.json
COPY --from=builder /app/packages/database/dist            packages/database/dist

COPY --from=builder /app/packages/agent/package.json    packages/agent/package.json
COPY --from=builder /app/packages/agent/dist            packages/agent/dist

ENV NODE_ENV=production
EXPOSE 3002

CMD ["pnpm", "run", "start:prod"]
