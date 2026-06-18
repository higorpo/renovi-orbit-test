# Trabalhos do prestador (`provider-jobs`)

## 1. Leitura para negócio

- **Para que serve:** o prestador vê **oportunidades liberadas pelo matching progressivo** (lote ou mercado aberto), abre o **detalhe** em `/dashboard/services/:id`, pode **descartar** cards no feed, **perguntar** ao cliente e **enviar ou editar** **orçamento** (CNS).
- **Quem usa:** apenas **prestador** autenticado.
- **Valor:** liquidez controlada — só aparecem pedidos para os quais o dispatch concedeu **visibilidade**.
- **Riscos:** **dois papéis da localização** — beacon em background (Android) alimenta **elegibilidade em lote**; GPS em **primeiro plano** só afeta ordenação *Mais próximos* no feed. Web/PWA não atualiza beacon em background.

## 2. Visão geral técnica

| Aspecto | Detalhe |
|---------|---------|
| Rotas | `/dashboard/jobs` (lista); detalhe via **`view-services`** → `/dashboard/services/:serviceRequestId` |
| Lista | Edge **`list-provider-opportunities`** → RPC `list_provider_opportunities`; cursor; **20** itens/página |
| Sort | `nearest` (exige GPS feed), `newest`, `least_competitive` — **sem** filtro de raio/serviço na UI |
| Descartar | RPC **`dismiss_provider_opportunity`** |
| Detalhe / proposta | **`view-services`** + **`negotiation-proposals`** (`get_service`, `create_provider_proposal`, …) |
| Beacon / lote | **`device-beacon`** — `useProviderLocationTracking`, sync em `user_device_beacons` |

## 3. Documentação da feature

| Documento | Conteúdo |
|-----------|----------|
| [features/trabalhos-e-propostas.md](./features/trabalhos-e-propostas.md) | Feed progressivo, geo dupla, sort, dismiss, gates, proposta |
| [matching-dispatch](../matching-dispatch/README.md) | Backend: lotes, cron, gates, MMD |

## 4. Arquivos-chave (mapa rápido)

| Área | Caminhos |
|------|----------|
| Lista | `ProviderJobsPage.tsx`, `JobCard.tsx`, `JobsHeader.tsx`, `JobsSortTabs.tsx` |
| Feed hooks | `useProviderJobs.ts`, `useProviderJobsFilters.ts`, `useDismissOpportunity.ts` |
| Geo feed | `useProviderLocation.ts` (foreground only) |
| API lista | `api/providerJobs.api.ts`, `api/dismissOpportunity.api.ts` |
| Detalhe | `@/features/view-services` (`ServiceDetailPage`) |

## 5. Edge Function (referência)

- **`list-provider-opportunities`:** auth prestador, sort/cursor/limit, coords opcionais para distância.
- **Legado removido:** `match-provider-jobs` / RPC `match_provider_jobs` (migration `20260711230000_matching_drop_legacy_feed.sql`).

## 6. Migrações e SQL (referência)

- Matching: `supabase/migrations/202607110*`–`20260711230000_*`.
- Visibilidade: `service_request_provider_visibility`, dispatch em `service_request_dispatches`.

## 7. Relação com outros módulos

- **`matching-dispatch`:** quem concede visibilidade e abre lotes.
- **`device-beacon`:** localização operacional para discovery.
- **`view-services`:** detalhe unificado do pedido.
- **`my-account`:** serviços ofertados e bairros (elegibilidade fallback e discovery).
- **`message-dispatcher`:** template `matching.new_opportunity` após lote.
