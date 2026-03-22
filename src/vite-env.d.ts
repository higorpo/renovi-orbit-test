/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** When `"true"`, VitePWA generates manifest + service worker. Omit or any other value disables PWA (and self-destroys prior SW). */
  readonly VITE_ENABLE_PWA?: string;
}
