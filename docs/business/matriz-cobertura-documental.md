# Matriz de cobertura documental

Última auditoria completa: **2026-05-30** (revisões pontuais: **2026-07-08** modo de data no **service-reschedule** / propor nova data; **2026-07-09** formato da mensagem SYSTEM ao solicitar com `Observação:`; **2026-07-09** prestador solicita/propõe reagendamento também em `PENDING_PAYMENT`; **2026-07-09** highlight dos cards em Meus serviços quando `contracted.status === PENDING_PAYMENT`; **2026-07-09** no card do cliente, `PENDING_PAYMENT` + `paymentScheduleState === FAILED_PERMANENT` → “Pagamento falhou” / ênfase `error` e CTA primário “Ajustar pagamento” (`ManualPaymentDialog`; CTA prevalece sobre unread, highlight de unread ainda prevalece sobre o alerta de pagamento); **2026-07-09** histórico de pagamentos / breakdown de reembolso e clawback só com `refunded_at`; **2026-07-09** erros de pagamento/cartão na UI mapeados para mensagens amigáveis pt-BR; **2026-07-09** recuperação manual: `ManualPaymentDialog` (ShellDialog mobile) com fluxo cartão → parcelas (`InstallmentSelector`) → `payment_update_method` (`p_installment_number` + HMAC; estados `FAILED_PERMANENT` elegíveis) → `manual-charge-payment`; **2026-07-10** tokenização/cadastro de cartão exige CPF do titular igual ao CPF da conta e alerta não bloqueante quando o primeiro nome do cartão difere do perfil; **2026-07-10** countdown de SLA de proposta usa `expires_at` das RPCs `get_proposal_detail_*` (constantes `platform_constant_*` restritas a `service_role`); **2026-07-13** `charge_amount` documentado como gross-up NetCred `(base + PROCESSING + RISK_ANALYSIS) / (1 − MDR%)` com `cc_risk_analysis_fee_brl`; antecipação fora da fórmula; split `FIXED_AMOUNT` do prestador inalterado; **2026-07-13** rejeição ClearSale/NetCred “Análise de Risco: …” → códigos `RISK_ANALYSIS_*` em `failure_code` (texto bruto só em `failure_reason`); UI de pagamento manual (alerta + dialog) mostra cópia pt-BR pelo código; **2026-08-02** tabela `payment_schedules_audit` (row-history append-only via triggers de statement, `row_version`, RLS admin-only) documentada no README de `payments`, distinta do `payment_audit_log`; **2026-07-19** remediações de segurança de checkout: ClearSale session server-side + fail-closed; manual reconcile anti double-charge; webhook assinatura terminal + `paid_amount` server-side; reembolso retry/âncora ToS/`PAID`→`REFUNDED`; token↔**platform** company (merchant tokenização/`chargeCreate` sempre Renovi; prestador só no payout); `PROFILE_INCOMPLETE`; disclosure de drift de taxas; KYC `ACTIVE` obrigatório para cobrar; `CARD_REJECTED` opaco); **2026-07-29** reagendamento pós-`PAID` longe: recaptura (`far_recapture_pending_at` + EF `process-far-reschedule-recapture`); feature doc `integracao-pagamento-pos-aceite.md`; **2026-07-30** Fase 2+3 KYC prestador em módulo `provider-kyc` (gate, wizard, BankPicker, `legal-rep-id`, identidade na RPC); sync adicional: e-mail ops `credenciamento@renovi.com.br` / `NETCRED_CREDENCIAMENTO_EMAIL`, sessões+janitor órfãos, MMD under review/rejected, FSM `REJECTED`→`DOCUMENTS_SUBMITTED`, paths em `design.md` apontando para `provider-kyc`; **2026-07-30** BankPicker: lista FEBRABAN via BrasilAPI `/banks/v1` + fallback JSON local e overrides de nome — deixa de ser subconjunto curado fixo).

Legenda: **OK** = documentado com evidência direta; **Parcial** = depende de inferência ou RPC/RLS não detalhados linha a linha; **N/A** = não aplicável como feature de produto.

## Por módulo (`src/features`)

| Módulo | Features identificadas | Documentadas | Evidência parcial | Não localizadas / pendentes |
|--------|------------------------|--------------|-------------------|-----------------------------|
| addresses | CRUD endereços; seleção no wizard; CEP; geografia | OK (`gestao-de-enderecos.md`) | — | Página `/dashboard/addresses` (placeholder) |
| auth | Sessão; guards; login/cadastro/recuperação; política de senha | OK (`autenticacao-e-sessao.md`) | Fluxos edge de e-mail Auth em produção | Painel admin no front |
| my-services | Shell compartilhado; slot por role; abas/filtros RPC; deep link (cliente); sheet compare/history; card pipeline prestador; highlight `PENDING_PAYMENT` (cliente: `attention` ou `error` se `FAILED_PERMANENT`; prestador: `attention`); CTA cliente `FAILED_PERMANENT` → “Ajustar pagamento” / `ManualPaymentDialog` | OK (`solicitacoes-do-cliente.md`, README §8–9) | — | Dropdowns só da página carregada; aba Disputas vazia |
| view-services | RPCs unificados; `ServiceModel`; detalhe por fase; escopo cliente/prestador no SQL; `my_proposal`/`chat` na lista prestador | OK (`visualizacao-de-servicos.md`) | pgTAP `view_services_rpcs_test.sql` | — |
| dynamic-form | Schema; steps; validação; demo DEV | OK (`motor-de-formularios.md`) | — | — |
| my-account | Conta cliente/prestador; portfólio; área; exclusão; embute cartões + histórico de pagamentos/recebimentos (`payments`; erros de cartão amigáveis pt-BR) | OK (`minha-conta.md` + cross-link payments) | Impacto legal de exclusão de conta | — |
| provider-jobs | Feed progressivo; dismiss; sort; geo feed; proposta via view-services/CNS | OK (`trabalhos-e-propostas.md`) | Gates dispatch (STOPPED/PAUSED) detalhados em matching-dispatch | — |
| provider-profile | Página pública; SEO; URL | OK (`pagina-publica.md`) | — | — |
| request-quote | Wizard 4/5 passos; IA automática passo 3; rascunho local; multipart Edge; reCAPTCHA; nsfwjs | OK (`pedir-orcamento.md`) | Validação server-side fina do form na Edge | P-01 redirect `/dashboard/client`; mismatch 10 MB front / 5 MB Edge fotos |
| chats + negotiation-proposals | Lista/thread; propostas FSM; slots; mensagem livre vs PENDING; aceite/cancelamento; countdown SLA (`expires_at` em `get_proposal_detail_*`); sheet compare/history em Meus Serviços | OK (`conversas-e-negociacao.md`, `comparar-orcamentos-meus-servicos.md`) | Mapa exaustivo de mensagens SQL por código/errcode nas RPCs de compare | — |
| service-reschedule | Elegibilidade: cliente e prestador em `PENDING_PAYMENT`/`CONFIRMED` (cliente com janela 48h; prestador sem); propor nova data/período conforme `duration_unit`/`duration_value`; validação `_cns_validate_reschedule_slot`; snapshot com duração; cópias UI; lembrete dispensável no dialog “Propor nova data”; mensagem SYSTEM ao solicitar (observação opcional com prefixo `Observação:`); integração pagamento pós-aceite (perto ≤15d / longe far-recapture) | Parcial (`propor-nova-data.md` + `integracao-pagamento-pos-aceite.md` + README) | Ciclo completo de estados (request/ajuste/aceite/cancel/expire/supersede) | — |
| payments | Checkout/T-2/KYC backend; `charge_amount` = gross-up NetCred; ClearSale sessão server-side + fail-closed em prod (cron sem session não cobra); token↔platform company (mismatch exige re-tokenizar; prestador só no payout); `PROFILE_INCOMPLETE` (CPF+telefone) no aceite; disclosure de recálculo de taxas na cobrança; KYC `ACTIVE` exige company+bank e **sem ACTIVE não há cobrança**; manual charge reconcilia ref. anterior; webhook assinatura inválida terminal + `paid_amount` server-authoritative; tokenização → `CARD_REJECTED` opaco + rate limit perfil; histórico/reembolso: gateway-first (`prepare` → NetCred → `commit`); faixa ToS pelo `payment_service_execution_at` vigente (`refund_anchor_execution_at` só auditoria); `REFUND_REQUESTED`+`SUBMITTED` após ACK; confirmação `REFUNDED` via webhook/reconcile; `payment_schedules_audit` no README | OK (`checkout-e-cobranca.md`, `historico-e-reembolso.md`, README §2) | Matriz completa de faixas de multa/cancelamento ToS (detalhe em `docs/payment-system/`); catálogo exaustivo de *todos* os códigos de pagamento→mensagem na doc de negócio (códigos `RISK_ANALYSIS_*` / `CARD_REJECTED` / `PROFILE_INCOMPLETE` já documentados) | — |
| provider-kyc | Gate do shell até `ACTIVE`; allowlist `/dashboard/conta*`; nav só Minha conta; UIs por status; polling 5s/30s; **wizard Fase 3** (entity→identity→bank→documents→review; BankPicker FEBRABAN via BrasilAPI + fallback local; upload Option A + janitor órfãos; `legal-rep-id`; identidade `pf`/`pj` na RPC/`provider_profiles_private`; e-mail ops `credenciamento@renovi.com.br`; MMD under review/rejected; FSM `REJECTED`→`DOCUMENTS_SUBMITTED`) | OK (`gate-e-acesso-operacional.md`, `formulario-credenciamento-wizard.md`, README) | — | — |

## Módulos fora de `src/features` (documentados em `modulos/`)

| Módulo | Escopo | Documento |
|--------|--------|-----------|
| dashboard-shell | `DashboardLayout`, menu, `DashboardFakePage`, rotas placeholder do dashboard; integração `ProviderKycGate` | `modulos/dashboard-shell/` |
| app-home | Rota index `/`, componente `App` | `modulos/app-home/` |
| message-dispatcher | Notificações multicanal (backend); FSM, quotas, horário silencioso, checkout, reconciliação | `modulos/message-dispatcher/` |
| matching-dispatch | Matching progressivo: lotes, cron, visibilidade, gates, ratings (backend) | `modulos/matching-dispatch/` |

## Contagens

| Métrica | Valor |
|---------|-------|
| Pastas em `src/features` (módulos de topo) | 15+ |
| Módulos adicionais documentados (shell + home + backend) | 3 |
| **Total módulos no índice** `modulos/README.md` | **16** (inclui `service-reschedule` parcial; `payments` + `provider-kyc`) |
| READMEs de módulo em `docs/business/modulos/` | 16 (+ nota em `client-budgets/`) |
| Arquivos de feature em `modulos/*/features/` | 15+ |
| Rotas placeholder identificadas | ≥6 |
| Cobertura documental (critério do índice) | **100%** dos módulos do índice; `service-reschedule` com feature parcial |

## Features globais fora de `src/features`

| Item | Status |
|------|--------|
| PWA / Service worker (`src/sw.ts`) | Não documentado em profundidade |
| App nativo Capacitor (Android) | **Parcial** — shell + persistência Preferences documentados abaixo; `device-beacon` / `push-permission` só na rastreabilidade; sem módulo em `modulos/` |
| Observabilidade (Sentry) | Mencionado na rastreabilidade |
| Analytics (`useAnalytics`) | Mencionado pontualmente em fluxos críticos |
| Message Dispatcher (backend) | **Parcial** — README do módulo + feature quiet hours documentados; features de quota, checkout, reconciliação e engagement cobertas na visão geral mas sem feature doc dedicada |

### App nativo Capacitor (evidência verificada)

| Comportamento | Onde |
|---------------|------|
| Inicialização no boot da SPA | `src/main.tsx` → `initCapacitorPlugins()` |
| SystemBars estilo escuro em plataforma nativa | `initCapacitorPlugins.ts` + `capacitor.config.ts` (`insetsHandling: css`, `style: DARK`) — API de `@capacitor/core`, não `@capacitor/status-bar` |
| Splash exibido no launch e ocultado pela app (`launchAutoHide: false`) | `SplashScreen.hide()` após init |
| Safe area superior no layout global | `src/index.css` (`--safe-area-inset-top`) |
| Teclado virtual: variável CSS `--keyboard-height` no `html` | listeners `keyboardWillShow` / `keyboardWillHide` |
| Android: botão voltar navega `history.back()` ou encerra app | listener `App.backButton` |
| Ciclo de vida: `document.documentElement.dataset.appActive` | listener `App.appStateChange` |
| Persistência cliente (Preferences) | **OK (transversal)** — ver tabela abaixo; documentado em auth, request-quote, rastreabilidade |
| Haptics | Pacote em `package.json`; **sem uso** em `src/` |

### Persistência em Capacitor Preferences (evidência verificada)

| Chave lógica | Consumidor | Documentado em |
|--------------|------------|----------------|
| `sb-{ref}-auth-token` | Supabase Auth (`createSupabaseAuthStorage`) | `auth` — autenticacao-e-sessao |
| `orbit_persist_session` | Manter conectado | `auth` — autenticacao-e-sessao |
| `orbit.cache.persist.v1:*` | `cachePersist*` (`src/lib/cache.ts`) | rastreabilidade |
| `renovi_request_quote_draft` | Rascunho do wizard | `request-quote` — pedir-orcamento |
| `orbit_device_beacon_last_sync_v1` | `device-beacon` / `syncSchedule.ts` | rastreabilidade (**sem** `modulos/device-beacon/`) |
| `orbit_push_permission_prompt_dismissed_at` | `push-permission` / cooldown do dialog | rastreabilidade (**sem** `modulos/push-permission/`) |

| Comportamento transversal | Onde |
|---------------------------|------|
| Web / E2E: prefixo `CapacitorStorage.` no `localStorage` | `PREFERENCES_WEB_KEY_PREFIX`, `e2e/fixtures/auth.fixture.ts` |

## Próximas expansões sugeridas (fora do escopo mínimo cumprido)

- Documento dedicado a **RLS por tabela** para auditoria de segurança.
- Documento de **operacionalização** (cron, jobs `expire_stale_provider_proposals`).
- Documento de **admin** caso rotas sejam adicionadas.
