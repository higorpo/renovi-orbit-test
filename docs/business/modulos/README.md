# Módulos da aplicação Orbit — índice e cobertura documental

Este diretório concentra a **documentação funcional e técnica por módulo**, alinhada ao código em `src/features/`, `src/layouts/`, `src/router.tsx` e backend Supabase (migrations, Edge Functions).

## Inventário de módulos e telas (evidência: `src/router.tsx`, `src/layouts/DashboardLayout/dashboardMenu.ts`)

| # | Módulo | Telas / superfícies principais | Rotas (path) | Caminho no código | Status doc |
|---|--------|--------------------------------|--------------|-------------------|------------|
| 1 | [auth](./auth/README.md) | Login, cadastro cliente/profissional, esqueci senha, redefinir senha | `/login`, `/cadastro/cliente`, `/cadastro/profissional`, `/esqueceu-senha`, `/recuperar-senha` | `src/features/auth/` | Concluída |
| 2 | [request-quote](./request-quote/README.md) | Wizard pedir orçamento | `/pedir-orcamento` | `src/features/request-quote/` | Concluída |
| 3 | [addresses](./addresses/README.md) | Seleção/CRUD endereços (embutido em fluxos) | Hub `/dashboard/settings/addresses` (+ wizard) | `src/features/addresses/` | Concluída |
| 4 | [settings](./settings/README.md) | Hub Configurações (settings) | `/dashboard/settings/*` | `src/features/settings/` | Concluída |
| 5 | [my-services](./my-services/README.md) | Lista de pedidos (shell); sheet compare/histórico; banner calendário (prestador) | `/dashboard/services` | `src/features/my-services/` | Concluída |
| 5b | [view-services](./view-services/README.md) | Lista/detalhe unificados (RPC); `ServiceDetailShell` (página ou sheet) | `/dashboard/services/:id` (+ consumo por my-services / jobs / calendar) | `src/features/view-services/` | Concluída |
| 6 | [provider-jobs](./provider-jobs/README.md) | Feed de trabalhos (oportunidades); dismiss; propostas via CNS; detalhe via `ServiceDetailShell` / sheet | `/dashboard/jobs` (lista); detalhe `/dashboard/services/:id` | `src/features/provider-jobs/` | Concluída |
| 7 | [provider-profile](./provider-profile/README.md) | Perfil público do prestador | `/perfil/:slug` | `src/features/provider-profile/` | Concluída |
| 8 | [dynamic-form](./dynamic-form/README.md) | Motor de formulários + demo DEV | `/dev/demo/form` (somente `import.meta.env.DEV`) | `src/features/dynamic-form/` | Concluída |
| 9 | [dashboard-shell](./dashboard-shell/README.md) | Layout, menu por papel (Conversas; Ganhos **fora** do menu top-level), placeholders (visão geral, config, ajuda); calendar **fora** do menu | `/dashboard`, `/dashboard/settings`, `/dashboard/help` | `src/layouts/DashboardLayout/` | Concluída |
| 10 | [app-home](./app-home/README.md) | Página inicial mínima | `/` (index) | `src/App.tsx` | Concluída |
| 11 | [message-dispatcher](./message-dispatcher/README.md) | Notificações multicanal (e-mail, push): pipeline/FSM, quotas, quiet hours, engagement | *Sem rota de UI; backend-only* | `supabase/migrations/`, `supabase/functions/message-dispatcher-*` | Concluída (critério doc); P-08/P-09 produto abertos |
| 12 | [chats](./chats/README.md) | Conversas e negociação (CNS): lista, thread, propostas; sheet compare/history | `/dashboard/chats`, `/dashboard/chats/:chatId` (menu **Conversas**) | `src/features/chats/`, `src/features/negotiation-proposals/` | Concluída |
| 13 | [matching-dispatch](./matching-dispatch/README.md) | Dispatch progressivo, lotes, visibilidade, gates; bootstrap READY-handoff; feed via Edge viva; legado feed aberto | *Sem rota de UI; backend + Edge `list-provider-opportunities`* | `supabase/migrations/202607110*`, `2026080411*`, `supabase/functions/list-provider-opportunities/` | Concluída |
| 13b | [service-completion](./service-completion/README.md) | Enrichment pré-matching; checklist; EXECUTED/confirm/auto-complete; Disputa de serviço (`IN_DISPUTE`) | Embutido em `view-services` (Public API) | `src/features/service-completion/`, migrations `20260804*` / `20260810*` dispute, EF `generate-completion-checklist` | Concluída |
| 14 | [service-reschedule](./service-reschedule/README.md) | FSM reagendamento; propor nova data/período; pós-aceite retarget / far-recapture | Embutido em chats e detalhe do serviço | `src/features/service-reschedule/`, migrations `20260802*`, EF `process-far-reschedule-recapture` | Concluída (critério doc); P-SR-* abertos |
| 15 | [payments](./payments/README.md) | Checkout, cobrança T-2, mín. parcela R$ 150, KYC `ACTIVE` para cobrar; histórico/reembolso; reconciliação e voids (ops) | Checkout pós-aceite; histórico no hub `/dashboard/settings/payments`\|`receivables` | `src/features/payments/`, RPCs `payment_*`, EFs NetCred | Concluída (checkout + histórico/reembolso + reconciliacao-e-voids) |
| 16 | [provider-kyc](./provider-kyc/README.md) | Gate do conteúdo até `ACTIVE`; chrome de nav oculto (loading/bloqueio); telas de status; wizard de credenciamento (Fase 3); lembretes MMD de incompleto | Embutido no `DashboardLayout` (exceção conteúdo `/dashboard/settings*`); cron backend | `src/features/provider-kyc/` + migrations KYC/reminders | Concluída (gate + wizard + nav + lembretes) |
| 17 | [provider-earnings](./provider-earnings/README.md) | Ganhos do prestador: liquidações bancárias (previsto / liquidado / estorno) | `/dashboard/settings/earnings` (hub; sem menu) | `src/features/provider-earnings/` | Concluída |
| 18 | [provider-calendar](./provider-calendar/README.md) | Agenda de serviços contratados (lista/grade); só leitura | `/dashboard/services/calendar` (provider); **sem** item de menu; banner em Meus Serviços | `src/features/provider-calendar/` | Concluída |
| 19 | [device-beacon](./device-beacon/README.md) | Sync FCM + localização operacional do prestador; explainer de permissão | *Sem rota; RootLayout (`DeviceBeaconProvider`)* | `src/features/device-beacon/` | Concluída |
| 20 | [push-permission](./push-permission/README.md) | Soft prompt de notificações + cooldown 7 dias | *Sem rota; RootLayout (`PushPermissionPromptHost`)* | `src/features/push-permission/` | Concluída |
| 21 | [notifications](./notifications/README.md) | Cliente `recordPushClick` (engagement de push) | *Sem rota / UI; API + Public API* | `src/features/notifications/` | Concluída |

> **Descontinuado:** [client-budgets](./client-budgets/README.md) — rota `/dashboard/orcamentos` removida; ver `my-services` + `negotiation-proposals`.

### Menu real (evidência `dashboardMenu.ts`)

| Papel | Itens |
|-------|--------|
| Cliente | Visão geral · Meus Serviços · **Conversas** · Endereços · Configurações · Ajuda |
| Prestador | Visão geral · Meus Serviços · Trabalhos · **Conversas** · **Ganhos** · Configurações · Ajuda |

Calendário do prestador: rota `/dashboard/services/calendar` **não** entra no menu.

### Rotas adicionais fora da tabela (evidência direta)

| Rota | Elemento | Observação |
|------|----------|------------|
| `/example` | `div` estático | `ProtectedRoute` apenas `client`; não é módulo em `src/features/` |
| `/dashboard/settings` | `DashboardFakePage` | Ver [dashboard-shell](./dashboard-shell/README.md); fora do menu |
| `/dev/demo/*` | Demos DEV | `form`, showcases de cards — só com `import.meta.env.DEV` |

---

## Critério de “módulo documentado”

Um módulo conta como documentado quando o conjunto **README do módulo + arquivo(s) em `features/`** cobre, com referência a arquivos de código:

- visão geral e contexto de negócio;
- telas/rotas (ou ausência de rota quando o módulo é biblioteca / infra);
- ações principais e integrações (API, RPC, Edge, storage);
- campos/validações **onde existem formulários** (ou referência explícita ao schema);
- regras de negócio verificáveis no código;
- perfis com acesso (guards / router);
- entidades/tabelas ou contratos de API envolvidos;
- evidências (paths) e lacunas sinalizadas.

---

## Cobertura

| Métrica | Valor |
|---------|------:|
| Módulos identificados no escopo do produto (features + shell + home + backends MMD/matching + CNS + reagendamento + pagamentos + KYC + ganhos + calendário + beacon + push + notifications + **service-completion**) | **23** |
| Módulos documentados (critério acima) | **23** |
| **Percentual** | **100%** (critério documental) |

Contagem: inventário anterior **22** + **service-completion** = **23** pastas ativas com README (exclui `client-budgets` descontinuado). `negotiation-proposals` permanece agrupado sob [chats](./chats/README.md).

**Notas de profundidade (não quebram o critério):**

- **service-completion** — README + feature `conclusao-e-enrichment` (enrichment READY-handoff, conclusão, Disputa de serviço).
- **service-reschedule** — README + 3 features (ciclo-estados, propor-nova-data, integracao-pagamento-pos-aceite). Pendências de produto/UX: P-SR-* (ver README do módulo).
- **message-dispatcher** — README + 4 features (pipeline, quotas, quiet hours, engagement). P-08 (janela quiet hours hardcoded) e P-09 (fuso único BRT) abertos; engagement documentado no módulo (lado cliente também em **notifications**).
- **matching-dispatch** — Bootstrap READY-handoff (CONTEXT #135); Edge `match-provider-jobs` morta; RPC `match_provider_jobs` órfã; feed vivo = `list-provider-opportunities`.

---

## Dependências entre módulos (visão rápida)

- **auth** → base de sessão e guards para todo o dashboard; logout dispara limpeza de **device-beacon**.
- **dynamic-form** → usado por **request-quote** (passo 2).
- **addresses** → usado por **request-quote** (passo 4) e **settings** (`AddressesSection`).
- **provider-jobs** → propostas e negociação via **chats** / **negotiation-proposals**; detalhe unificado em **view-services**; feed via **matching-dispatch** (`list-provider-opportunities`); GPS de sort “Mais próximos” via **device-beacon**.
- **matching-dispatch** → bootstrap após enrichment READY (**service-completion**); consome localização fresca alimentada por **device-beacon**; notifica via **message-dispatcher**.
- **service-completion** → enrichment na create/republish; UI no **view-services**; writers `service_completion_*` (fora de **payments**).
- **negotiation-proposals** → sheet `ReceivedBudgetDetailsSheet` consumido por **my-services**; composer/propostas também em **provider-jobs** e **chats**.
- **chats** + **negotiation-proposals** → negociação in-app; integra **message-dispatcher**, **provider-jobs**, **my-services** / **view-services**, **payments**, **service-reschedule**.
- **service-reschedule** → UI em **chats** e **view-services**; duração alinhada a **negotiation-proposals**; pós-aceite em **payments**.
- **payments** → checkout pós-aceite; histórico em **settings**; cancelamento/reembolso com **view-services** / CNS; settlements → **provider-earnings**; ops em reconciliacao-e-voids (**não** ownership de EXECUTED/COMPLETED de produto).
- **view-services** → detalhe/lista; compõe wizards de **service-completion**.
- **provider-earnings** → `/dashboard/settings/earnings` (hub Configurações); disclosure também em payments.
- **provider-kyc** → gate de conteúdo + ocultação do chrome de nav no **dashboard-shell** até NetCred `ACTIVE`; allowlist **settings**; backend KYC/cobrança em **payments**; lembretes incompletos via **message-dispatcher** (cron SQL).
- **provider-calendar** → entrada pelo banner em **my-services** (prestador); detalhe em **view-services**; **não** no menu do shell.
- **device-beacon** → token push + geo operacional; sequência de prompt com **push-permission**; matching e MMD leem `user_device_beacons`.
- **push-permission** → soft prompt no root; token efetivo via `@/lib/push` + sync no beacon.
- **notifications** → `recordPushClick` → RPC do **message-dispatcher**; caller nativo em `src/lib/push.ts`.

---

## Principais lacunas conhecidas (produto vs código)

1. ~~**`/dashboard/addresses`** placeholder~~ — **fechado:** rota/menu removidos; gestão em `/dashboard/settings/addresses` e no wizard.
2. **`/dashboard/services/:id`** usa **`ServiceDetailShell`** (página full ou `null` quando sheet no layout) — **não** é mais placeholder. Evidência: `src/router.tsx`, `src/features/view-services/components/ServiceDetailShell.tsx`. (Afirmação antiga de `ClientMyServicesDetailPlaceholder` está **obsoleta**.)
3. **Pós-sucesso do pedido de orçamento (logado):** possível inconsistência de navegação vs router; validar em `useRequestQuoteSubmit` / `RequestQuote` (pendência de QA).
4. **Papel `admin`:** existe no tipo de perfil; **sem** área administrativa mapeada no `router.tsx` para este repositório.
5. **`/example`:** rota de exemplo, não documentada como módulo de negócio.
6. **Menu vs rotas:** Conversas no menu; Ganhos e calendário e detalhe de serviço são rotas reais **fora** do menu top-level (Ganhos no hub Configurações); Visão geral / Ajuda / Configurações ainda placeholder.
7. **Matching legado:** Edge `match-provider-jobs` morta (pasta vazia); RPC `match_provider_jobs` ainda no schema sem caller de app — ver [matching-dispatch](./matching-dispatch/README.md).
8. **Engagement push na web:** `src/sw.ts` navega no `notificationclick` mas **não** chama `recordPushClick` — gap coberto em [notifications](./notifications/README.md).

---

## Subagentes utilizados nesta rodada de orquestração

Análise em paralelo (exploração baseada em código) — rodada histórica + consolidação mapa:

1. **Auth + guards** — rotas guest, `ProtectedRoute` / `GuestOnlyRoute`, telas, APIs.
2. **request-quote + addresses** — wizard, Edge, rascunho.
3. **provider-jobs / matching-dispatch** — feed vivo vs legado `match-provider-jobs`.
4. **my-services, view-services, settings, provider-profile** — shells, `ServiceDetailShell`, sheets.
5. **dynamic-form + dashboard-shell + app-home** — demos DEV, menu real, placeholders.
6. **chats / negotiation-proposals, service-reschedule, payments, provider-kyc, provider-earnings** — CNS, FSM reagendamento, checkout/reconcile, gate KYC, ganhos.
7. **message-dispatcher + notifications + device-beacon + push-permission + provider-calendar** — MMD, engagement cliente, infra nativa, calendário.

Consolidação transversal (este índice + [mapa](../02-mapa-de-modulos-e-features.md)). Matriz / rastreabilidade / pendências / README raiz: outros workers.

---

## Documentação de negócio relacionada

- [Mapa de módulos e features](../02-mapa-de-modulos-e-features.md)
- [Perfis e permissões](../perfis-e-permissoes.md)
- [Glossário](../glossario-de-negocio.md)
- [Rastreabilidade](../rastreabilidade.md)
- [Pendências e incertezas](../pendencias-e-incertezas.md)
- [Matriz de cobertura documental](../matriz-cobertura-documental.md)
