# Orbit — contexto para agentes

## Stack

- **Frontend:** React 19, Vite 7, TypeScript, React Router 7, TanStack Query, Tailwind, Radix/shadcn-style UI em `src/components/ui/`.
- **Backend local:** Supabase (Postgres, RLS, migrations em `supabase/migrations/`, Edge Functions em Deno em `supabase/functions/`).

## Comandos (sempre com Node correto)

- Versão do Node: **24.13** (arquivo `.nvmrc`). Preferir `nvm use` antes de `yarn` / `npx`.
- `yarn dev` — servidor de desenvolvimento.
- `yarn build` — typecheck + build.
- `yarn test:run` / `yarn test` — Vitest.
- `yarn test:e2e` — Playwright.
- `yarn lint` — ESLint em `src/`.
- `yarn generate-supabase-types` — regenera tipos em `src/lib/supabase/database.types.ts` (e espelho em functions quando aplicável).
- `yarn db:migrate` / `yarn db:reset` — Supabase CLI.

## Estrutura de código

- Features em **`src/features/<nome>/`** com `api/`, `components/`, `hooks/`, `types/`, `utils/` e **`index.ts`** como API pública. Detalhes: regra Cursor `feature-architecture`.
- Imports de app: alias **`@/*`** → `src/*` (ver `tsconfig.json`).

## Cursor

- Regras do projeto: **`.cursor/rules/*.mdc`** (yarn, Supabase, testes, arquitetura, etc.).
- Comandos reutilizáveis: **`.cursor/commands/`**.

## Worktree Git

- Este diretório pode ser um **git worktree**: é a raiz do repositório para abrir no Cursor; não é necessário abrir o worktree pai.
