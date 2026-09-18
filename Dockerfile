# Build and serve "הר של קלפים" (artifacts/har-shel-klafim) as a static site.
#
#   docker build -t har-shel-klafim .
#   docker run -p 8080:8080 har-shel-klafim
#
# The app is a client-only Vite SPA, so the runtime image is just nginx with a
# SPA fallback. Nothing in the container needs a database or an API server.

# ---- build stage -------------------------------------------------------------
# Debian, not Alpine: pnpm-workspace.yaml prunes the musl native binaries for
# rollup, esbuild and tailwind's oxide, so a musl image has nothing to build with.
FROM node:24-slim AS build

# Serve from the domain root by default. Override at build time to host the app
# under a sub-path, e.g. --build-arg BASE_PATH=/solitaire/
ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}

# Pin the pnpm version the repo is developed and lockfile-tested against.
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

# Copy the workspace manifests first so dependency installation stays cached
# across source-only changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/har-shel-klafim/package.json artifacts/har-shel-klafim/
COPY lib lib
COPY scripts/package.json scripts/

RUN pnpm install --frozen-lockfile --filter @workspace/har-shel-klafim...

COPY tsconfig.base.json tsconfig.json ./
COPY artifacts/har-shel-klafim artifacts/har-shel-klafim

RUN pnpm --filter @workspace/har-shel-klafim run build

# ---- runtime stage -----------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/artifacts/har-shel-klafim/dist/public /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
