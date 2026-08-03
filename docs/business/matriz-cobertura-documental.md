# Matriz de cobertura documental

Última auditoria completa: **2026-08-02** (orquestração transversal + **Onda 6 recheck**: profundidade ≥20 em **32/32** features). **Recheck 2026-08-02 (hotfix índices):** contagens `## N.` recalibradas (números inflados corrigidos). Revisões anteriores acumuladas até 2026-07-31 (pagamentos, KYC, settlements, far-recapture, etc.) permanecem válidas.

Legenda: **OK** = documentado com evidência direta (README + feature); **Parcial** = depende de inferência, feature abaixo de 20 seções canônicas, ou gap operacional explícito; **N/A** = não aplicável como feature de produto.

**Profundidade:** feature docs com **≥20 seções numeradas (`## N.`)** = profundidade elevada. Recheck hotfix índices (2026-08-02): **32/32** features ≥20 — `trabalhos-e-propostas` (22), `pagina-inicial` (20).

## Por módulo (`src/features`)

| Módulo | Features identificadas | Documentadas | Profundidade ≥20 | Evidência parcial / lacunas | Status |
|--------|------------------------|--------------|------------------|-----------------------------|--------|
| addresses | CRUD endereços; seleção no wizard; CEP; geografia | OK (`gestao-de-enderecos.md`) | Sim (21) | Página `/dashboard/addresses` (placeholder — P-04) | **OK** |
| auth | Sessão; guards; login/cadastro/recuperação; política de senha | OK (`autenticacao-e-sessao.md`) | Sim (23) | Fluxos edge de e-mail Auth em produção; painel admin no front (P-02) | **OK** |
| my-services | Shell compartilhado; slot por role; abas/filtros RPC; deep link; sheet compare/history; card pipeline; highlight `PENDING_PAYMENT` / `FAILED_PERMANENT` | OK (`solicitacoes-do-cliente.md`, README §8–9) | Sim (21) | Dropdowns só da página carregada; aba Disputas vazia | **OK** |
| view-services | RPCs unificados; `ServiceModel`; detalhe real por fase (`ServiceDetailShell` em `/dashboard/services/:id`); escopo cliente/prestador no SQL | OK (`visualizacao-de-servicos.md`) | Sim (24) | pgTAP `view_services_rpcs_test.sql` | **OK** |
| dynamic-form | Schema; steps; validação; demo DEV | OK (`motor-de-formularios.md`) | Sim (21) | — | **OK** |
| my-account | Conta cliente/prestador; portfólio; área; exclusão; embute cartões + histórico | OK (`minha-conta.md` + cross-link payments) | Sim (21) | Impacto legal de exclusão de conta | **OK** |
| provider-jobs | Feed progressivo; dismiss; sort; geo feed; proposta via view-services/CNS | OK (`trabalhos-e-propostas.md`) | Sim (22) | Gates dispatch detalhados em matching-dispatch; legado `match_provider_jobs` (P-MD-04/05) | **OK** |
| provider-profile | Página pública; SEO; URL | OK (`pagina-publica.md`) | Sim (21) | — | **OK** |
| request-quote | Wizard 4/5 passos; IA automática; rascunho local; multipart Edge; reCAPTCHA; nsfwjs | OK (`pedir-orcamento.md`) | Sim (20) | **P-01** redirect `/dashboard/client`; mismatch 10 MB front / 5 MB Edge fotos | **OK** (com P-01 aberta) |
| chats + negotiation-proposals | Lista/thread; propostas FSM; slots; aceite; countdown SLA; sheet compare/history | OK (`conversas-e-negociacao.md`, `propostas-negociacao.md`, `comparar-orcamentos-meus-servicos.md`) | Sim (22–23) | Mapa exaustivo de mensagens SQL por código nas RPCs de compare | **OK** |
| service-reschedule | Elegibilidade; propor nova data; mensagem SYSTEM; integração pagamento pós-aceite; **ciclo FSM** (request/ajuste/aceite/cancel/expire/supersede) | OK (`propor-nova-data.md` + `integracao-pagamento-pos-aceite.md` + `ciclo-estados-reagendamento.md`) | Sim (23–25) | Residuais **P-SR-*** (templates MMD, erros UI, outcomes) — doc de ciclo **OK**; produto residual | **OK** |
| payments | Checkout/T-2/KYC; gross-up; ClearSale; histórico/reembolso; settlements; **reconciliação/voids** (`deferred_captured`) | OK (`checkout-e-cobranca.md`, `historico-e-reembolso.md`, `reconciliacao-e-voids.md`) | Sim (20) | Matriz completa faixas ToS; catálogo exaustivo códigos→UI; **PAY-DC** | **OK** |
| provider-earnings | Ganhos: liquidações `PENDING`/`PAID_OUT`/`DEBIT`; disclosure D+30 | OK (`ganhos-e-liquidacoes.md`) | Sim (20) | — | **OK** |
| provider-kyc | Gate até `ACTIVE`; wizard Fase 3; BankPicker FEBRABAN; upload Option A; e-mail ops | OK (`gate-e-acesso-operacional.md`, `formulario-credenciamento-wizard.md`) | Sim (20) | — | **OK** |
| provider-calendar | Agenda contratada lista/grade; RPC `list_provider_scheduled_services`; banner Meus Serviços; `/dashboard/services/calendar` | OK (`calendario-do-prestador.md`) | Sim (22) | **PC-02…05** produto; ~~PC-01~~ índices (fechado — mapa/`modulos/README`/glossário) | **OK** |
| device-beacon | Sync beacon FCM; geo operacional prestador; Preferences; purge 30d | OK (`rastreamento-dispositivo.md`) | Sim (22) | Sem Edge própria; regras de lote em matching-dispatch | **OK** |
| push-permission | Soft prompt + cooldown 7d; Capacitor/PWA via `@/lib/push` | OK (`prompt-e-cooldown.md`) | Sim (23) | — | **OK** |
| notifications | `recordPushClick` → RPC engagement (nativo) | OK (`engagement-push.md`) | Sim (22) | **N-01** clique web/SW não implementado | **OK** (com N-01) |

## Módulos fora de `src/features` (documentados em `modulos/`)

| Módulo | Escopo | Documento | Profundidade ≥20 | Status |
|--------|--------|-----------|------------------|--------|
| dashboard-shell | `DashboardLayout`, menu, `DashboardFakePage`, `ProviderKycGate` | `modulos/dashboard-shell/` + `placeholders-e-menu.md` | Sim (20) | **OK** |
| app-home | Rota index `/`, componente `App` | `modulos/app-home/` + `pagina-inicial.md` | Sim (20) | **OK** |
| message-dispatcher | Notificações multicanal; FSM; quotas; quiet hours; engagement | `modulos/message-dispatcher/` — features `pipeline-e-fsm`, `quotas-e-canais`, `horario-silencioso`, `engagement-push-click` | Sim (23×4) | **OK** (P-10 fechada; **P-08/P-09** abertas) |
| matching-dispatch | Matching progressivo: lotes, cron, visibilidade, gates | `modulos/matching-dispatch/` + `dispatch-e-visibilidade.md` | Sim (20) | **OK** (com **P-MD-04/05**) |

## Contagens honestas (2026-08-02 — hotfix índices)

| Métrica | Valor |
|---------|-------|
| Pastas em `src/features` (topo) | **19** |
| READMEs de módulo em `docs/business/modulos/` (incl. `client-budgets` descontinuado) | **23** |
| Módulos ativos com README (excl. `client-budgets`) | **22** |
| Arquivos de feature em `modulos/*/features/` | **32** |
| Features com profundidade **≥20** seções numeradas (`## N.`) | **32 / 32** |
| Features **&lt;20** seções | **0** |
| Linhas de módulo na tabela `src/features` com status **OK** | **17** |
| Linhas com status **Parcial** (profundidade) | **0** |
| Módulos fora de features: **OK** / **Parcial** | **4 OK** (shell, app-home, MMD, matching) / **0 Parcial** |
| Rotas placeholder identificadas | ≥4 (`/dashboard`, `/dashboard/addresses`, `/dashboard/settings`, `/dashboard/help`) — **não** inclui `/dashboard/services/:id` (real) nem `/dashboard/services/calendar` (real) nem `/dashboard/earnings` (real) |
| Cobertura documental (módulos com README+feature existentes) | **~100%** dos módulos inventariados com pasta em `modulos/`; **critério de profundidade ≥20:** **100%** das features (32/32) |
| Status agregado (OK vs Parcial nas linhas desta matriz) | **OK: 22** · **Parcial: 0** — lacunas de produto (P-01, P-MD-*, N-01, PAY-DC, PC-*, P-SR-*) **não** rebaixam o status documental quando o comportamento está documentado |

### App nativo Capacitor (evidência verificada)

| Comportamento | Onde | Doc |
|---------------|------|-----|
| Inicialização no boot da SPA | `src/main.tsx` → `initCapacitorPlugins()` | rastreabilidade |
| SystemBars / Splash / Keyboard / backButton / appState | `initCapacitorPlugins.ts`, `capacitor.config.ts` | rastreabilidade |
| Safe area | `src/index.css` | rastreabilidade |
| Persistência Preferences | auth, cache, draft, beacon, push-permission | módulos + rastreabilidade |
| device-beacon / push-permission / notifications | `src/features/{device-beacon,push-permission,notifications}/` | **OK** em `modulos/` (antes só rastreabilidade) |
| Haptics | Pacote em `package.json`; **sem uso** em `src/` | — |

### Persistência em Capacitor Preferences (evidência verificada)

| Chave lógica | Consumidor | Documentado em |
|--------------|------------|----------------|
| `sb-{ref}-auth-token` | Supabase Auth | `auth` |
| `orbit_persist_session` | Manter conectado | `auth` |
| `orbit.cache.persist.v1:*` | `cachePersist*` | rastreabilidade |
| `renovi_request_quote_draft` | Rascunho do wizard | `request-quote` |
| `orbit_device_beacon_last_sync_v1` | `device-beacon` / `syncSchedule.ts` | `device-beacon` |
| `orbit_push_permission_prompt_dismissed_at` | `push-permission` | `push-permission` |

| Comportamento transversal | Onde |
|---------------------------|------|
| Web / E2E: prefixo `CapacitorStorage.` no `localStorage` | `PREFERENCES_WEB_KEY_PREFIX`, `e2e/fixtures/auth.fixture.ts` |

## Features globais fora de `src/features`

| Item | Status |
|------|--------|
| PWA / Service worker (`src/sw.ts`) | Não documentado em profundidade; **N-01** (click push web) |
| App nativo Capacitor (Android) | **OK** nos módulos device-beacon / push-permission + shell Capacitor na rastreabilidade |
| Observabilidade (Sentry) | Mencionado na rastreabilidade |
| Analytics (`useAnalytics`) | Mencionado pontualmente; PC-05 calendário |
| Message Dispatcher (backend) | **OK** — quatro feature docs; P-08/P-09 operacionais |

## Próximas expansões sugeridas (fora do escopo mínimo cumprido)

- Documento dedicado a **RLS por tabela** para auditoria de segurança.
- Documento de **operacionalização** (cron, jobs `expire_stale_provider_proposals`).
- Documento de **admin** caso rotas sejam adicionadas.
- Fechar P-MD-04 (DROP RPC legado) e alinhar gate NetCred no feed vivo (P-MD-05).
- Runbook ops para **PAY-DC** (`deferred_captured`).
