# Orbit — contexto para agentes

## Plataformas (web + nativo)

**Uma codebase** serve **web/PWA** e **apps nativos Android/iOS** via **Capacitor**:

| Superfície | Status |
|------------|--------|
| Web / PWA | Ativo (`src/sw.ts`, offline-first) |
| Android | Ativo (`android/`, `br.com.renovi.orbit`) |
| iOS | Em breve (mesmo fluxo; projeto `ios/` ainda não no repo) |

**Sempre pensar mobile-first e app-first** antes de desktop: touch, viewport estreita, safe areas, teclado nativo (`--keyboard-height`), persistência em Capacitor Preferences (`src/lib/capacitor/`). Regras Cursor: `capacitor-multi-platform`, `mobile-first-ux`, `pwa-offline-first`.

Bootstrap: `main.tsx` → `initCapacitorPlugins()` → `hydratePersistSessionPreference()` → React. Build nativo: `yarn build` → `yarn cap:sync` → `yarn android` / `yarn ios`.

## Stack

- **Frontend:** React 19, Vite 7, TypeScript, React Router 7, TanStack Query, Tailwind, Radix/shadcn-style UI em `src/components/ui/`.
- **Nativo:** Capacitor 8 — plugins em `src/lib/capacitor/`, config em `capacitor.config.ts`.
- **Backend local:** Supabase (Postgres, RLS, migrations em `supabase/migrations/`, Edge Functions em Deno em `supabase/functions/`).

## Comandos (sempre com Node correto)

- Versão do Node: **24.13** (arquivo `.nvmrc`). Preferir `nvm use` antes de `yarn` / `npx`.
- `yarn dev` — servidor de desenvolvimento (web).
- `yarn dev:host` — Vite com `--host` (testar WebView no dispositivo).
- `yarn build` — typecheck + build (`dist/` para web e Capacitor).
- `yarn cap:sync` — sincroniza `dist` e plugins com `android/` (e `ios/` quando existir).
- `yarn android` / `yarn ios` — build + sync + abre IDE nativa.
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

### Documentação de negócio (`docs/business`)

- **Hook Cursor (`stop`):** [Hooks | Cursor Docs](https://cursor.com/docs/hooks) — em **`.cursor/hooks.json`** o evento `stop` roda `node .cursor/hooks/on-agent-stop-sync-docs.mjs`, que detecta mudanças em código de produto e grava **`.cursor/hooks/.business-docs-sync-pending.json`** (gitignored) + mensagem nos logs do hook. Isso **não** substitui a edição da documentação; apenas sinaliza pendência.
- Regra **`business-docs-sync-after-code-changes`**: ao **concluir** um pedido com alterações relevantes, o agente deve disparar um **subagente (Task)** para atualizar `docs/business/` conforme **`.cursor/commands/atualizar-documentacao-negocio.md`**, remover o `.business-docs-sync-pending.json` se aplicável, e resumir na resposta final.
- Comando manual: **`.cursor/commands/atualizar-documentacao-negocio.md`**.

## Worktree Git

- Este diretório pode ser um **git worktree**: é a raiz do repositório para abrir no Cursor; não é necessário abrir o worktree pai.
