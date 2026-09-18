# Deploying הר של קלפים on AWS

The game (`artifacts/har-shel-klafim`) is a **client-only Vite + React SPA**. It has
no backend requirement: no database, no API calls, no server-side state. Game
progress lives in the browser. That means the cheapest and most reliable hosting
is plain static file hosting; the Docker image is only there if you prefer to run
a container.

The repository is a pnpm monorepo. Other packages (`artifacts/api-server`,
`artifacts/mockup-sandbox`) exist for development inside Replit and are **not**
needed to run the game.

## Build

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @workspace/har-shel-klafim run build
```

Output: `artifacts/har-shel-klafim/dist/public` — `index.html`, hashed assets under
`assets/`, plus the PWA files (`sw.js`, `manifest.webmanifest`, icons).

Requires Node.js 24 and pnpm 10.26.1 (via corepack).

### Sub-path hosting

By default the app is built for the domain root (`/`). To host it under a path,
set `BASE_PATH` at build time:

```bash
BASE_PATH=/solitaire/ pnpm --filter @workspace/har-shel-klafim run build
```

`BASE_PATH` must be an absolute same-origin path — no scheme, host, query or
fragment; the build rejects anything else. It is baked into the bundle and into
the service-worker scope at build time and cannot be changed afterwards. **When
you build with a prefix, the files must also be served from that prefix** (an S3
key prefix, or the Docker build arg below, which handles it for you).

---

## Cache policy (applies to every option)

This matters more than usual because the app registers a service worker. Get it
wrong and an installed PWA keeps booting an old build forever.

| Files | `Cache-Control` |
| --- | --- |
| `assets/*` (content-hashed) | `public, max-age=31536000, immutable` |
| `index.html`, `sw.js`, `manifest.webmanifest`, icons | `no-cache` |

Note that a CloudFront cache policy with a non-zero **minimum TTL overrides the
origin's `no-cache` header**. The stable-name files need a behavior whose minimum
TTL is 0.

---

## Option A — S3 + CloudFront (recommended)

1. Build, then upload in two passes so each group gets its own cache header.
   The `--delete` belongs to the second pass, which covers the whole prefix:

   ```bash
   DIST=artifacts/har-shel-klafim/dist/public
   BUCKET=s3://YOUR_BUCKET          # add /solitaire for a sub-path build

   # 1. hashed assets — immutable
   aws s3 sync "$DIST/assets" "$BUCKET/assets" \
     --cache-control "public, max-age=31536000, immutable"

   # 2. everything else — revalidate every time
   aws s3 sync "$DIST" "$BUCKET" --delete \
     --exclude "assets/*" \
     --cache-control "no-cache"
   ```

   `aws s3 sync` infers `Content-Type` from the extension, except for
   `.webmanifest`, which it uploads as `binary/octet-stream`. Fix it explicitly:

   ```bash
   aws s3 cp "$DIST/manifest.webmanifest" "$BUCKET/manifest.webmanifest" \
     --content-type "application/manifest+json" --cache-control "no-cache"
   ```

2. Keep the bucket private and put CloudFront in front of it with an **Origin
   Access Control (OAC)**. Set the *Default root object* to `index.html`.

3. **Cache behaviors** — two are needed:

   - Path pattern `assets/*` (or `solitaire/assets/*`): managed policy
     `CachingOptimized`.
   - Default (`*`): a policy with **Min TTL 0**, Default TTL 0, Max TTL 31536000,
     so the origin's `no-cache` on `index.html` / `sw.js` / the manifest is
     respected. The managed `CachingDisabled` policy also works.

4. **SPA fallback** — add custom error responses so deep links resolve:

   | HTTP error code | Response page path | HTTP response code | Error caching min TTL |
   | --------------- | ------------------ | ------------------ | --------------------- |
   | 403             | `/index.html`      | 200                | 0                     |
   | 404             | `/index.html`      | 200                | 0                     |

   Setting the error caching TTL to 0 matters: otherwise CloudFront caches the
   fallback response per URL for 10 minutes by default, and a path that later
   becomes a real object keeps serving the SPA shell.

   For a sub-path deployment, point the response page path at
   `/solitaire/index.html`.

5. Invalidate the stable-name files on every deploy:

   ```bash
   aws cloudfront create-invalidation --distribution-id ID \
     --paths "/index.html" "/sw.js" "/manifest.webmanifest"
   ```

   Hashed assets never need invalidating — their names change.

## Option B — Docker (App Runner, ECS/Fargate, or EC2)

The root `Dockerfile` builds the app and serves it with nginx on **port 8080**,
with the SPA fallback and the cache rules above already applied
(`deploy/nginx.conf.template`).

```bash
docker build -t har-shel-klafim .
docker run --rm -p 8080:8080 har-shel-klafim
# http://localhost:8080
```

Sub-path build — the argument drives the bundle, the file placement inside the
image and the nginx config together, and `/` then redirects to the prefix:

```bash
docker build --build-arg BASE_PATH=/solitaire/ -t har-shel-klafim .
# http://localhost:8080/solitaire/
```

Push to ECR and deploy:

```bash
aws ecr get-login-password --region REGION \
  | docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.REGION.amazonaws.com
docker tag har-shel-klafim ACCOUNT.dkr.ecr.REGION.amazonaws.com/har-shel-klafim:latest
docker push ACCOUNT.dkr.ecr.REGION.amazonaws.com/har-shel-klafim:latest
```

- **App Runner**: point a service at the ECR image, port `8080`, health check
  path `/`. Simplest container option — no load balancer to manage.
- **ECS/Fargate**: container port `8080` behind an ALB target group, health check
  path `/`. For a sub-path image `/` returns 302, so either set the health check
  path to the prefix (`/solitaire/`) or accept 302 as a success code.

## Option C — AWS Amplify Hosting

Connect the GitHub repo and use:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - corepack enable
        - pnpm install --frozen-lockfile
    build:
      commands:
        - pnpm --filter @workspace/har-shel-klafim run build
  artifacts:
    baseDirectory: artifacts/har-shel-klafim/dist/public
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

Add a rewrite rule so deep links resolve: source
`</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webmanifest)$)([^.]+$)/>`,
target `/index.html`, type `200 (Rewrite)`.

---

## Notes and gotchas

- **HTTPS is required** for the service worker and for "Add to home screen" to
  work. CloudFront, App Runner, and Amplify all terminate TLS for you; a bare
  EC2 instance on plain HTTP silently loses the PWA behaviour.
- **Do not switch the Docker build stage to Alpine.** `pnpm-workspace.yaml`
  prunes the musl native binaries for rollup, esbuild and tailwind's oxide, so a
  musl-based image fails the build with a missing-native-module error. The build
  stage uses `node:24-slim` (glibc) for that reason.
- **Hebrew/RTL** is handled entirely in the bundle; no server configuration is
  needed beyond serving UTF-8 (the nginx config sets it).
- **Replit-specific files** (`.replit`, `.replit-artifact/`, `.local/`) are
  harmless in the repo and ignored by every option above.
- The Vite config reads `PORT` and `BASE_PATH` when present and falls back to
  `5173` and `/` when they are not, so the same config works inside Replit and in
  a plain CI or Docker build. Inside Replit both remain mandatory.
