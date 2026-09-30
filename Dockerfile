# Build and serve "הר של קלפים" (artifacts/solitaire) as a static site.
#
#   docker build -t solitaire .
#   docker run -p 8080:8080 solitaire
#
# The app is a client-only Vite SPA, so the runtime image is just nginx with a
# SPA fallback. Nothing in the container needs a database or an API server.
#
# To host under a sub-path, pass the same value to both stages:
#   docker build --build-arg BASE_PATH=/solitaire/ -t solitaire .

# ---- build stage -------------------------------------------------------------
# Debian, not Alpine: pnpm-workspace.yaml prunes the musl native binaries for
# rollup, esbuild and tailwind's oxide, so a musl image has nothing to build with.
FROM node:24-slim AS build

ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}

# Pin the pnpm version the repo is developed and lockfile-tested against.
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

# Copy the workspace manifests first so dependency installation stays cached
# across source-only changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY artifacts/solitaire/package.json artifacts/solitaire/
COPY scripts/package.json scripts/

RUN pnpm install --frozen-lockfile --filter @workspace/solitaire...

COPY tsconfig.base.json tsconfig.json ./
COPY artifacts/solitaire artifacts/solitaire

RUN pnpm --filter @workspace/solitaire run build

# ---- runtime stage -----------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

ARG BASE_PATH=/
ENV APP_BASE=${BASE_PATH}

COPY deploy/nginx.conf.template /tmp/nginx.conf.template
COPY --from=build /app/artifacts/solitaire/dist/public /tmp/site

# Place the build under the same prefix the bundle was compiled for, and render
# the nginx config for that prefix. Without this, a sub-path build would emit
# /solitaire/assets/... URLs while nginx served everything from the root.
RUN set -eu; \
    base="/$(printf '%s' "$APP_BASE" | sed 's#^/*##; s#/*$##')"; \
    case "$base" in /) base=/ ;; *) base="$base/" ;; esac; \
    mkdir -p "/usr/share/nginx/html${base}"; \
    cp -a /tmp/site/. "/usr/share/nginx/html${base}"; \
    if [ "$base" = "/" ]; then redirect=""; \
    else redirect="    location = / { return 302 ${base}; }"; fi; \
    sed -e "s#__BASE__#${base}#g" -e "s#__ROOT_REDIRECT__#${redirect}#" \
        /tmp/nginx.conf.template > /etc/nginx/conf.d/default.conf; \
    rm -rf /tmp/site /tmp/nginx.conf.template; \
    nginx -t

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null "http://127.0.0.1:8080${APP_BASE%/}/" || exit 1

CMD ["nginx", "-g", "daemon off;"]
