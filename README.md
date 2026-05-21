# Orbit (Renovi)

Plataforma mobile-first da Renovi: **uma codebase** React (Vite) que entrega **web/PWA** e **apps nativos** via [Capacitor](https://capacitorjs.com/).

## Plataformas

| Superfície | Status | Notas |
|------------|--------|--------|
| **Web / PWA** | Ativo | Browser + instalável; Service Worker em `src/sw.ts`; offline-first |
| **Android (nativo)** | Ativo | Projeto em `android/`; `appId` `br.com.renovi.orbit` |
| **iOS (nativo)** | Em breve | Mesmo código; projeto Capacitor iOS ainda não disponível no repositório |

Toda feature nova deve ser pensada **app-first e mobile-first** (touch, telas estreitas, safe areas, teclado nativo, persistência local), e depois adaptada para desktop. Detalhes de UX: regra Cursor `mobile-first-ux`; offline/cache: `pwa-offline-first`; Capacitor: `capacitor-multi-platform`.

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

### Supabase — Edge Function "generate-smart-description"

A edge function de descrição inteligente (IA) usa a API da OpenAI. Configure a chave no projeto Supabase:

1. No [Dashboard do Supabase](https://supabase.com/dashboard), abra o projeto (Orbit).
2. Vá em **Project Settings** → **Edge Functions** (ou **Secrets**).
3. Adicione o secret **`OPENAI_API_KEY`** com a chave da sua API OpenAI.

Sem essa chave, a função retorna erro ao ser invocada. Em desenvolvimento local com Supabase CLI: `supabase secrets set OPENAI_API_KEY=sk-...`.

Outros comandos úteis: `yarn db:migrate`, `yarn db:reset`, `yarn generate-supabase-types`.

## Documentação e agentes

- **Agentes (Cursor):** `AGENTS.md` — contexto, comandos e regras em `.cursor/rules/`
- **Negócio:** `docs/business/`
- **Regras Cursor:** `.cursor/rules/` — inclui `capacitor-multi-platform`, `mobile-first-ux`, `pwa-offline-first`

## Estrutura de código

Features em `src/features/<nome>/` (api, components, hooks, types, utils, `index.ts` como API pública). Ver regra `feature-architecture`.
