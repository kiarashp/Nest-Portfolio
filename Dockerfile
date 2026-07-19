FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build


FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

# Seed the local-disk uploads directory with node-user ownership before Coolify's
# persistent-storage volume gets mounted here — Docker copies this directory's
# existing content/permissions into a brand-new named volume on first mount.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

USER node
EXPOSE 3000
CMD ["pnpm", "run", "start:prod"]
