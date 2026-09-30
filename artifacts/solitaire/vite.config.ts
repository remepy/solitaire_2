import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

// Inside Replit the workflow always injects PORT and BASE_PATH. Outside it
// (a plain `pnpm build` in CI, a Docker image, an AWS box) neither exists, so
// fall back to standalone defaults instead of refusing to start.
const isReplit = process.env.REPL_ID !== undefined;

const rawPort = process.env.PORT;

if (isReplit && !rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = rawPort ? Number(rawPort) : 5173;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

if (isReplit && !process.env.BASE_PATH) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

const basePath = process.env.BASE_PATH ?? '/';

// The base is baked into asset URLs and into the service worker scope, which
// browsers only honour for a same-origin path. Anything that is not a plain
// absolute pathname would build happily and then fail in the browser.
if (
  !basePath.startsWith('/') ||
  basePath.startsWith('//') ||
  /[?#]/.test(basePath)
) {
  throw new Error(
    `Invalid BASE_PATH value: "${basePath}". It must be an absolute same-origin ` +
      'path such as "/" or "/solitaire/", with no scheme, host, query or fragment.',
  );
}

// index.html and main.tsx build asset URLs by concatenating BASE_URL with a
// file name (manifest, icons, service worker), so the base must end in exactly
// one slash. Without this, a base like "/game" yields "/gamemanifest.webmanifest".
const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;

export default defineConfig({
  base: normalizedBasePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
