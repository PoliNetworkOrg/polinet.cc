# Use the official Node.js 24 Alpine image for smaller size
FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm
WORKDIR /app

COPY package.json ./

# Fetch the correct pnpm version without installing deps
# This reads the "packageManager" field and downloads that pnpm version
RUN corepack prepare --activate $(node -p "require('./package.json').packageManager")
RUN pnpm --version

# Install dependencies only when needed
FROM base AS deps

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=./pnpm/store pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
RUN pwd
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=1

RUN --mount=type=cache,id=next,target=./.next/cache pnpm build

# Production image, copy all the files and run next
FROM base AS runner

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED=1

# Copy the public folder from the project as it's not included in the build output
COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 6111

ENV PORT=6111
ENV HOSTNAME="0.0.0.0"

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"]
