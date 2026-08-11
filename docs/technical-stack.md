# Technical Stack — Orbit (Prestway)

**Orbit** é a plataforma mobile-first da Prestway para conectar clientes e prestadores de serviços de manutenção e reforma. Uma única codebase React entrega **web/PWA** e **apps nativos** (Android ativo; iOS planejado).

---

## Visão geral

| Camada | Tecnologias principais |
|--------|------------------------|
| **Runtime** | Node.js **24.13** (`.nvmrc`), **Yarn** |
| **Frontend** | React **19**, Vite **7**, TypeScript **5.9** |
| **Roteamento** | React Router **7** |
| **Estado remoto** | TanStack Query **5** (+ persistência em cliente) |
| **Estilo** | Tailwind CSS **3**, Radix UI, shadcn-style (`src/components/ui/`) |
| **Nativo** | Capacitor **8** |
| **Backend** | Supabase (Postgres, Auth, Storage, RLS, Edge Functions em Deno) |
| **Observabilidade** | Sentry |
| **Push (web)** | Firebase Cloud Messaging |

---

## Plataformas de entrega

- **Web / PWA** — SPA Vite; PWA opcional (`VITE_ENABLE_PWA=true`) com Service Worker customizado (`src/sw.ts`, estratégia `injectManifest` + Workbox).
- **Android** — Shell nativo em `android/`, `appId` `br.com.renovi.orbit`, artefato web em `dist/` sincronizado via `yarn cap:sync`.
- **iOS** — Mesma base de código; projeto Capacitor iOS ainda não no repositório.

Abordagem **offline-first**: cache (SW, React Query `staleTime`), `@capacitor/preferences` e filas de mutação ao reconectar.

---

## Frontend

### Core
- **React 19** + **React DOM**, bundler **Vite 7** com `@vitejs/plugin-react`.
- **TypeScript** em modo estrito; alias `@/*` → `src/*`.
- **React Router 7** para rotas e guards (ex.: auth via Public API de `src/features/auth`).

### UI e UX
- **Tailwind CSS 3** + `tailwindcss-animate`, `@tailwindcss/typography`.
- **Radix UI** (primitivos acessíveis) + **class-variance-authority**, **clsx**, **tailwind-merge**.
- **Lucide React** (ícones), **Framer Motion** (animações), **Sonner** (toasts).
- **shadcn/ui**-style: componentes em `src/components/ui/` (Dialog, Sheet, Drawer via **vaul**, etc.).
- **@fontsource-variable/inter** (fontes self-hosted).
- Mobile-first: safe areas, teclado nativo, dialogs full-screen no mobile (`useMobileDialogViewport`).

### Formulários e validação
- **React Hook Form** + **@hookform/resolvers**.
- **Zod 4** para schemas e tipos de domínio.

### Dados no cliente
- **TanStack React Query** para cache, refetch e estados de loading/erro.
- **@tanstack/react-query-persist-client** + **idb-keyval** para persistência offline.
- Camada **API por feature** (`src/features/<nome>/api/`) — componentes e hooks não chamam Supabase diretamente.

### Mapas e geolocalização
- **Leaflet** + **react-leaflet** para mapas.
- **h3-js** para indexação geoespacial (áreas de atuação, vizinhanças).

### ML no browser
- **TensorFlow.js** + **nsfwjs** (MobileNetV2) para moderação de fotos no fluxo de orçamento, com carregamento dinâmico para não inflar o bundle principal.

### Drag and drop
- **@dnd-kit** (core, sortable, utilities) para reordenação de UI.

---

## Arquitetura de código

Organização **feature-based** em `src/features/<nome>/`:

```
api/  components/  hooks/  types/  utils/  index.ts  ← Public API
```

- Consumo externo só via `index.ts` de cada feature.
- Compartilhado entre features: `src/lib/`, `src/hooks/`, `src/components/ui/`.
- Infra transversal: `src/lib/supabase/`, `src/lib/capacitor/`, `src/lib/sentry.ts`, `src/lib/firebase/`, `src/lib/push.ts`.

Bootstrap: `main.tsx` → `initCapacitorPlugins()` → `hydratePersistSessionPreference()` → React.

---

## Mobile nativo (Capacitor 8)

Plugins em uso:
- `@capacitor/app`, `device`, `haptics`, `keyboard`, `preferences`, `splash-screen`
- `@capacitor/push-notifications` (devDependency; integração com FCM)
- Projeto Android: `@capacitor/android`

Persistência de preferências de produto via **Capacitor Preferences** (`src/lib/capacitor/preferencesStorage.ts`), não `localStorage` direto.

---

## Backend (Supabase)

### Banco e API
- **PostgreSQL** com migrações versionadas em `supabase/migrations/`.
- **Row Level Security (RLS)** em tabelas sensíveis; políticas por `auth.uid()`.
- **Supabase Auth** (signup, sessão JWT).
- **Storage** (buckets para fotos de pedidos, portfólio, imagens de perfil).
- Tipos gerados: `yarn generate-supabase-types` → `src/lib/supabase/database.types.ts`.
- Cliente: `@supabase/supabase-js` em `src/lib/supabase/client.ts`.

### Edge Functions (Deno)
Funções em `supabase/functions/`, entre outras:
- `create-request-quote-order` — criação de pedido de orçamento
- `generate-smart-description` — descrição com IA (OpenAI)
- `match-provider-jobs` — matching de jobs para prestadores
- `verify-recaptcha` — validação reCAPTCHA

Shared: CORS, rate limiter, tipos do banco, integrações (_shared/).

### Operações de banco
- `yarn db:migrate` — `supabase db push`
- `yarn db:reset` — reset local + migrações

Restrições de infraestrutura (RPC vs Edge Functions, timeouts, filas): [Infrastructure Constraints](./infrastructure-constraints.md).

---

## Integrações e serviços externos

| Serviço | Uso |
|---------|-----|
| **OpenAI** | Edge Function de descrição inteligente (`OPENAI_API_KEY`) |
| **Firebase** | Push notifications (FCM) na web/PWA (`src/lib/firebase/`, `src/sw.ts`) |
| **Sentry** | Erros e performance no frontend (`@sentry/react`, plugin Vite com source maps) |
| **reCAPTCHA** | Verificação em fluxos sensíveis (Edge Function) |

---

## Qualidade e testes

| Tipo | Ferramenta |
|------|------------|
| **Unitários** | **Vitest 4** + **happy-dom** / jsdom, **Testing Library** |
| **E2E** | **Playwright** (incl. projeto `mobile-safari`) |
| **Lint** | **ESLint 9** + typescript-eslint, react-hooks, react-refresh |
| **Format** | **Prettier** |

Cobertura: `@vitest/coverage-v8`.

---

## Build, deploy e DX

- **Build:** `tsc -b && vite build` → `dist/`
- **PWA:** `vite-plugin-pwa` + `@vite-pwa/assets-generator`
- **Dev:** `portless` para URL estável local (`yarn dev`)
- **Source maps** no build; upload condicional ao Sentry
- **CI/local:** scripts para seed de imagens de load test, prerelease
