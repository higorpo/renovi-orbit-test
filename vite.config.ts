/// <reference types="vitest/config" />
import path from 'node:path'
import os from 'node:os'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { stripUnusedNsfwModelAssets } from './vite-plugins/stripUnusedNsfwModelAssets'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf-8')) as { version?: string }
const appVersion = pkg.version ?? '0.0.0'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const pwaEnabled = env.VITE_ENABLE_PWA === 'true'

  return {
  build: {
    sourcemap: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  resolve: {
    alias: {
      '@/lib/contracts': path.resolve(__dirname, './supabase/functions/_shared/contracts'),
      '@': path.resolve(__dirname, './src'),
      // nsfwjs imports "buffer/"; resolve to buffer package for browser
      'buffer/': path.resolve(__dirname, 'node_modules/buffer/'),
    },
  },
  optimizeDeps: {
    include: ['nsfwjs', '@tensorflow/tfjs', 'buffer'],
  },
  server: {
    host: true,
    allowedHosts: ['renovi-2.loca.lt']
  },
  test: {
    globals: false,
    pool: 'threads',
    deps: { optimizer: { ssr: { enabled: true } } },
    coverage: {
      // Avoid coverage/.tmp under workspace paths with unicode (Vitest v8 merge ENOENT)
      tempDirectory: path.join(os.tmpdir(), 'orbit-vitest-coverage'),
      reportOnFailure: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/__tests__/**',
        '**/index.ts',
        '**/types.ts',
        '**/*.types.ts',
        '**/fixtures/**',
      ],
      reporter: ['text', 'text-summary'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'happy-dom',
          include: ['src/**/*.{test,spec}.tsx'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.{test,spec}.ts'],
        },
      },
    ],
  },
  plugins: [
    react(),
    // Drop InceptionV3 / MobileNetV2Mid assets; app only loads MobileNetV2 (see photoContentCheck.ts)
    stripUnusedNsfwModelAssets(),
    VitePWA({
    disable: !pwaEnabled,
    selfDestroying: !pwaEnabled,
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'sw.ts',
    registerType: 'autoUpdate',
    injectRegister: false,

    pwaAssets: {
      disabled: false,
      config: true,
    },

    manifest: {
      name: "Renovi - Plataforma de Serviços",
      short_name: "Renovi",
      description: "Conectamos você aos melhores profissionais de manutenção e reforma",
      theme_color: "#0F2F3A",
      background_color: "#ffffff",
      display: "standalone",
      orientation: "portrait",
      scope: "/",
      start_url: "/",
      categories: ["business", "lifestyle", "utilities"],
      icons: [
        {
          src: "/icon-192.svg",
          sizes: "192x192",
          type: "image/svg+xml",
        },
        {
          src: "/icon-512.svg",
          sizes: "512x512",
          type: "image/svg+xml",
        },
        {
          src: "/icon-maskable-192.svg",
          sizes: "192x192",
          type: "image/svg+xml",
          purpose: "maskable",
        },
        {
          src: "/icon-maskable-512.svg",
          sizes: "512x512",
          type: "image/svg+xml",
          purpose: "maskable",
        },
      ],
      shortcuts: [
        {
          name: "Pedir Orçamento",
          short_name: "Orçamento",
          url: "/pedir-orcamento",
          icons: [{ src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" }],
        },
        {
          name: "Meu Dashboard",
          short_name: "Dashboard",
          url: "/dashboard/client",
          icons: [{ src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" }],
        },
      ],
      screenshots: [
        {
          src: "/screenshot-narrow.svg",
          sizes: "390x844",
          type: "image/svg+xml",
          form_factor: "narrow",
          label: "Tela principal do app Renovi",
        },
        {
          src: "/screenshot-wide.svg",
          sizes: "1280x720",
          type: "image/svg+xml",
          form_factor: "wide",
          label: "Dashboard em desktop",
        },
        {
          src: "/screenshot-orcamento.svg",
          sizes: "390x844",
          type: "image/svg+xml",
          form_factor: "narrow",
          label: "Formulário de pedido de orçamento",
        },
      ],
    },

    injectManifest: {
      // Static build output; webp (public assets), woff/woff2 (self-hosted fonts via @fontsource)
      globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff2,woff}'],
      globIgnores: ['**/online-check.txt'],
      // nsfwjs / TensorFlow shards exceed Workbox default (2 MiB)
      maximumFileSizeToCacheInBytes: 7 * 1024 * 1024,
    },

    ...(pwaEnabled
      ? {
          devOptions: {
            enabled: true,
            navigateFallback: 'index.html',
            suppressWarnings: true,
            type: 'module' as const,
          },
        }
      : {}),
  }),
  sentryVitePlugin({
    org: process.env.SENTRY_ORG ?? '',
    project: process.env.SENTRY_PROJECT ?? '',
    authToken: process.env.SENTRY_AUTH_TOKEN,
    release: { name: `orbit@${appVersion}` },
    sourcemaps: {
      filesToDeleteAfterUpload: ['./dist/**/*.map'],
    },
    disable: !process.env.SENTRY_AUTH_TOKEN,
  }),
],
}
})