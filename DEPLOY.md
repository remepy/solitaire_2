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

### Sub-path hosting

By default the app is built for the domain root (`/`). To host it under a path,
set `BASE_PATH` at build time:

```bash
BASE_PATH=/solitaire/ pnpm --filter @workspace/har-shel-klafim run build
```

`BASE_PATH` must end with a slash or the build normalizes it for you. It is baked
into the bundle at build time and cannot be changed afterwards.

Requires Node.js 24 (see `.nvmrc` if present) and pnpm via corepack.

---

## Option A — S3 + CloudFront (recommended)

Static hosting, no servers, HTTPS and global caching from CloudFront.

1. Build, then sync the output:

   ```bash
   aws s3 sync artifacts/har-shel-klafim/dist/public s3://YOUR_BUCKET --delete
   ```

2. Keep the bucket private and put CloudFront in front of it with an **Origin
   Access Control (OAC)**. Set the CloudFront *Default root object* to
   `index.html`.

3. **SPA fallback** — add a CloudFront custom error response so deep links work:

   | HTTP error code | Response page path | HTTP response code |
   | --------------- | ------------------ | ------------------ |
   | 403             | `/index.html`      | 200                |
   | 404             | `/index.html`      | 200                |

4. **Caching** — two different policies matter here:

   - `assets/*` are content-hashed: `Cache-Control: public, max-age=31536000, immutable`
   - `index.html`, `sw.js`, `manifest.webmanifest`: `Cache-Control: no-cache`

   Getting this wrong is the usual cause of an installed PWA stubbornly booting
   an old build. Example for the no-cache group:

   ```bash
   aws s3 cp artifacts/har-shel-klafim/dist/public/index.html s3://YOUR_BUCKET/index.html \
     --cache-control "no-cache" --content-type "text/html"
   aws s3 cp artifacts/har-shel-klafim/dist/public/sw.js s3://YOUR_BUCKET/sw.js \
     --cache-control "no-cache" --content-type "application/javascript"
   ```

5. Invalidate on deploy: `aws cloudfront create-invalidation --distribution-id ID --paths "/index.html" "/sw.js" "/manifest.webmanifest"`

## Option B — Docker (App Runner, ECS/Fargate, or EC2)

The root `Dockerfile` builds the app and serves it with nginx on **port 8080**,
including the SPA fallback and the cache rules above (`deploy/nginx.conf`).

```bash
docker build -t har-shel-klafim .
docker run --rm -p 8080:8080 har-shel-klafim
# http://localhost:8080
```

Sub-path build:

```bash
docker build --build-arg BASE_PATH=/solitaire/ -t har-shel-klafim .
```

Push to ECR and deploy:

```bash
aws ecr get-login-password --region REGION \
  | docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.REGION.amazonaws.com
docker tag har-shel-klafim ACCOUNT.dkr.ecr.REGION.amazonaws.com/har-shel-klafim:latest
docker push ACCOUNT.dkr.ecr.REGION.amazonaws.com/har-shel-klafim:latest
```

- **App Runner**: point a service at the ECR image, port `8080`. Health check
  path `/`. Simplest container option — no load balancer to manage.
- **ECS/Fargate**: task container port `8080` behind an ALB target group with
  health check path `/`.

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
  EC2 instance on plain HTTP will silently lose the PWA behaviour.
- **Hebrew/RTL** is handled entirely in the bundle; no server configuration is
  needed, but make sure responses are served as UTF-8 (nginx config here does).
- **Do not switch the Docker build stage to Alpine.** `pnpm-workspace.yaml`
  prunes the musl native binaries for rollup, esbuild and tailwind's oxide, so a
  musl-based image fails the build with a missing-native-module error. The build
  stage uses `node:24-slim` (glibc) for that reason.
- **Replit-specific files** (`.replit`, `.replit-artifact/`, `.local/`) are
  harmless in the repo and ignored by every option above.
- The Vite config reads `PORT` and `BASE_PATH` when they are present and falls
  back to `5173` and `/` when they are not, so the same config works both inside
  Replit and in a plain CI/Docker build.
