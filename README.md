# Orbit (Renovi)

Plataforma mobile-first da Renovi: **uma codebase** React (Vite) que entrega **web/PWA** e **apps nativos** via [Capacitor](https://capacitorjs.com/).

## Plataformas

| Superfície | Status | Notas |
|------------|--------|--------|
| **Web / PWA** | Ativo | Browser + instalável; Service Worker em `src/sw.ts`; offline-first |
| **Android (nativo)** | Ativo | Projeto em `android/`; `appId` `br.com.renovi.orbit` |
| **iOS (nativo)** | Em breve | Mesmo código; projeto Capacitor iOS ainda não disponível no repositório |

Toda feature nova deve ser pensada **app-first e mobile-first** (touch, telas estreitas, safe areas, teclado nativo, persistência local), e depois adaptada para desktop. Detalhes: regra Cursor `platform-ux`.

## Stack

- **Frontend:** React 19, Vite 7, TypeScript, React Router 7, TanStack Query, Tailwind, UI em `src/components/ui/`
- **Nativo:** Capacitor 8 (`@capacitor/*`), shell Android em `android/`
- **Backend:** Supabase (Postgres, RLS, migrations, Edge Functions)

## Desenvolvimento

Requer **Node.js 24.13** (`.nvmrc`):

```bash
nvm use 24.13
yarn
yarn dev          # web (portless)
yarn build        # artefato em dist/ (web + Capacitor)
yarn test:run     # Vitest
yarn test:e2e     # Playwright
```

### App nativo (Capacitor)

Após alterar código ou plugins nativos:

```bash
yarn build
yarn cap:sync          # sincroniza dist → android/ (e ios/ quando existir)
yarn android           # build + sync + abre Android Studio
# yarn ios            # quando o projeto iOS estiver no repo
```

Infraestrutura compartilhada: `src/lib/capacitor/` (bootstrap, Preferences, splash). O boot da SPA chama `initCapacitorPlugins()` e hidrata preferências de sessão antes do React (`src/main.tsx`).

Para testar o WebView no dispositivo em desenvolvimento, use `yarn dev:host` e configure `server.url` em `capacitor.config.ts` (apenas dev).

## Configuração do projeto

Documentação completa de secrets: **[docs/internal-edge-functions-auth.md](docs/internal-edge-functions-auth.md)** (pg_net, Vault, Edge Functions internas).

### Variáveis de ambiente — resumo

#### Frontend (`.env` na raiz do repo)

| Variável | Onde | Obrigatório |
|----------|------|-------------|
| `VITE_SUPABASE_URL` | App | Sim |
| `VITE_SUPABASE_PUBLISHABLE_OR_ANON_KEY` | App | Sim |
| Outras `VITE_*` | App | Conforme feature |

Ver `.env.example` na raiz.

#### Postgres Vault — pg_cron invoca Edge Functions (`supabase start`)

Definidas em `supabase/config.toml` → `[db.vault]`, lidas do **`.env` na raiz** antes de `supabase start`:

| Variável (.env raiz) | Vault name | Obrigatório para |
|----------------------|------------|------------------|
| **`ORBIT_SUPABASE_URL`** | `orbit_supabase_url` | pg_net → qualquer EF interna |
| **`ORBIT_CRON_SECRET`** | `orbit_cron_secret` | Auth pg_net ↔ EF interna |

Exemplo local:

```bash
ORBIT_SUPABASE_URL=http://127.0.0.1:54321
# openssl rand -hex 32 — never reuse .env.example placeholders in staging/prod
ORBIT_CRON_SECRET=CHANGE_ME_GENERATE_RANDOM_32+
```

#### Edge Functions — secrets (`supabase/functions/.env` local / Dashboard em prod)

| Secret | Obrigatório | EFs |
|--------|-------------|-----|
| **`ORBIT_CRON_SECRET`** | Sim (internas) | `message-dispatcher-worker`, `schedule-netcred-charges`, `detect-netcred-onboarding`, `reconcile-netcred-payments`, `orbit-emit-sentry-alerts` |
| `OPENAI_API_KEY` | `generate-smart-description` | IA |
| `RESEND_*`, `FCM_*` | MMD worker | Notificações |
| `NETCRED_*` | Payment EFs | Pagamentos |
| `SENTRY_DSN` | Opcional | Observabilidade |

**Importante:** `ORBIT_CRON_SECRET` deve ser **o mesmo valor** no Vault (Postgres) e nos secrets das Edge Functions.

Ver `supabase/functions/.env.example` e `docs/message-dispatcher/docs/edge-secrets.md`.

### Supabase — Edge Function "generate-smart-description"

A edge function de descrição inteligente (IA) usa a API da OpenAI. Configure a chave no projeto Supabase:

1. No [Dashboard do Supabase](https://supabase.com/dashboard), abra o projeto (Orbit).
2. Vá em **Project Settings** → **Edge Functions** (ou **Secrets**).
3. Adicione o secret **`OPENAI_API_KEY`** com a chave da sua API OpenAI.

Sem essa chave, a função retorna erro ao ser invocada. Em desenvolvimento local com Supabase CLI: `supabase secrets set OPENAI_API_KEY=sk-...`.

Outros comandos úteis: `yarn db:migrate`, `yarn db:reset`, `yarn generate-supabase-types`.

Internal Edge Functions (pg_net auth): `docs/internal-edge-functions-auth.md`.

## Documentação e agentes

- **Agentes (Cursor):** `AGENTS.md` — contexto, comandos e regras em `.cursor/rules/`
- **Negócio:** `docs/business/`
- **Regras Cursor:** `.cursor/rules/` — índice em `AGENTS.md`; plataforma/UX: `platform-ux`

## Estrutura de código

Features em `src/features/<nome>/` (api, components, hooks, types, utils, `index.ts` como API pública). Ver regra `feature-architecture`.
