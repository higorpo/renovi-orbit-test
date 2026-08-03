# Matching progressivo e dispatch de pedidos (backend)

Módulo **backend-only** (sem rota de UI própria). Distribui pedidos `OPEN` a prestadores em **lotes progressivos**, controla **gates** de negócio e alimenta o feed de Trabalhos via Edge `list-provider-opportunities`.

UI do feed: [provider-jobs](../provider-jobs/README.md). Beacon GPS: link em [device-beacon](../../../rastreabilidade.md) (não documentado como módulo neste índice).

---

## 1. Leitura para negócio

- **Para que serve:** quando um cliente abre um **pedido** (`OPEN`), a plataforma **não** mostra o pedido a todos os prestadores elegíveis de uma vez. Um **dispatch** (`service_request_dispatches`) abre **lotes** de prestadores compatíveis ao longo do tempo, envia **notificações** (e-mail/push via Message Dispatcher) e aplica **gates** (pausa, parada, expiração, mercado aberto).
- **Quem é afetado:** **prestadores** (feed em Trabalhos, notificações, elegibilidade para proposta); **clientes** (tempo até receber orçamentos; lifecycle 24h/48h sem proposta); **operações** (crons, telemetria `job_runs`).
- **Valor:** reduz ruído no feed, prioriza proximidade e qualidade, alinha notificação à visibilidade.
- **Riscos de suporte:** confundir **dispatch de pedido** com **dispatch de notificação** (Message Dispatcher); prestador sem oportunidade pode estar fora do lote, sem beacon recente, `operational_status = suspended`, ou com dispatch **DISPATCH_PAUSED** / **DISPATCH_STOPPED** / terminal.

---

## 2. Visão geral funcional

| Aspecto | Descrição |
|---------|-----------|
| **Objetivo** | Matching progressivo: discovery → ranking → lote → visibilidade → notificação → feed |
| **Escopo** | Tabelas/enums de dispatch, RPCs de lote/gates/feed, crons, Edge de listagem, integração CNS (proposta/aceite/cancel), lifecycle sem proposta |
| **Limites** | Sem tela admin de matching neste tree; mudança de `operational_status` bloqueada para app (admin tooling fora do MVP) |
| **UI consumidora** | Prestador: `/dashboard/jobs` via [provider-jobs](../provider-jobs/README.md). Cliente: notificações 24h/48h e detalhe do pedido |

---

## 3. Features do módulo

| Feature | Resumo | Documento |
|---------|--------|-----------|
| Dispatch, lotes e visibilidade | FSM do dispatch, lotes, gates, discovery/ranking, feed, MMD, lifecycle 24h/48h | [features/dispatch-e-visibilidade.md](./features/dispatch-e-visibilidade.md) |

---

## 4. Perfis envolvidos

| Perfil | Papel |
|--------|--------|
| **Cliente** | Cria/cancela pedido; recebe push/e-mail no lifecycle sem proposta; aceita proposta → `DISPATCH_MATCHED` |
| **Prestador** (`operational_status = active`) | Entra em lotes / mercado aberto; vê feed; descarta oportunidade; propõe / inicia chat (com regras CNS) |
| **Prestador suspenso** | Feed vazio (Edge e RPC); não participa de discovery |
| **Ops / service_role** | Crons, leases, janitor; tabelas de matching com RLS deny para `authenticated`/`anon` |

---

## 5. Principais fluxos

1. Pedido → `OPEN` → trigger bootstrap cria `service_request_dispatches` (`DISPATCH_PENDING`, `next_batch_at` = agora + delay).
2. Cron `matching_process_service_request_dispatches` (a cada **2 min**): expira lifecycle → abre lotes devidos → reavalia gates PAUSED/STOPPED.
3. Abertura de lote: discover → rank → batch + visibility `source=batch` → trigger MMD `matching.new_opportunity`.
4. Prestador lista oportunidades (Edge → RPC); pode dismiss.
5. Pool vazio → `DISPATCH_FALLBACK_OPEN_MARKET` (mercado aberto lazy no feed).
6. Gates / aceite / cancel / expire / auto-cancel 48h sem proposta → estados terminais ou pausa.

Detalhe e Mermaid: [dispatch-e-visibilidade](./features/dispatch-e-visibilidade.md).

---

## 6. Regras transversais

- Constantes em `platform_constants` com prefixo `matching.*` (delay, intervalo, tamanho de lote, lifecycle 48h, ranking, feed, etc.).
- RLS: tabelas de matching **deny** direto para cliente autenticado; mutações via SECURITY DEFINER / service_role.
- **Não** confundir com Message Dispatcher: falha de push/e-mail **não** revoga visibilidade no feed.
- Localização dupla: beacon → elegibilidade de lote; GPS foreground do app → ordenação “Mais próximos” no feed (sem fabricar coordenadas).

---

## 7. Entidades

| Entidade | Função |
|----------|--------|
| `service_request_dispatches` | FSM 1:1 com `service_requests` |
| `service_request_dispatch_batches` | Sequência de lotes |
| `service_request_dispatch_batch_providers` | Prestadores do lote + snapshot de ranking |
| `service_request_provider_visibility` | Visibilidade `batch` e marcador `fallback_dismiss` |
| `service_request_dispatch_events` | Auditoria append-only |
| `provider_latest_locations` | Última localização derivada de beacons (discovery) |
| `provider_rating_stats` / `provider_proposal_stats` | Inputs de ranking |

---

## 8. Integrações

| Integração | Como |
|------------|------|
| **request-quote / service_requests** | Bootstrap no primeiro `OPEN` |
| **provider-jobs** | Consome Edge `list-provider-opportunities` |
| **message-dispatcher** | Templates `matching.new_opportunity`, `matching.no_proposal_*` |
| **chats / negotiation-proposals** | Gates STOPPED/PAUSED; `DISPATCH_MATCHED` no aceite; chat **sem** gate STOPPED |
| **device-beacon** | Alimenta `provider_latest_locations` (só link; ver rastreabilidade) |
| **view-services** | Deep link de push: `/dashboard/services/:id` |

---

## 9. Riscos e lacunas

| Risco / lacuna | Evidência / nota |
|----------------|------------------|
| Suporte confunde “sem card” com bug de app | Pode ser lote ainda não aberto, PAUSED, sem área/serviço, dismiss, suspenso |
| Mercado aberto some após `DISPATCH_EXPIRED` | Feed fallback exclui `DISPATCH_EXPIRED` |
| Admin de `operational_status` fora do MVP | Comentário na migration M2 |
| Docs técnicos de design | `docs/matching-algorithm/` (complementar; código é fonte da verdade) |
| **Legado feed aberto incompleto** | Edge `match-provider-jobs` **removida** (código deletado; pasta vazia residual no tree). RPC `match_provider_jobs` **ainda existe** no schema (redefinida em `20260801240000_payment_match_provider_jobs_onboarding_gate.sql` com gate de credentialing). Migration `20260711230000_matching_drop_legacy_feed.sql` **não existe** no repo (gap `…11220000` → `…11240000`). Nenhum caller em `src/`; grant só `service_role`. Detalhe: [dispatch-e-visibilidade § legado](./features/dispatch-e-visibilidade.md#legado-feed-aberto-vs-estado-real) |

---

## 10. Evidências

| Área | Caminhos |
|------|----------|
| Migrations matching | `supabase/migrations/202607110*`, `2026071209*`, `2026071212*`, `20260802190000_service_request_no_proposal_lifecycle.sql` |
| Edge feed **viva** | `supabase/functions/list-provider-opportunities/` + `[functions.list-provider-opportunities]` em `supabase/config.toml` |
| Edge feed **morta** | `supabase/functions/match-provider-jobs/` — diretório **vazio** residual (sem `.ts`; sem entrada em `config.toml`; arquivos removidos no commit do matching) |
| RPC legado (ainda no DB) | `public.match_provider_jobs` — última redefinição `20260801240000_payment_match_provider_jobs_onboarding_gate.sql`; pgTAP `supabase/tests/payments/payment_match_provider_jobs_onboarding_gate_test.sql` |
| Consumo UI | `src/features/provider-jobs/api/providerJobs.api.ts` → `list-provider-opportunities` |
| Contratos | `supabase/functions/_shared/contracts/list-provider-opportunities/` |
| pgTAP matching | `supabase/tests/matching/` |
| E2E | `e2e/matching/` (quando presente) |
| Feature doc | [features/dispatch-e-visibilidade.md](./features/dispatch-e-visibilidade.md) |
