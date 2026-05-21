# Orbit — contexto para agentes

## Plataformas

Web/PWA + Android (Capacitor) + iOS em breve. **Mobile/app-first.** Detalhes: regra `platform-ux` (quando editar `src/`, `android/`).

Bootstrap: `main.tsx` → `initCapacitorPlugins()` → `hydratePersistSessionPreference()` → React.

## Stack

React 19, Vite 7, TS, React Router 7, TanStack Query, Tailwind, Capacitor 8, Supabase (migrations, Edge Functions).

## Comandos

Node **24.13**: `nvm use` antes de yarn. `yarn dev` | `yarn build` | `yarn cap:sync` | `yarn android` | `yarn test:run` | `yarn test:e2e` | `yarn lint` | `yarn generate-supabase-types` | `yarn db:migrate` | `yarn db:reset`.

## Código

Features em `src/features/<nome>/` (`api`, `components`, `hooks`, `types`, `utils`, `index.ts`). Alias `@/*` → `src/*`.

## Regras Cursor (`.cursor/rules/`)

| Sempre ativas | Por contexto (globs) |
|---------------|----------------------|
| `yarn`, `nvm-node` | `platform-ux` → `src/**`, `android/**` |
| `api-layer`, `feature-architecture` | `e2e-testing` → `e2e/**` |
| `business-logic-in-hooks`, `code-comments` | `supabase-migrations`, `supabase-types`, `supabase-rls-performance` → `supabase/**` |
| | `server-side-pagination-and-filtering` → `src/features/**` |
| | `sentry`, `logger`, `analytics-tracking` → `src/**` |
| | `unit-tests` → `src/**`, `e2e/**`, testes |
| | `business-docs-sync-after-code-changes` → `src/**`, `supabase/**`, `docs/business/**` |
| | `request-quote-draft-version` → `src/features/request-quote/**` |

Comandos: `.cursor/commands/`. Negócio: `docs/business/` — ao concluir pedido com mudanças de produto, sincronizar docs (regra `business-docs-sync-after-code-changes`).

Hook `stop`: `.cursor/hooks.json` → lembrete em `.cursor/hooks/.business-docs-sync-pending.json`.

## Worktree

Este diretório pode ser um git worktree (raiz do repo no Cursor).
