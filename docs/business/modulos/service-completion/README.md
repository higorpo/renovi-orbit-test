# Conclusão de serviço e enrichment (`service-completion`)

Módulo de produto que cobre (1) **prontidão de publicação** do pedido (checklist de conclusão gerado antes do matching) e (2) **conclusão pós-contrato** (evidências, EXECUTED, confirmação+avaliação, auto-complete).

UI embutida no detalhe/lista via [view-services](../view-services/README.md) (só Public API). Backend: RPCs `service_completion_*` / `enrichment_*` + Edge `generate-completion-checklist` / `record-service-completion-declaration` ([ADR-0004](../../../service-completion/adr/0004-completion-rpcs-outside-payments.md), [ADR-0005](../../../service-completion/adr/0005-execution-declaration-audit-trail.md)).

Detalhe: [features/conclusao-e-enrichment.md](./features/conclusao-e-enrichment.md).

---

## 1. Leitura para negócio

- **Para que serve:** após criar/republicar um pedido, materializa um **checklist de conclusão** imutável; só então o matching pode começar. Depois do pagamento (`CONFIRMED`), o prestador abre **“Marcar serviço como concluído”** (sheet/dialog com checklist + evidências) e marca **EXECUTED**; se não marcar a tempo, o sistema **auto-marca EXECUTED** sem checklist (~24h após fim do dia BRT da data agendada). O cliente abre **“Avaliar serviço”** em `EXECUTED` (2 etapas: revisão + declaração → avaliar; **3 etapas** no prompt global: intro → revisão + declaração → avaliar) ou o sistema **auto-completa** EXECUTED→COMPLETED ~24h após `executed_at` (janela distinta); pós auto-complete (`COMPLETED` + `completed_by=system`, capability `canSubmitOptionalRating`) o mesmo CTA abre **só a etapa de notas** (sem revisão/checkbox/disputa). Clientes autenticados também podem ver um **prompt de avaliação pendente** no app open enquanto o contrato está `EXECUTED` dentro da grace.
- **Quem usa:** cliente e prestador no detalhe do serviço (seção Serviço contratado); prestador também no card Meus Serviços (`CONFIRMED` + past → “Concluir serviço”); cliente também no card Meus Serviços (`EXECUTED` → “Avaliar serviço”; fase `completed` + `COMPLETED` sem rating → “Avaliar serviço” com `ratingOnly`); cliente no shell global (`PendingEvaluationPromptHost` no `RootLayout`); sistema (cron enrichment + auto-mark EXECUTED + auto-complete).
- **Valor:** pedido só entra no feed após READY; conclusão com evidência congelada (também no auto-mark sintético) e rating; writers fora do domínio de pagamentos.
- **Riscos de suporte:** pedido `OPEN` ainda “em processamento” **não** aparece no feed; disputa no app é **stub** só em `EXECUTED` (banner título “Abrir disputa”, botão **“Falar com o suporte”**; descrição sobre correção/devolução; URL de suporte ou toast “Em breve”) — sem FSM de disputa; após `COMPLETED` o stub não aparece.

---

## 2. Visão geral funcional

| Aspecto | Detalhe |
|---------|---------|
| Feature front | `src/features/service-completion/` |
| Superfícies UI | CTAs na seção contratada → sheet (mobile) / dialog (desktop); wizards embutidos; **prompt global** de avaliação pendente (`PendingEvaluationPromptHost` no `RootLayout`); stub de disputa **somente** no wizard Avaliar serviço em `EXECUTED` (`ClientConfirmRatingWizard` / `shouldShowDisputeStub`; RPC `show_dispute_stub`) — **nunca** após `COMPLETED` nem inline no detalhe — título “Abrir disputa”, botão “Falar com o suporte”; no path manual (`canConfirmWithRating`), checkbox obrigatório de declaração no step de revisão; path opcional (`canSubmitOptionalRating`) = só rating (`ratingOnly`, sem contador “N de M”) |
| Public API (host) | **`ProviderMarkExecutedAction`** / **`ProviderMarkExecutedSheet`**, **`ClientEvaluateServiceAction`** / **`ClientEvaluateServiceSheet`**, **`PendingEvaluationPromptHost`**, **`CompletionSuccessStep`** (corpo genérico de sucesso; reuso futuro, ex. cliente) / **`ProviderExecutedSuccessStep`** (copy do prestador pós mark-executed) (+ wizards ainda exportados para composição embutida) |
| Host | `view-services` (`ServiceContractedSection`, `ServiceDetailPage`); `my-services` (sheets hospedados na página do card); `RootLayout` (prompt global) — **só** imports da Public API |
| Enrichment | Tabela `service_request_enrichments` (`PENDING` → `RUNNING` → `READY` \| `ABORTED`); enqueue em create/republish |
| Matching | Bootstrap **só** via `matching_bootstrap_dispatch_for_service_request` na TX de READY (trigger OPEN **DROP**ado) |
| Conclusão | RPCs `service_completion_mark_executed`, `service_completion_auto_mark_executed` (+ cron), `service_completion_upsert_execution_declaration`, `service_completion_confirm_with_rating`, `service_completion_auto_complete_executed` (+ cron); Edge `record-service-completion-declaration` |
| Removidos | `payment_mark_service_executed`, `payment_confirm_service_completed`, `payment_cron_auto_complete_*` |

---

## 3. Features do módulo

| Feature | Resumo | Documento |
|---------|--------|-----------|
| Enrichment + conclusão + disputa stub | Bootstrap READY; checklist; EXECUTED (manual ou auto-mark sem checklist); confirm+rating; auto-complete; stub | [features/conclusao-e-enrichment.md](./features/conclusao-e-enrichment.md) |

---

## 4. Perfis envolvidos

| Perfil | Papel |
|--------|--------|
| **Cliente** | Após EXECUTED: CTA **“Avaliar serviço”** (2 etapas: revisão + declaração + scores; alerta se auto-mark sem checklist; stub de disputa **só** no wizard e **só** em `EXECUTED`); **prompt global** se ainda na grace de auto-complete (último na fila de overlays); pós auto-complete: rating opcional (abre direto na etapa de notas; sem disputa) |
| **Prestador** | Em `CONFIRMED`: CTA **“Marcar serviço como concluído”** (checklist no sheet/dialog, não inline); após envio bem-sucedido, fase `success` na mesma sheet (`ProviderExecutedSuccessStep` → `CompletionSuccessStep`, chrome immersive; orientação ao cliente + **“Entendi”**); vê conclusão após COMPLETED |
| **Sistema** | Worker/cron enrichment; cron **auto-mark EXECUTED** (`service_completion_auto_mark_executed`, grace `auto_mark_executed_grace_hours`); cron **auto-complete** EXECUTED→COMPLETED (`auto_complete_grace_hours`, `completed_by=system`); sweeper READY-sem-dispatch (≤7 dias); janitor de uploads órfãos |

---

## 5. Principais fluxos

1. Create/republish → `OPEN` + enrichment `PENDING` → Edge `generate-completion-checklist` → READY → `matching_bootstrap_dispatch_for_service_request` (delay 5 min a partir daí).
2. Prestador `CONFIRMED` → CTA “Marcar serviço como concluído” → sheet/dialog com draft + upload evidência (RPC create session → `storage.from('completion-evidence').upload()` autenticado → RPC register; sem Edge) → fotos como thumbnails + lightbox → `service_completion_mark_executed` → `EXECUTED` (rejeita se antes de `scheduled_start_date` BRT: `SERVICE_NOT_YET_DUE`; envio após o fim da agenda **não** marca atraso). Após sucesso, `ProviderMarkExecutedSheet` mantém a sheet aberta: fase `checklist` (`ProviderExecutedWizard` + `chrome="standard"`) → fase `success` (`ProviderExecutedSuccessStep` → `CompletionSuccessStep` + `chrome="immersive"`; CTA **“Entendi”** fecha; sem toast de sucesso no hook).
3. Se o prestador **não** marca EXECUTED a tempo → cron auto-mark (`auto_mark_executed_grace_hours`, default **24**, após fim do dia BRT de `coalesce(scheduled_end_date, scheduled_start_date)` via `service_completion_scheduled_end_at`) → `CONFIRMED` → `EXECUTED` com evidência frozen sintética (`responses = {}`, `auto_executed_without_checklist = true`), `executed_at = now()`, audit system, MMD `SERVICE_EXECUTED`. **Não** remove o invariante EXECUTED↔frozen.
4. Cliente em `EXECUTED` (`canConfirmWithRating`) → CTA “Avaliar serviço” → etapa 1 revisão congelada (thumbnails) + stub de disputa (se elegível) + checkbox obrigatório de declaração (“Continuar para avaliação” só habilita com o aceite); se `auto_executed_without_checklist`, alerta em vez da lista vazia de critérios e copy do checkbox suavizada → etapa 2 scores → `service_completion_confirm_with_rating` → `COMPLETED`.
5. **Prompt de avaliação pendente (app open):** cliente autenticado; RPC leve `get_client_pending_evaluation_prompt` (1 item `EXECUTED` mais recente ainda dentro de `auto_complete_grace_hours`); abre **depois** de localização (prestador) e soft prompt de push; sheet com 3 passos (intro com resumo leve → review → rating). Fechar (X) = snooze ~4h do mesmo `service_request_id` (Preferences). Pós auto-complete (rating opcional) **não** entra neste prompt.
6. Sem confirmação manual → cron ~24h **após `executed_at`** (`auto_complete_grace_hours`) → `COMPLETED` pelo sistema (`completed_by=system`); se ainda sem rating (`canSubmitOptionalRating`), o mesmo CTA abre **direto na etapa de notas** (sem revisão de checklist, sem checkbox de declaração, sem “Continuar para avaliação”, sem botão voltar às evidências, sem stub de disputa; shell com `ratingOnly` oculta o contador “N de M”). **Distinto** do auto-mark CONFIRMED→EXECUTED.

---

## 6. Regras transversais

- Enrichment ≠ `service_request_status` ≠ `DISPATCH_*` ≠ status do contrato.
- Matching **não** inicia no insert `OPEN` (trigger bootstrap removida).
- Writers de EXECUTED/COMPLETED são `service_completion_*` (não `payment_*`).
- Disputa (stub): UI com título “Abrir disputa”, botão **“Falar com o suporte”** e **duas variantes de descrição** (`DisputeStubEntry` / prop `autoExecutedWithoutChecklist`): (1) **com checklist** — menciona “com base no checklist evidenciado acima” + não cumprimento → plataforma pode pedir correção ou devolver parcial/integralmente; (2) **auto-mark sem checklist** (`auto_executed_without_checklist` / `autoExecutedWithoutChecklist`) — **sem** menção ao checklist; fala de erro na execução / não cumprimento com o mesmo desfecho (correção ou devolução parcial/integral). Ação do botão: `VITE_SERVICE_COMPLETION_DISPUTE_SUPPORT_URL` / override `orbit.dispute_support_url`; sem URL → toast “Em breve” + analytics `service_completion_dispute_stub_opened`. Sem FSM in-app. Visível **somente** enquanto o CS está `EXECUTED` (capability `show_dispute_stub` / `shouldShowDisputeStub`) — **não** após `COMPLETED` (incl. pós auto-complete / rating opcional). Stub **somente** no wizard Avaliar serviço (`ClientConfirmRatingWizard`) — **nunca** inline no detalhe / `ServiceContractedSection`.
- Declaração de execução (cliente): no path manual (`canConfirmWithRating`), no step de revisão do wizard **Avaliar serviço**, abaixo do card de disputa (quando houver), checkbox obrigatório. Copy padrão: “Declaro que revisei as evidências acima e que o serviço foi executado corretamente, conforme o combinado.” Com `auto_executed_without_checklist`: “Declaro que o serviço foi executado corretamente, conforme o combinado.” — aceite jurídico / validade da execução antes das notas; só no step de review (não no de rating; **ausente** no path opcional pós auto-complete).
- **Auto-mark EXECUTED (sem checklist):** âncora = `service_completion_scheduled_end_at(start, end)` (fim do dia BRT de `coalesce(end, start)`) + `auto_mark_executed_grace_hours`; batch `service_completion_auto_mark_executed` / cron `service_completion_cron_auto_mark_executed` (`15 9,15,21,3 * * *`). **Distinto** do auto-complete EXECUTED→COMPLETED (`auto_complete_grace_hours` após `executed_at`).
- **Paths de evidência** no mark-executed **manual** devem estar registrados em `completion_evidence_upload_objects` sob sessão do CS/prestador; caso contrário → `EVIDENCE_PATH_NOT_REGISTERED`.
- No freeze, sessões de upload **`open`** do CS passam a **`committed`**.
- Upload de evidência (padrão KYC): `service_completion_create_upload_session` → upload autenticado no bucket `completion-evidence` sob prefixo da sessão (RLS) → `service_completion_register_upload_object`. **Sem** Edge de URL assinada.
- INSERT no storage `completion-evidence` exige sessão `open`, não expirada, CS `CONFIRMED`, contagem &lt; `max_files` (**só prestador**).
- SELECT no storage `completion-evidence`: prestador no próprio prefixo (draft + frozen); **cliente do CS** quando a evidência está `frozen` (`service_completion_evidence_storage_path_client_readable`) — permite `createSignedUrl` para thumbnails/lightbox em “Avaliar serviço”; admin de plataforma. Sem isso, a UI mostrava “Indisponível”.
- Evidência **frozen** e schema de enrichment **READY** são imutáveis no DB (triggers); CS `EXECUTED`/`COMPLETED` exige evidência frozen (constraint deferred); FK evidência→CS é **ON DELETE RESTRICT**.
- Leitura de produto: status/`ready` leves em `get_service` / `list_services` (gate do CTA prestador). Checklist/evidências/capabilities: RPC `get_service_completion_context` (não SELECT direto em `service_request_enrichments` por `authenticated`) — detalhe completo só para cliente do SR, prestador contratado ou admin; marketplace → payload limitado; no app, a RPC roda ao abrir o wizard de conclusão/avaliação (não ao montar o detalhe). Prompt global: RPC `get_client_pending_evaluation_prompt` (payload leve; contexto completo só após “Continuar para avaliação” no intro).
- **Fila de overlays no app open:** localização (prestador) → soft prompt de push → **prompt de avaliação pendente** (último; só role `client`).
- Constantes: `auto_mark_executed_grace_hours` / `auto_mark_executed_batch_size`; `auto_complete_grace_hours` / `auto_complete_batch_size` (default **100**, distinto de `enrichment_claim_batch_size`); sweeper READY-sem-dispatch limitado a enrichment materializado nos **últimos 7 dias**.
- Sessão de upload: `storage_bucket` = `completion-evidence`; `provider_id` deve coincidir com o CS.

---

## 7. Entidades

| Entidade | Função |
|----------|--------|
| `service_request_enrichments` | FSM de prontidão + schema imutável após READY; sem SELECT direto autenticado |
| `completion_checklist_templates` | Fallback se IA esgota tentativas |
| `contracted_service_completion_evidence` | Draft → frozen; `auto_executed_without_checklist` no auto-mark; FK CS RESTRICT |
| `completion_evidence_upload_sessions` | Sessões Option A (`open` → `committed` no mark-executed); bucket fixo |
| `completion_evidence_upload_objects` | Paths registrados; `referenced_in_responses` no freeze; claim do janitor |
| `contracted_services` | Status `CONFIRMED` → `EXECUTED` → `COMPLETED` |
| `service_ratings` | Rating no confirm manual; opcional pós auto-complete |
| `service_request_dispatches` | Criado no handoff READY |

---

## 8. Integrações

| Integração | Como |
|------------|------|
| **request-quote** / republish | Enfileiram enrichment `PENDING` (não bootstrap matching) |
| **matching-dispatch** | Bootstrap só após READY |
| **view-services** | Consome Public API: **`ProviderMarkExecutedAction`** / **`ClientEvaluateServiceAction`** na `ServiceContractedSection` |
| **my-services** | Cards da lista: highlight de follow-up pós-data-fim / `EXECUTED`; prestador `CONFIRMED` + past → **“Concluir serviço”** abre sheet no card (contexto ao abrir; gate `enrichmentReady`); cliente `EXECUTED` (fase `in_progress`) **ou** `COMPLETED` sem rating (fase `completed`, `clientRatingOverallScore == null` → `ratingOnly`) → **“Avaliar serviço”** abre `ClientEvaluateServiceSheet` hospedado na página (contexto RPC só ao abrir o wizard); demais follow-ups → “Ver detalhes” |
| **dynamic-form** | Blocos `completion_criterion` / `static_text` no checklist (fotos via galeria do service-completion) |
| **message-dispatcher** | Intents `SERVICE_EXECUTED`, `SERVICE_COMPLETED`, `SERVICE_AUTO_COMPLETED` |
| **push-permission** / **device-beacon** | Sequência de overlays no `RootLayout`: localização → push → prompt de avaliação (`appOpenOverlaySequence`) |
| **payments** | Domínio financeiro; **não** escreve EXECUTED/COMPLETED de produto |

---

## 9. Riscos e lacunas

| Risco / lacuna | Nota |
|----------------|------|
| Stub de disputa ≠ FSM | Sem abertura/resolução in-app; chargeback gateway permanece em payments (`is_disputed`) |
| Aba Disputas em Meus Serviços | Continua lista vazia no client (`view-services`) |
| Design técnico | `docs/service-completion/` — código + migrations `20260804*` são fonte da verdade |

---

## 10. Evidências

| Área | Caminhos |
|------|----------|
| App | `src/features/service-completion/` (`ProviderMarkExecutedAction`, `ProviderMarkExecutedSheet`, `CompletionFlowSheetDialog` (`chrome` standard/immersive), `CompletionSuccessStep`, `ProviderExecutedSuccessStep`, `ClientEvaluateServiceAction`, `ClientEvaluateServiceSheet`, `PendingEvaluationPromptHost`, `CompletionEvidenceGallery`, wizards) |
| Host UI | `ServiceContractedSection.tsx` (CTAs); `ServiceDetailPage.tsx`; `RootLayout.tsx` (prompt global) |
| Migrations | `supabase/migrations/20260804*` (enrichment, bootstrap DROP, RPCs, cron); `20260806180328_service_completion_auto_mark_executed.sql` (auto-mark CONFIRMED→EXECUTED); `20260806205555_get_client_pending_evaluation_prompt.sql` (índice parcial + RPC do prompt) |
| Edge | `generate-completion-checklist/` (enrichment only) |
| Upload evidência | RPCs `service_completion_create_upload_session` / `service_completion_register_upload_object` + storage autenticado `completion-evidence` (sem Edge); SELECT/`createSignedUrl` também para cliente do CS com evidência `frozen` |
| Storage policies | Migração `20260804100000_service_completion_evidence_storage.sql`; helpers `*_path_owned` / `*_path_client_readable` / `*_upload_allowed`; pgTAP `completion_evidence_storage_test.sql` |
| Janitor SQL | `service_completion_janitor_orphan_uploads` + cron `service_completion_cron_orphan_upload_janitor` |
| Design / ADR | `docs/service-completion/design.md`, ADR-0004 |
| Matching CONTEXT | decisão **#135** em `docs/matching-algorithm/CONTEXT.md` |
| Feature doc | [features/conclusao-e-enrichment.md](./features/conclusao-e-enrichment.md) |
