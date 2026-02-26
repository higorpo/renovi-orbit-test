import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: false,
  },
  plugins: [react(), VitePWA({
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
      globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
    },

    devOptions: {
      enabled: true,
      navigateFallback: 'index.html',
      suppressWarnings: true,
      type: 'module',
    },
  })],
})