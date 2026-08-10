# Pendências e incertezas

Itens que exigem validação humana, evidência parcial ou conflito entre trechos do código.

**Auditoria transversal:** 2026-08-02.

## Conflitos ou riscos técnicos com impacto de negócio

| ID | Tema | Descrição | Severidade sugerida | Status |
|----|------|-----------|---------------------|--------|
| P-01 | Redirecionamento pós-pedido | `useRequestQuoteSubmit` navega para `/dashboard/client` após sucesso; **não existe** essa rota em `router.tsx` (apenas `/dashboard/...`). **Comportamento provável:** 404 ou fallback do router. **Confirmado 2026-08-02:** `navigate("/dashboard/client", { replace: true })` ainda em `useRequestQuoteSubmit.ts` (+ teste unitário esperando o mesmo path). | Alta — fluxo cliente após pedido | **Aberta** |
| P-02 | Destino do admin | `getRedirectPathForProfile` envia `admin` para `/admin/dashboard`; **rotas `/admin` não constam** do `router.tsx`. | Alta — se existirem usuários admin reais | **Aberta** |
| P-03 | Onboarding | Papéis desconhecidos redirecionam para `/onboarding`; rota **não listada** no router analisado. | Média | **Aberta** |
| P-04 | Menu vs rota “Endereços” | Menu do cliente aponta `/dashboard/addresses`, mas a rota renderiza `DashboardFakePage` (“Endereços” placeholder). Gestão real em `MyAccountClientPage` (`AddressesSection`). | Média — UX/ops | **Aberta** |
| P-06 | Default do provedor de IA | Comentários em tipos vs `handlerHelpers` do Edge Function: default efetivo do campo `provider` pode ser **Gemini**; documentação interna pode divergir. | Baixa — transparência operacional | **Aberta** |

## Resolvidas (histórico)

| ID | Tema | Resolução |
|----|------|-----------|
| ~~P-05~~ | `/dashboard/services/:id` | **Fechada (2026-08-02):** a rota **não** é placeholder. Evidência: `router.tsx` → `ServiceDetailShell` (`view-services`). Detalhe unificado por fase documentado em [visualizacao-de-servicos](./modulos/view-services/features/visualizacao-de-servicos.md). Evoluções restantes (ex.: aba Disputas vazia em Meus Serviços) são produto, não “página em construção”. |
| ~~P-10~~ | Cobertura documental parcial do Message Dispatcher | **Fechada (2026-08-02):** capacidades cobertas em `message-dispatcher/features/*` — [pipeline-e-fsm](./modulos/message-dispatcher/features/pipeline-e-fsm.md), [quotas-e-canais](./modulos/message-dispatcher/features/quotas-e-canais.md), [horario-silencioso](./modulos/message-dispatcher/features/horario-silencioso.md), [engagement-push-click](./modulos/message-dispatcher/features/engagement-push-click.md). Permanecem abertos só P-08/P-09 (parametrização operacional). |
| ~~P-11~~ | Cobertura parcial de `service-reschedule` (ciclo FSM) | **Fechada como lacuna documental (2026-08-02):** FSM request/propose/adjustment/aceite/cancel/expire/supersede documentado em [ciclo-estados-reagendamento](./modulos/service-reschedule/features/ciclo-estados-reagendamento.md). Residuais de produto/evidência parcial → **P-SR-*** abaixo. |
| ~~P-12~~ | Cancelamento pós-`PAID` com commit parcial | **Resolvido (2026-07-29):** Opção A (gateway first) — `payment_prepare_refund_request` → `refundTransaction` → `payment_commit_refund_after_gateway`; falha de gateway = zero mutações irreversíveis. Recovery: `payment_mark_refund_gateway_acked`, reconcile (PAID+SUBMITTED; completa cancel se gateway REFUNDED) e webhook. Doc: [`critical-bug-refund-partial-commit.md`](../payment-system/critical-bug-refund-partial-commit.md). Relacionado: CHK-008. |

## Message Dispatcher (operacional — ainda abertas)

| ID | Tema | Descrição | Severidade sugerida |
|----|------|-----------|---------------------|
| P-08 | Janela de horário silencioso hardcoded | A janela 22:00–06:00 America/Sao_Paulo está fixa nas funções SQL `message_dispatcher_is_quiet_hours` e `message_dispatcher_next_send_window`. Para alterar é necessário modificar a migration. Sugestão: parametrizar via `platform_constants`. | Baixa — operacional |
| P-09 | Fuso horário único | O horário silencioso não considera o fuso horário do perfil do usuário; todos são tratados em BRT. Para operação futura em outros fusos, será necessário adaptar. | Baixa — evolução futura |

## Matching-dispatch (legado / credentialing)

| ID | Tema | Descrição | Severidade sugerida |
|----|------|-----------|---------------------|
| P-MD-04 | RPC `match_provider_jobs` órfã | ADR/design M15 pedem `DROP FUNCTION match_provider_jobs` + remoção da Edge. **Edge removida** (pasta vazia residual); RPC **ainda no schema** (`20260801240000_payment_match_provider_jobs_onboarding_gate.sql`); migration de drop **ausente** no repo. App usa só `list-provider-opportunities`. Evidência: [dispatch-e-visibilidade § legado](./modulos/matching-dispatch/features/dispatch-e-visibilidade.md#legado-feed-aberto-vs-estado-real). | Baixa — higiene de schema |
| P-MD-05 | Gate NetCred só na RPC morta | Gate `payment_provider_is_credentialed` / `PROVIDER_NOT_CREDENTIALED` está na RPC legado `match_provider_jobs`; **não** aparece em `list_provider_opportunities` (caminho vivo do feed). | Média — gap de credentialing no feed vivo |

Também referenciados no módulo matching (fora desta consolidação se já fechados no feature): P-MD-01…03.

## Service-completion (produto shipped; lacunas de disputa)

| ID | Tema | Notas | Severidade |
|----|------|-------|------------|
| SC-01 | FSM de disputa in-app | Stub only (`DisputeStubEntry` + URL/toast). Chargeback/`is_disputed` permanece em payments. | Baixa — expectativa de produto |
| SC-02 | Aba Disputas em Meus Serviços | Lista sempre vazia no client — ver view-services VS-01. | Baixa |

## Service-reschedule (residuais pós-P-11)

| ID | Tema | Descrição | Severidade sugerida |
|----|------|-----------|---------------------|
| P-SR-01 | `is_last_minute` | Consumo em score/confiabilidade do prestador — não evidenciado no módulo. | Baixa |
| P-SR-02 | Templates MMD `service.reschedule_*` | Conteúdo exato e-mail/push — só chaves no catálogo. | Baixa |
| P-SR-03 | Erros UI | Mapeamento de `SLOT_START_DATE_TOO_SOON` e `INVALID_RESCHEDULE_STATUS_TRANSITION` na UI. | Baixa |
| P-SR-05 | Outcomes `payment_reschedule_charge_date` | Enumeração completa além dos três caminhos principais — evidência parcial (SQL). | Baixa |
| P-SR-06 | Templates aceite vs recaptura | Texto MMD de aceite vs evento de payment — gap payments/MMD. | Baixa |

## Provider-calendar (produto)

| ID | Tema | Descrição | Severidade sugerida |
|----|------|-----------|---------------------|
| ~~PC-01~~ | ~~Índices transversais~~ | **Fechado (2026-08-02):** Calendário presente em `02-mapa-de-modulos-e-features.md`, `modulos/README.md`, glossário, matriz e rastreabilidade. | — |
| PC-02 | Menu dedicado | Item de menu vs só banner em Meus Serviços — decisão de produto; código = só banner. | Baixa — produto |
| PC-03 | `color_key` / badge | Campos no contrato RPC sem uso visual. | Baixa — produto |
| PC-04 | Detalhe sheet | Confirmar se detalhe deve ser sheet (como Meus Serviços); código = navegação página cheia. | Baixa — produto |
| PC-05 | Analytics | Instrumentação GA/Sentry além de `logger.error` na API — não encontrada. | Baixa |

## Notifications / push

| ID | Tema | Descrição | Severidade sugerida |
|----|------|-----------|---------------------|
| N-01 | Clique de push na **web** | Engagement de clique via SW/PWA **não** implementado pelo módulo `notifications` (só listeners nativos Capacitor em `src/lib/push.ts`). Evidência: [engagement-push](./modulos/notifications/features/engagement-push.md). | Média — cobertura de canal |

## Payments / reconciliação

| ID | Tema | Descrição | Severidade sugerida |
|----|------|-----------|---------------------|
| PAY-DC | `deferred_captured` | Após auto-cancel vindo de `IN_ANALYSIS`, se o gateway já está `PAID`, a EF `reconcile-inanalysis-auto-cancel-voids` emite outcome `deferred_captured`: parcela permanece `CANCELLED`, **sem** void/auto-refund neste path — dinheiro capturado com serviço cancelado no Orbit. Gap ops documentado em [reconciliacao-e-voids](./modulos/payments/features/reconciliacao-e-voids.md). | Alta — ops / financeiro |

## Evidência parcial

- **Políticas RLS linha a linha:** resumidas por módulo; revisão jurídica/compliance exige leitura integral de cada migration.
- **Mensagens de erro do servidor:** RPCs retornam JSON estruturado; nem todas as chaves foram catalogadas nas features. **Exceção de UX (pagamentos):** na feature `payments`, a UI mapeia códigos para mensagens amigáveis em pt-BR e **não** exibe texto bruto do backend (checkout, cartões, cobrança manual) — ver [checkout-e-cobranca](./modulos/payments/features/checkout-e-cobranca.md#mensagens-de-erro-na-ui-pt-br). Os códigos de rejeição por análise de risco ClearSale (`RISK_ANALYSIS_*`) estão documentados nesse feature doc; o catálogo completo de *todos* os demais códigos de pagamento→cópia na documentação de negócio ainda não é exaustivo.
- **Testes E2E:** não foram executados nesta documentação; apenas leitura estática. Sessão mockada/seed usa chaves com prefixo **`CapacitorStorage.`** no `localStorage` do browser (alinhado ao fallback web do plugin Preferences).
- **device-beacon**, **push-permission**, **notifications**, **provider-calendar:** passam a ter README + feature em `docs/business/modulos/` (auditoria 2026-08-02); ver [matriz](./matriz-cobertura-documental.md) e [rastreabilidade](./rastreabilidade.md).

## Comportamento inferido

- Prestador e cliente compartilham o layout `/dashboard`; a **especialização** ocorre por submenu + guards aninhados.
- “Configurações”, “Ajuda”, “Visão geral” no menu são **placeholders** até nova implementação. **Ganhos** (`/dashboard/earnings`) passou a ser feature real (`provider-earnings`) — ver [ganhos-e-liquidacoes](./modulos/provider-earnings/features/ganhos-e-liquidacoes.md). **Calendário** (`/dashboard/services/calendar`) é feature real (`provider-calendar`); entrada via banner em Meus Serviços (prestador), sem item de menu dedicado (PC-02).
- ~~Prestador compartilha o menu operacional completo independentemente do KYC.~~ ~~**Corrigido (2026-07-30):** sem onboarding `ACTIVE`, o menu do prestador fica só em Minha conta e o shell operacional é bloqueado pelo `ProviderKycGate`.~~ ~~**Atualizado (2026-08-03):** menu completo do prestador **sempre** visível (`getDashboardMenu`); o `ProviderKycGate` continua substituindo o **conteúdo** operacional até `ACTIVE`.~~ **Atualizado (2026-08-03):** menus **completamente ocultos** enquanto loading ou KYC ≠ `ACTIVE` (`useProviderKycBlocksNav` + `DashboardLayout`); gate continua substituindo o **conteúdo**; allowlist `/dashboard/conta*`; header/logo permanece — ver [provider-kyc](./modulos/provider-kyc/features/gate-e-acesso-operacional.md). Hook `useProviderKycNavItems` removido anteriormente.

## Necessita validação com negócio/produto

- Regras exatas de **matching** geográfico (raio, ordenação) e pesos de negócio além do que está em SQL/RPC. → **Parcialmente resolvido (2026-06):** ver [matching-dispatch](./modulos/matching-dispatch/README.md) e [trabalhos-e-propostas](./modulos/provider-jobs/features/trabalhos-e-propostas.md). Residuais P-MD-04/05 (legado).
- Política de **expiração** de propostas (`expire_stale_provider_proposals`) — frequência de execução (cron) não verificada neste escopo.
- ~~**Pagamentos e contratos** — apenas planos em `docs/payment-system-*.md`, sem implementação mapeada nas Edge Functions deste tree.~~ **Resolvido (2026-07):** módulo `payments` implementado. Inclui [reconciliacao-e-voids](./modulos/payments/features/reconciliacao-e-voids.md) (2026-08-02). Residual: **PAY-DC** (`deferred_captured`).
- ~~**Drift de taxas checkout → T-2** — se congelar ou recalcular.~~ **Resolvido (produto):** drift intencional; UI divulga recálculo no momento da cobrança (`PaymentTrustDisclosure`).
- ~~**Acesso do prestador ao dashboard antes do KYC `ACTIVE`.**~~ **Resolvido (2026-07-30, Fase 2; menu: 2026-08-03 ocultação via `useProviderKycBlocksNav`):** conteúdo operacional bloqueado até `ACTIVE`; chrome de navegação oculto durante loading/bloqueio.
- ~~**Detalhe campo a campo do formulário KYC.**~~ **Resolvido (2026-07-30, Fase 3):** wizard multi-etapas documentado.
- ~~**Lembretes de KYC incompleto.**~~ **Documentado (2026-08-10):** cron diário + MMD `PROVIDER_ONBOARDING_INCOMPLETE_REMINDER` para `PENDING_DOCUMENTS`/`REJECTED` — ver [lembretes-credenciamento-incompleto](./modulos/provider-kyc/features/lembretes-credenciamento-incompleto.md).

## Inferências explicitamente não comprovadas

- Uso de **Realtime** Supabase para notificações push ao usuário (config habilitado no `config.toml`, uso no `src` não mapeado de forma exaustiva). Clique de push nativo usa `notifications` + MMD; web (N-01) sem path.
- ~~**Envio de e-mail** em produção: Resend aparece em comentários de config; ambiente local usa Inbucket.~~ **Resolvido:** o Message Dispatcher utiliza Resend como vendor de e-mail e FCM para push, com integração completa (ingest → checkout → worker → report → webhook reconcile). Evidência: `supabase/functions/message-dispatcher-ingest/`, `message-dispatcher-worker/`, `message-dispatcher-webhook-resend/`, migration FSM.

## Resumo rápido (2026-08-02)

| Situação | IDs |
|----------|-----|
| **Abertas (conflito/produto)** | P-01, P-02, P-03, P-04, P-06 |
| **Abertas (MMD operacional)** | P-08, P-09 |
| **Abertas (matching legado)** | P-MD-04, P-MD-05 |
| **Abertas (reagendamento residual)** | P-SR-01, P-SR-02, P-SR-03, P-SR-05, P-SR-06 |
| **Abertas (conclusão / disputa stub)** | SC-01 (FSM disputa completa fora do escopo), SC-02 (aba Disputas vazia) — documentados; não bloqueiam comportamento shipped. Endurecimento SQL 2026-08-05 (evidência/sessões/contexto/RLS; janitor órfãos SQL-only, sem Edge) **documentado**; upload evidência Option A **documentado**; UX CTAs sheet/dialog + galeria evidências (2026-08-05) **documentada**; lazy load do completion context (2026-08-06) **documentado**; highlight de follow-up nos cards Meus Serviços pós-data-fim/`EXECUTED` (2026-08-06) **documentado**; CTA “Concluir serviço” no card do prestador (`CONFIRMED` + past) (2026-08-06) **documentado**; SELECT storage/`createSignedUrl` para cliente com evidência `frozen` (2026-08-06) **documentado**; Declaração de execução (tabela + Edge + gate manual; auto-complete sem declaração; sem SELECT autenticado) (2026-08-07) **documentada** — sem nova pendência. |
| **Abertas (calendário)** | PC-02…PC-05 |
| **Abertas (push/payments)** | N-01, PAY-DC |
| **Fechadas nesta auditoria** | P-05, P-10, P-11 (doc); P-12 (histórico); **PC-01** (índices transversais) |
| **Profundidade documental (Onda 6 + 2026-08-04/05/10)** | **34/34** features com ≥20 seções (incl. `conclusao-e-enrichment` + `lembretes-credenciamento-incompleto`). Sem Parcial por profundidade na matriz. |
