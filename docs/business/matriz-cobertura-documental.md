# Matriz de cobertura documental

**Atualização 2026-08-12 (Ganhos — filtros chips):** `EarningsFilterTabs` (Todos/Previsto/Liquidado) volta a chips soltos; ledger (período + Cobranças/Depósitos) inalterado. Sem RPC/rota.

**Atualização 2026-08-12 (Ganhos — chrome/copy):** período no mesmo poço das abas (não mais chips soltos); captions **Valor combinado** / **Na sua conta**; ícones Banknote/Landmark em `bg-audience-soft text-audience`. Sem mudança de rota, query, range ou RPC.

**Atualização 2026-08-12 (Ganhos unificado):** Recebimentos saiu da nav; captura e liquidação na mesma página `/dashboard/settings/earnings` (ledger Cobranças / Depósitos; `?view=charges`; rota legado `receivables` redireciona). Sem RPC/migration nova. Docs settings / provider-earnings / payments / glossário / mapa / rastreabilidade.

**Atualização 2026-08-12 (Ganhos — abas + período):** ledger no padrão Tabs (`aria-label="Listas de ganhos"`; sem seta); período Este mês / 3 meses / 6 meses (`period` na URL) filtram totais e as duas listas; RPC `p_settling_from`/`p_settling_to` usada pela UI; captura filtra `received_at` na view.

**Atualização 2026-08-12:** hub Configurações `/dashboard/settings/*` (fase 1 shell); Ganhos hospedado em `/dashboard/settings/earnings`; menu sem Endereços/Ganhos; allowlist KYC `/dashboard/settings`; P-04 fechada. **Atualização 2026-08-12 (Perfil profissional UI):** Tabs **Pedidos** / **Vitrine** em `/dashboard/settings/professional-profile` (padrão Pagamentos; `SettingsConsequenceGroup` e capítulos “Como você atua” / “Como os clientes te veem” removidos); aba Pedidos: ofertados+área+hint; aba Vitrine: público+hint+portfólio; skeleton = barra de abas + cards Pedidos; sem mudança de API — docs settings/glossário/rastreabilidade.

Última auditoria completa: **2026-08-02** (orquestração transversal + **Onda 6 recheck**: profundidade ≥20 em **32/32** features). **Recheck 2026-08-02 (hotfix índices):** contagens `## N.` recalibradas (números inflados corrigidos). **Atualização 2026-08-04:** módulo **service-completion** + alinhamento matching READY-handoff / view-services / glossário. **Atualização 2026-08-05:** endurecimento SQL de conclusão (evidência registrada, contexto full vs marketplace, imutabilidade, batches, janitor SQL de órfãos no padrão KYC — sem Edge `completion-evidence-orphan-janitor`) refletido em docs de negócio. **Atualização 2026-08-05 (upload evidência):** remoção da Edge `issue-completion-evidence-upload-url` — upload Option A como KYC (RPC create session → storage autenticado → register). **Atualização 2026-08-05 (UX conclusão):** CTAs na seção Serviço contratado → sheet/dialog (não checklist inline); stepper cliente 2 etapas; thumbnails + lightbox de evidência. **Atualização 2026-08-06:** lazy load de `get_service_completion_context` (detalhe/banner/CTA gate via campos leves de `get_service`; RPC só no wizard/CTA elegível). **Atualização 2026-08-06 (cards Meus Serviços):** highlight de follow-up de conclusão pós-data-fim / `EXECUTED` na lista (`my-services`); prestador `CONFIRMED` + past → CTA “Concluir serviço” no card (sheet/wizard; gate `enrichmentReady`); demais ramos → “Ver detalhes”. **Atualização 2026-08-06 (storage SELECT cliente):** política `storage_objects_completion_evidence_select` permite `createSignedUrl` ao cliente do CS com evidência `frozen` (helper `*_path_client_readable`) — corrige fotos “Indisponível” em “Avaliar serviço”; INSERT continua só prestador. **Atualização 2026-08-06 (auto-mark EXECUTED):** batch/cron `service_completion_auto_mark_executed` promove CONFIRMED→EXECUTED sem checklist após grace na agenda; UI cliente alerta `auto_executed_without_checklist`; distinto do auto-complete EXECUTED→COMPLETED. **Atualização 2026-08-06 (ratings na UI):** leitura real via RPCs (`get_provider_rating_summaries`, `list_public_provider_ratings`, campos em `get_public_provider_by_slug` / `project_service_row`); mocks removidos do compare e do card concluído do prestador; perfil público com média + lista cursor. **Atualização 2026-08-06 (prompt de avaliação pendente):** RPC `get_client_pending_evaluation_prompt` + host no `RootLayout`; sheet 3 passos; fila localização → push → avaliação; glossário + service-completion / push-permission. **Atualização 2026-08-07 (Declaração de execução):** tabela `service_completion_execution_declarations` + Edge `record-service-completion-declaration` + gate `EXECUTION_DECLARATION_REQUIRED` no confirm manual; auto-complete sem declaração; sem SELECT autenticado — glossário / mapa / rastreabilidade / perfis. **Atualização 2026-08-10:** lembretes periódicos de credenciamento incompleto NetCred (cron 11:00 UTC + MMD `PROVIDER_ONBOARDING_INCOMPLETE_REMINDER`; feature `lembretes-credenciamento-incompleto.md`). **Atualização 2026-08-10 (cards Meus Serviços):** follow-up de conclusão (`EXECUTED` / prestador `CONFIRMED`+past) **vence unread** no highlight e CTA — regra 16 / Anexo D em `solicitacoes-do-cliente.md`. **Atualização 2026-08-10 (Jornada do pedido):** RPC `get_client_service_journey` + card cliente-only **Acompanhe seu pedido** no detalhe (`view-services`); glossário / visualizacao-de-servicos / rastreabilidade / mapa. **Atualização 2026-08-11 (detalhe view-services):** header unificado (`ServiceDetailAttributeCards` + `ServiceDetailActionsBar`); CTAs contratados saem de `ServiceContractedSection`. **Atualização 2026-08-11 (card Serviço contratado):** redesign cliente rico (avatar/rating/`final_amount`/CTA perfil/`PaymentDisputeStatus`) vs prestador resumo; ratings via `get_provider_rating_summaries`; **sem** `ProviderSettlementStatus` / selo verificado; migration `20260804460000_project_service_row_enrichment_fields.sql`.

Legenda: **OK** = documentado com evidência direta (README + feature); **Parcial** = depende de inferência, feature abaixo de 20 seções canônicas, ou gap operacional explícito; **N/A** = não aplicável como feature de produto.

**Profundidade:** feature docs com **≥20 seções numeradas (`## N.`)** = profundidade elevada. Recheck hotfix índices (2026-08-02): **32/32** features ≥20 — `trabalhos-e-propostas` (22), `pagina-inicial` (20). **2026-08-10:** +1 feature (`lembretes-credenciamento-incompleto`) → **34/34** no inventário ativo (incl. service-completion).

## Por módulo (`src/features`)

| Módulo | Features identificadas | Documentadas | Profundidade ≥20 | Evidência parcial / lacunas | Status |
|--------|------------------------|--------------|------------------|-----------------------------|--------|
| addresses | CRUD endereços; seleção no wizard; CEP; geografia | OK (`gestao-de-enderecos.md`) | Sim (21) | Gestão real em `/dashboard/settings/addresses` (+ wizard); rota menu `/dashboard/addresses` removida | **OK** |
| auth | Sessão; guards; login/cadastro/recuperação; política de senha | OK (`autenticacao-e-sessao.md`) | Sim (23) | Fluxos edge de e-mail Auth em produção; painel admin no front (P-02) | **OK** |
| my-services | Shell compartilhado; slot por role; abas/filtros RPC; deep link; sheet compare/history; card pipeline; highlight `PENDING_PAYMENT` / `FAILED_PERMANENT`; follow-up conclusão pós-data-fim / `EXECUTED` (**vence unread** nos ramos críticos); prestador “Concluir serviço” no card; nota real no card `completed` (`clientRatingOverallScore`); aba Disputas (`list_phase=dispute` / `IN_DISPUTE`) | OK (`solicitacoes-do-cliente.md`, README §8–9) | Sim (23) | Dropdowns só da página carregada | **OK** |
| view-services | RPCs unificados; `ServiceModel`; detalhe real por fase (`ServiceDetailShell`); **Jornada do pedido** (`get_client_service_journey` + `ServiceJourneyCard`, cliente-only); card **Serviço contratado** (cliente rico / prestador resumo; rating via `get_provider_rating_summaries`); conclusão via **service-completion** (CTAs → sheet/dialog); `list_phase=dispute` | OK (`visualizacao-de-servicos.md`) | Sim (24) | pgTAP `view_services_rpcs_test.sql`, `get_client_service_journey_test.sql` | **OK** |
| dynamic-form | Schema; steps; validação; demo DEV | OK (`motor-de-formularios.md`) | Sim (21) | — | **OK** |
| settings | Hub settings `/dashboard/settings/*`; Perfil profissional em Tabs Pedidos (ofertados+área) / Vitrine (público+portfólio); portfólio; área; exclusão; seção Jurídico (`legal`); embute cartões + histórico cliente; host Ganhos unificado (Cobranças + Depósitos) | OK (`configuracoes.md` + cross-link payments/earnings) | Sim (21) | Impacto legal de exclusão de conta; deep_link SQL legado `/dashboard/conta` | **OK** |
| provider-jobs | Feed progressivo; dismiss; sort; geo feed; proposta via view-services/CNS | OK (`trabalhos-e-propostas.md`) | Sim (22) | Gates dispatch detalhados em matching-dispatch; legado `match_provider_jobs` (P-MD-04/05) | **OK** |
| provider-profile | Página pública; SEO; URL; média/contagem + lista de avaliações (cursor) | OK (`pagina-publica.md`) | Sim (23) | Campo a campo completo da RPC em `restricted` | **OK** |
| request-quote | Wizard 4/5 passos; IA automática; rascunho local; multipart Edge; reCAPTCHA; nsfwjs; enqueue enrichment | OK (`pedir-orcamento.md`) | Sim (20) | **P-01** redirect `/dashboard/client`; mismatch 10 MB front / 5 MB Edge fotos | **OK** (com P-01 aberta) |
| service-completion | Enrichment READY-handoff; checklist; upload evidência Option A; mark EXECUTED; auto-mark EXECUTED sem checklist; **Declaração de execução** (checkbox + Edge/RPC; gate `EXECUTION_DECLARATION_REQUIRED`; só path manual); confirm+rating (CTA sheet 2 etapas; prompt global 3 etapas); auto-complete ~24h após `executed_at` (**sem** declaração); **Disputa de serviço** (`IN_DISPUTE`; open/admin resolve); galeria thumbnails+lightbox (`createSignedUrl` cliente com evidência frozen); contexto full vs marketplace; janitor SQL órfãos; RPC `get_client_pending_evaluation_prompt` | OK (`conclusao-e-enrichment.md`) | Sim (20) | Painel admin / reopen / cancel from dispute fora do MVP | **OK** |
| chats + negotiation-proposals | Lista/thread; propostas FSM; slots; aceite; countdown SLA; sheet compare/history com reputação real (`get_provider_rating_summaries`) | OK (`conversas-e-negociacao.md`, `propostas-negociacao.md`, `comparar-orcamentos-meus-servicos.md`) | Sim (22–23) | Mapa exaustivo de mensagens SQL por código nas RPCs de compare | **OK** |
| service-reschedule | Elegibilidade; propor nova data; mensagem SYSTEM; integração pagamento pós-aceite; **ciclo FSM** (request/ajuste/aceite/cancel/expire/supersede) | OK (`propor-nova-data.md` + `integracao-pagamento-pos-aceite.md` + `ciclo-estados-reagendamento.md`) | Sim (23–25) | Residuais **P-SR-*** (templates MMD, erros UI, outcomes) — doc de ciclo **OK**; produto residual | **OK** |
| payments | Checkout/T-2/KYC; gross-up; **mín. parcela R$ 150** (`min_installment_value`); ClearSale; histórico/reembolso; settlements; **reconciliação/voids** (`deferred_captured`) | OK (`checkout-e-cobranca.md`, `historico-e-reembolso.md`, `reconciliacao-e-voids.md`) | Sim (20) | Matriz completa faixas ToS; catálogo exaustivo códigos→UI; **PAY-DC** | **OK** |
| provider-earnings | Ganhos unificado: período (Este mês / 3 meses / 6 meses) + ledger Cobranças (soma captura no período) + Depósitos (contagem CREDIT `PENDING`/`PAID_OUT` no período); disclosure D+30; rota `/dashboard/settings/earnings` (sem menu top-level; sem item Recebimentos na nav) | OK (`ganhos-e-liquidacoes.md`) | Sim (20) | — | **OK** |
| provider-kyc | Gate de **conteúdo** até `ACTIVE` + **ocultação do chrome** de nav; wizard Fase 3; BankPicker FEBRABAN; upload Option A; e-mail ops; **lembretes MMD** (`PENDING_DOCUMENTS`/`REJECTED`) | OK (`gate-e-acesso-operacional.md`, `formulario-credenciamento-wizard.md`, `lembretes-credenciamento-incompleto.md`) | Sim (20) | — | **OK** |
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
| matching-dispatch | Matching progressivo: lotes, cron, visibilidade, gates; bootstrap READY-handoff; repair ≤7 dias | `modulos/matching-dispatch/` + `dispatch-e-visibilidade.md` | Sim (20) | **OK** (com **P-MD-04/05**; CONTEXT #135) |

## Contagens honestas (2026-08-02 — hotfix índices)

| Métrica | Valor |
|---------|-------|
| Pastas em `src/features` (topo) | **20** (+ `service-completion`) |
| READMEs de módulo em `docs/business/modulos/` (incl. `client-budgets` descontinuado) | **24** |
| Módulos ativos com README (excl. `client-budgets`) | **23** |
| Arquivos de feature em `modulos/*/features/` | **33** |
| Features com profundidade **≥20** seções numeradas (`## N.`) | **33 / 33** |
| Features **&lt;20** seções | **0** |
| Linhas de módulo na tabela `src/features` com status **OK** | **18** |
| Linhas com status **Parcial** (profundidade) | **0** |
| Módulos fora de features: **OK** / **Parcial** | **4 OK** (shell, app-home, MMD, matching) / **0 Parcial** |
| Rotas placeholder identificadas | ≥1 (`/dashboard`) — **não** inclui hub `/dashboard/settings/*` (real), `/dashboard/services/:id`, `/dashboard/services/calendar`. Removidas: `/dashboard/addresses`, `/dashboard/earnings`, `/dashboard/conta`, `/dashboard/help`, fake `/dashboard/settings` |
| Cobertura documental (módulos com README+feature existentes) | **~100%** dos módulos inventariados com pasta em `modulos/`; **critério de profundidade ≥20:** **100%** das features (33/33) |
| Status agregado (OK vs Parcial nas linhas desta matriz) | **OK: 23** · **Parcial: 0** — lacunas de produto (P-01, P-MD-*, N-01, PAY-DC, PC-*, P-SR-*, SC-*) **não** rebaixam o status documental quando o comportamento está documentado |

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
| `prestway_request_quote_draft` | Rascunho do wizard | `request-quote` |
| `orbit_device_beacon_last_sync_v1` | `device-beacon` / `syncSchedule.ts` | `device-beacon` |
| `orbit_push_permission_prompt_dismissed_at` | `push-permission` | `push-permission` |
| `orbit_pending_evaluation_prompt_snooze` | `service-completion` | `service-completion` |

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
