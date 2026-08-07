# Conclusão de serviço, enrichment e disputa stub

Documentação de negócio do módulo **service-completion**. Host de UI: [visualizacao-de-servicos](../../view-services/features/visualizacao-de-servicos.md). Matching: [dispatch-e-visibilidade](../../matching-dispatch/features/dispatch-e-visibilidade.md).

---

## 1. Resumo executivo

Pedido `OPEN` enfileira **enrichment** (`PENDING`). Enquanto `PENDING`/`RUNNING`, o pedido **não** entra no feed. Em `READY`, o matching faz bootstrap (delay de 5 min a partir daí). Pós-contrato, na seção **Serviço contratado** do detalhe: o prestador usa o botão **“Marcar serviço como concluído”** (abre sheet/dialog com o checklist — **não** fica inline na página); após envio bem-sucedido do checklist, a sheet **permanece aberta** no step de sucesso (`ProviderExecutedSuccessStep`) com orientação para falar com o cliente e CTA **“Entendi”** (sem toast de sucesso no hook); se não marcar a tempo, o sistema **auto-marca EXECUTED** sem checklist (~24h após fim do dia BRT da data agendada). O cliente usa **“Avaliar serviço”** em `EXECUTED` (sheet/dialog em 2 etapas: revisar evidências + declarar execução → avaliar); após envio bem-sucedido (confirm-with-rating ou rating opcional), a sheet **permanece aberta** no step de sucesso (`ClientEvaluateSuccessStep` → `CompletionSuccessStep`, `chrome="immersive"`; CTA **“Entendi”**; sem toast de sucesso em `useClientConfirmRating`). No **app open**, clientes com `EXECUTED` ainda na grace de auto-complete podem ver um **prompt de avaliação pendente** (fases `intro` → `wizard` → `success`), sempre **depois** de localização e soft prompt de push. Sem confirmação, auto-complete EXECUTED→COMPLETED ~24h após `executed_at` (janela distinta); pós auto-complete o CTA de rating opcional abre **direto nas notas** (sem revisão, declaração nem disputa) e, após envio, o mesmo step de sucesso com copy `optional`. Disputa no app é stub **somente** no wizard Avaliar serviço e **somente** em `EXECUTED` (banner título “Abrir disputa”, botão “Falar com o suporte”; descrição sobre correção/devolução; suporte ou “Em breve”) — **nunca** após `COMPLETED` nem inline no detalhe.

---

## 2. Objetivo de negócio

- Garantir checklist de conclusão **antes** de expor o pedido a prestadores.
- Congelar evidências na execução e exigir rating no caminho manual.
- Separar writers de conclusão do domínio de pagamentos (ADR-0004).

---

## 3. Localização na plataforma

| Superfície | Path / entry |
|------------|----------------|
| Sem rota própria | Embutido em `/dashboard/services/:id` e cards (`view-services`); prompt global no `RootLayout` |
| Feature | `src/features/service-completion/` (Public API em `index.ts`) |
| CTAs no host | `ProviderMarkExecutedAction` / `ClientEvaluateServiceAction` na `ServiceContractedSection` (ao lado de cancelar/reagendar) |
| Prompt global | `PendingEvaluationPromptHost` no `RootLayout` (role `client`; após fila localização + push) |
| Fluxo modal | `CompletionFlowSheetDialog`: bottom sheet (mobile) ou dialog (desktop); `chrome="standard"` (header título/descrição + close) ou `chrome="immersive"` (título sr-only + X/handle flutuantes para sucesso full-bleed); wizards embutidos (`presentation="embedded"`); variante `prompt` com intro; sheet do cliente orquestra fases `intro` \| `wizard` \| `success` |
| Edge | `generate-completion-checklist`; `record-service-completion-declaration` (declaração: IP + device + geo por IP via `ipwho.is` free **1.000 req/dia** — upgrade pago ao ultrapassar; 429 → `ip_geo` null sem bloquear) |
| RPCs produto | `get_service_completion_context`, `get_client_pending_evaluation_prompt`, `service_completion_mark_executed`, `service_completion_upsert_execution_declaration`, `service_completion_confirm_with_rating`, draft/upload (`create_upload_session` / `register_upload_object`), ratings |

---

## 4. Perfis envolvidos

| Quem | Pode | Não pode |
|------|------|----------|
| **Cliente** (dono do SR) | Contexto completo via RPC; revisar evidência frozen; **SELECT storage / `createSignedUrl`** em paths do CS quando evidência está `frozen` (thumbnails/lightbox em “Avaliar serviço”); **declaração de execução** (checkbox → Edge/RPC; hard gate antes de avaliar); confirm+rating em `EXECUTED`; rating opcional pós auto-complete; stub disputa **só** em `EXECUTED`; **prompt global** se `EXECUTED` na grace | Marcar EXECUTED; stub disputa após `COMPLETED`; SELECT direto em `service_request_enrichments` ou em `service_completion_execution_declarations`; SELECT storage de evidência ainda em `draft` |
| **Prestador contratado** | Contexto completo; draft + mark EXECUTED em `CONFIRMED`; upload sob sessão própria | Confirmar COMPLETED manual; SELECT direto em enrichments |
| **Prestador só-marketplace** (visibilidade no feed, sem contrato) | Payload **limitado** no contexto (status/`ready`; sem checklist nem `client_id`/`provider_id`) | Checklist, evidências, mutações de conclusão |
| **Admin** (plataforma) | Contexto completo (mesmo sem ser participante) | Mutações de produto via UI do app (sem painel) |
| **Sistema** | Enrichment READY + bootstrap; auto-mark EXECUTED (sem checklist); auto-complete EXECUTED→COMPLETED; janitor órfãos; repair ≤7 dias | — |

---

## 5. Fluxo funcional principal

```mermaid
flowchart TD
  A[Create / republish OPEN] --> B[Enrichment PENDING]
  B --> C{PENDING / RUNNING}
  C -->|fora do feed| C2[Aguarda READY]
  C --> E[Edge generate-completion-checklist]
  E --> F[READY + matching_bootstrap]
  F --> G[Delay 5 min → lotes matching]
  H[CS CONFIRMED] --> I[CTA Marcar como concluído]
  I --> I2[Sheet/dialog: checklist + evidências]
  I2 --> J[mark_executed → EXECUTED]
  H -->|Grace pós fim agenda BRT| J2[auto_mark EXECUTED sem checklist]
  J --> K{Cliente confirma?}
  J2 --> K
  K -->|CTA Avaliar serviço (EXECUTED)| K2[Sheet: 1 revisão + declaração · 2 avaliação]
  K -->|Prompt global app open| K3[Sheet: intro · review · rating]
  K2 -->|scores| L[COMPLETED + rating]
  K3 -->|scores| L
  L --> L2[Fase success na sheet]
  K -->|Não ~24h após executed_at| M[auto_complete COMPLETED system]
  M --> N[Rating opcional: só etapa de notas]
  N -->|scores| L2
```

---

## 6. Fluxos alternativos e exceções

| Cenário | Comportamento |
|---------|----------------|
| Enrichment `ABORTED` / cancel | Banner de interrupção; sem bootstrap |
| IA esgota tentativas | Fallback template → ainda pode chegar a READY |
| READY sem dispatch | Sweeper repara via `matching_bootstrap_dispatch_for_service_request` só se `materialized_at` nos **últimos 7 dias** |
| Path de evidência não registrado | `service_completion_mark_executed` → `EVIDENCE_PATH_NOT_REGISTERED` |
| Sessão upload expirada / não open / CS ≠ CONFIRMED / ≥ max_files | Storage INSERT negado; register object também guarda `max_files` / sessão open |
| Mark EXECUTED antes do início | `SERVICE_NOT_YET_DUE` se hoje (BRT) &lt; `scheduled_start_date`; envio do formulário após o fim da agenda **não** implica execução atrasada (sem flag/badge) |
| Prestador não marca EXECUTED a tempo | Auto-mark: após `service_completion_scheduled_end_at` + `auto_mark_executed_grace_hours` (default **24**) → `EXECUTED` com evidência frozen sintética (`responses = {}`, `auto_executed_without_checklist = true`); audit system; MMD `SERVICE_EXECUTED`; invariante EXECUTED↔frozen mantido |
| Auto-mark sem checklist (UI cliente) | Em Avaliar serviço: alerta “Conclusão automática sem checklist”; **não** lista critérios vazios; checkbox de declaração com copy suavizada |
| Auto-complete já rodou | Cliente ainda pode enviar rating opcional (`canSubmitOptionalRating`: `COMPLETED` + `completed_by=system` + sem rating) — **fora** do prompt global. UI: abre **direto** na etapa de notas (sem checklist congelado, sem checkbox de declaração, sem “Continuar para avaliação”, sem voltar às evidências, sem stub de disputa); shell com `ratingOnly` oculta contador “N de M” |
| Prompt sem pending / role ≠ client | `PendingEvaluationPromptHost` não abre |
| Prompt snoozed | Fechar (X) grava Preferences (~4h) para o mesmo `service_request_id`; não reabre até expirar |
| Prompt vs overlays | Só avalia após `waitForProviderLocationPermissionFlow` + `waitForPushPermissionPromptFlow`; delay 600 ms **depois** da fila |
| Vários EXECUTED na grace | RPC retorna o mais recente (`executed_at DESC LIMIT 1`); após envio da avaliação, a sheet entra em fase `success` (`ClientEvaluateSuccessStep`); o host do prompt, no callback `onCompleted` (entrada nessa fase), invalida a query e **mantém** a sheet aberta; o próximo pending só é oferecido após dismiss da success (~800 ms) |
| Disputa sem URL | Toast “Em breve” + analytics; **não** muda status do CS |
| Disputa com URL | Abre URL externa; analytics |

---

## 7. Regras de negócio

1. Create e republish: mesma TX enfileira enrichment `PENDING` via `service_request_enqueue_enrichment`; **não** bootstrap matching.
2. Trigger `trg_service_request_dispatch_bootstrap` **DROP**ada; bootstrap só em READY (ou reparo).
3. Delay `matching.dispatch_start_delay_minutes` (default **5**) e lifecycle do dispatch começam no **bootstrap**, não no insert `OPEN`.
4. Prestador em `CONFIRMED`: draft mutável; submit EXECUTED valida critérios/evidências/janela temporal (BRT).
5. `service_completion_mark_executed`: paths em `evidence_paths` devem existir em `completion_evidence_upload_objects` ligados a sessão do CS/prestador (`EVIDENCE_PATH_NOT_REGISTERED` se não); marca `referenced_in_responses`; sessões `open` → `committed`; freeze + CS → `EXECUTED` + MMD; rejeita `SERVICE_NOT_YET_DUE` se antes de `scheduled_start_date` (BRT). Na UI, sucesso **não** fecha a sheet de imediato — fase `success` com `ProviderExecutedSuccessStep` (wrapper de copy → `CompletionSuccessStep`; orientação ao cliente + **“Entendi”**); sem toast de sucesso no hook de mark.
6. **Auto-mark EXECUTED (sem checklist):** se o prestador não marca `CONFIRMED`→`EXECUTED` dentro de `auto_mark_executed_grace_hours` (default **24**) após o fim do dia BRT de `coalesce(scheduled_end_date, scheduled_start_date)` (`service_completion_scheduled_end_at`), o batch `service_completion_auto_mark_executed` (+ cron `service_completion_cron_auto_mark_executed`, schedule `15 9,15,21,3 * * *`) promove a `EXECUTED` com pacote frozen sintético (`responses = {}`), `auto_executed_without_checklist = true`, `executed_at = now()`, audit actor system, MMD `SERVICE_EXECUTED`. Mantém o invariante EXECUTED exige evidência frozen. **Distinto** do auto-complete EXECUTED→COMPLETED.
7. Confirm manual (`canConfirmWithRating`, CS `EXECUTED`): scores de rating **obrigatórios** (`service_completion_confirm_with_rating`). Exige **Declaração de execução** prévia (tabela `service_completion_execution_declarations` via Edge `record-service-completion-declaration` + RPC `service_completion_upsert_execution_declaration`); sem linha → `EXECUTION_DECLARATION_REQUIRED`. Na UI, o step de revisão exige checkbox marcado **e** declaração persistida antes de “Continuar para avaliação” (erro inline se falhar; remarcar = retry). Com `auto_executed_without_checklist`, o alerta substitui a lista de critérios e a copy do checkbox é suavizada. Path **inalterado** em relação ao rating opcional pós auto-complete (sem declaração). Na UI, sucesso **não** fecha a sheet de imediato — fase `success` com `ClientEvaluateSuccessStep` (wrapper de copy → `CompletionSuccessStep`; modes `confirm` vs `optional`; CTA **“Entendi”**); sem toast de sucesso no hook `useClientConfirmRating`.
8. Auto-complete: `auto_complete_grace_hours` (default **24**) após `executed_at`; `completed_by = system`; lote `auto_complete_batch_size` (default **100**, distinto de `enrichment_claim_batch_size`). **Não** confundir com auto-mark CONFIRMED→EXECUTED. Após auto-complete, se ainda sem rating: capability `can_submit_optional_rating` — UI (`ClientConfirmRatingWizard`) força step `rating` apenas (`isOptionalOnly`); sem revisão/ack/disputa; `ClientEvaluateServiceAction` / `ClientEvaluateServiceSheet` passam `ratingOnly` para ocultar o aside “N de M”; após submit, mesma fase `success` com mode `optional`.
9. Writers removidos do produto: `payment_mark_service_executed`, `payment_confirm_service_completed`, `payment_cron_auto_complete_*`.
10. Stub disputa: título “Abrir disputa”, botão **“Falar com o suporte”**; env `VITE_SERVICE_COMPLETION_DISPUTE_SUPPORT_URL` ou remote `orbit.dispute_support_url`; sem FSM. Capability RPC `show_dispute_stub` e gate UI `shouldShowDisputeStub` = **somente** CS `EXECUTED` — **não** após `COMPLETED` (alinha com o path opcional, que não mostra o stub).
11. Imutabilidade DB: trigger bloqueia alteração de schema/source/`materialized_at` (e saída de status) após enrichment `READY`; evidência `frozen` tem colunas críticas imutáveis (incl. `auto_executed_without_checklist`); CS em `EXECUTED`/`COMPLETED` exige linha de evidência `frozen` (constraint trigger deferred); FK evidência→CS **ON DELETE RESTRICT**.
12. Upload (padrão KYC, sem Edge de URL assinada): RPC `service_completion_create_upload_session` → `supabase.storage.from('completion-evidence').upload()` autenticado sob prefixo da sessão (RLS) → RPC `service_completion_register_upload_object`. Sessão com `storage_bucket = completion-evidence` e `provider_id` = CS; INSERT storage só com sessão `open`, não expirada, CS `CONFIRMED`, abaixo de `max_files` (**só prestador**).
13. Leitura de produto: `authenticated` **não** faz SELECT em `service_request_enrichments`. Status/`ready` leves vêm de `get_service` / `list_services` (gate de CTA e campos do modelo). Checklist, evidências e capabilities: RPC `get_service_completion_context` (detalhe completo vs limitado — §4; expõe `auto_executed_without_checklist`), só quando o fluxo de conclusão/avaliação precisa (abrir sheet/wizard ou CTA cliente elegível).
14. **Prompt de avaliação pendente:** RPC `get_client_pending_evaluation_prompt` (SECURITY DEFINER; `authenticated`): no máximo 1 CS do `auth.uid()` com `status = EXECUTED`, `executed_at` ainda dentro de `auto_complete_grace_hours` (default 24), `ORDER BY executed_at DESC LIMIT 1`. Payload leve (título, categoria, nome do prestador, datas) — **não** substitui `get_service_completion_context`. Índice parcial `(client_id, executed_at DESC) WHERE status = EXECUTED`. UI: `PendingEvaluationPromptHost` no `RootLayout`; sheet `variant="prompt"` com fases `intro` → `wizard` → `success`; contexto completo só após “Continuar para avaliação”. Snooze Preferences `orbit_pending_evaluation_prompt_snooze` (~4h por `serviceRequestId`). Ordem de overlays: localização → push → este prompt.
15. Storage SELECT `completion-evidence` (`storage_objects_completion_evidence_select`): prestador contratado (prefixo próprio, draft + frozen via `service_completion_evidence_storage_path_owned`); **ou** cliente do CS quando a evidência está `frozen` (`service_completion_evidence_storage_path_client_readable` — permite `createSignedUrl` para thumbnails/lightbox em “Avaliar serviço”); **ou** admin de plataforma. INSERT permanece só prestador.
16. Janitor de órfãos (SQL, padrão KYC): expira sessões open passadas do TTL; remove objetos com `referenced_in_responses = false` via `DELETE FROM storage.objects` + limpeza do registry; checagem defensiva de frozen só no batch locked; cron com `job_runs`; sem Edge / sem finalize RPC.
17. Repair READY-sem-dispatch: apenas enrichments com `materialized_at >= now() - 7 days`.

---

## 8. Campos e dados (UX)

| Elemento | Conteúdo |
|----------|----------|
| CTA prestador | Botão **“Marcar serviço como concluído”** na seção Serviço contratado (visível se contrato `CONFIRMED` **e** `enrichmentReady` do `get_service` — sem prefetch do completion context) |
| Sheet/dialog prestador | `ProviderMarkExecutedSheet` orquestra fases na mesma `CompletionFlowSheetDialog`: **`checklist`** — título “Checklist de conclusão” + descrição do checklist; `chrome="standard"`; `ProviderExecutedWizard` busca `get_service_completion_context` e embute draft + upload + submit EXECUTED. **`success`** (após mark-executed) — sheet **não fecha**; `chrome="immersive"` (título acessível sr-only “Checklist enviado com sucesso”; X/handle flutuantes); corpo via `ProviderExecutedSuccessStep` → `CompletionSuccessStep` (eyebrow “Enviado ao cliente”; título “Checklist enviado com sucesso”; descrição de que respostas/evidências já estão no app do cliente; tips “Avise o cliente”: pedir confirmação no app, revisar evidências/checklist, lembrar da avaliação; CTA **“Entendi”** fecha a sheet). Sem toast de sucesso em `useProviderMarkExecuted` (feedback = step na sheet). Em Meus Serviços, `useProviderMarkExecutedDialog.handleExecuted` invalida queries no sucesso e **não** fecha a sheet |
| CTA cliente | Botão **“Avaliar serviço”** na mesma seção: só monta/busca contexto se contrato `EXECUTED` ou `COMPLETED`; então usa `canConfirmWithRating` (manual, 2 etapas) ou `canSubmitOptionalRating` (pós auto-complete, só notas). Após capabilities sumirem (pós submit), `ClientEvaluateServiceAction` **mantém** a sheet montada enquanto `open` (mesmo padrão do prestador) |
| Sheet/dialog cliente (manual) | `ClientEvaluateServiceSheet` orquestra fases na mesma `CompletionFlowSheetDialog`: **`wizard`** — stepper **2 etapas** (“1 de 2” / “2 de 2”); `chrome="standard"`; (1) revisar evidências/checklist congelado + stub disputa (se `EXECUTED`) + checkbox obrigatório de declaração; (2) avaliar prestador/serviço (`ClientConfirmRatingWizard` embutido). Se `auto_executed_without_checklist`: alerta em `FrozenEvidenceReview` (sem lista vazia de critérios) + copy suavizada do checkbox. **`success`** (após confirm-with-rating) — sheet **não fecha** no submit; `chrome="immersive"` (título acessível sr-only “Avaliação enviada com sucesso”); corpo via `ClientEvaluateSuccessStep` mode `confirm` → `CompletionSuccessStep` (eyebrow “Tudo certo”; título “Recebimento confirmado. Obrigado!”; tips “O que acontece agora”; CTA **“Entendi”** fecha). Sem toast de sucesso em `useClientConfirmRating` (feedback = step na sheet). Mode de copy congelado no submit (`successMode`) para não mudar quando capabilities flipam |
| Sheet/dialog cliente (opcional pós auto-complete) | Capability `canSubmitOptionalRating` (`COMPLETED` + `completed_by=system` + sem rating): abre **direto** no step de rating; **sem** revisão de checklist, **sem** checkbox de declaração, **sem** “Continuar para avaliação”, **sem** botão voltar às evidências, **sem** stub de disputa; `ratingOnly` no sheet oculta o contador “N de M”; título do wizard “Avaliar serviço (opcional)”; CTA submit “Enviar avaliação”; após envio, fase `success` com `ClientEvaluateSuccessStep` mode `optional` (eyebrow “Avaliação enviada”; título “Obrigado pela sua avaliação!”) |
| Prompt global (intro) | Título “É hora de avaliar a execução do serviço”; card com título / categoria / prestador / executado em / agenda; CTA “Continuar para avaliação”; **sem** fetch de `get_service_completion_context` até Continuar. Fases do sheet `variant="prompt"`: `intro` → `wizard` (stepper **3 etapas** “1 de 3” …) → `success` (`ClientEvaluateSuccessStep` mode `confirm`) |
| Declaração de execução (checkbox) | Só no **step de revisão** do path **manual** (`canConfirmWithRating`), **abaixo** do card de disputa (quando houver). Texto padrão: “Declaro que revisei as evidências acima e que o serviço foi executado corretamente, conforme o combinado.” Com auto-mark sem checklist: “Declaro que o serviço foi executado corretamente, conforme o combinado.” Ao marcar, persiste metadados (IP, dispositivo Capacitor, geo aproximada por IP no Edge); **“Continuar para avaliação”** fica **disabled** até checkbox marcado **e** persistência OK (spinner durante o envio; erro inline se falhar). **Não** apaga o registro ao desmarcar. **Não** aparece no step de rating, no intro do prompt nem no path opcional pós auto-complete. Metadados sem SELECT authenticated (só `service_role`/admin) |
| Alerta auto-mark sem checklist | Título “Conclusão automática sem checklist”; explica que o sistema marcou a conclusão porque o prestador não registrou no prazo (`FrozenEvidenceReview` / `ClientConfirmRatingWizard`) |
| Fotos de evidência | Thumbnails (`CompletionEvidenceGallery`); clique abre lightbox fullscreen (padrão `ServicePhotoGallery`); prestador ao preencher e cliente ao revisar; URLs via `createSignedUrl` — cliente só após evidência `frozen` (RLS). Ausente no ramo auto-mark (sem critérios/fotos) |
| Dispute stub | Banner `DisputeStubEntry` **somente** no fluxo **Avaliar serviço** enquanto CS está `EXECUTED` (`show_dispute_stub` / `shouldShowDisputeStub`) — **nunca** após `COMPLETED` (incl. dialog de rating opcional) e **nunca** inline no detalhe / `ServiceContractedSection`. Título “Abrir disputa”; botão **“Falar com o suporte”** (evita repetir o título). **Descrição (duas variantes)** via prop `autoExecutedWithoutChecklist` (do contexto `evidence.autoExecutedWithoutChecklist` / `auto_executed_without_checklist`): (1) **com checklist** (default): “Se você acha que há algo errado na execução do serviço com base no checklist evidenciado acima, ou se algo não foi cumprido corretamente, pode abrir uma disputa. A plataforma avalia os detalhes e pode pedir ao prestador que corrija o que não está bom, ou devolver parcial ou integralmente o valor pago.”; (2) **auto-mark sem checklist** (`autoExecutedWithoutChecklist` true): mesma ideia **sem** a menção “com base no checklist evidenciado acima” — “Se você acha que há algo errado na execução do serviço, ou se algo não foi cumprido corretamente, pode abrir uma disputa. …”. Comportamento do botão: URL de suporte ou toast “Em breve” + analytics (**sem** FSM) |

---

## 9. Validações de front-end

- Draft/wizard prestador (no sheet): `validateExecutedResponses` + gate temporal (`deriveExecutedTemporalGate`).
- Confirm cliente (etapa 1 / review, path manual `canConfirmWithRating`): checkbox de declaração de execução marcado antes de “Continuar para avaliação”.
- Confirm cliente (etapa 2 do sheet / path opcional): scores completos antes do submit.
- Upload de evidência: sessão RPC + upload autenticado no storage (prefixo/RLS) + register; limites de imagem; URLs assinadas para thumbnails via `useCompletionEvidencePhotoUrls` (`createSignedUrl` — prestador no próprio prefixo; cliente do CS quando evidência `frozen`).
- Shell modal: dismiss bloqueado enquanto mutação em voo (`dismissDisabled`).
- Banner enrichment no detalhe/lista: campos leves do modelo (`get_service` / `list_services`); **sem** poll via `get_service_completion_context` ao abrir o detalhe. O hook ainda *pode* pollar se algum consumidor passar `pollWhileProcessing`, mas o host atual do detalhe não o usa para o banner.

---

## 10. Validações de back-end

| RPC / job | Regras |
|-----------|--------|
| `enrichment_finalize_ready` | CAS + schema + bootstrap matching mesma TX; após READY schema imutável |
| `get_service_completion_context` | Auth; detalhe completo (checklist + ids) só cliente SR / prestador CS / admin; marketplace → status/`ready` limitado; sem SELECT de tabela enrichment pelo client |
| `get_client_pending_evaluation_prompt` | Auth obrigatório; cliente: 1 CS `EXECUTED` mais recente ainda na grace `auto_complete_grace_hours`; jsonb leve ou null; sem checklist/evidências |
| `service_completion_create_upload_session` | CS `CONFIRMED`; bucket `completion-evidence`; `provider_id` = CS; retorna prefixo da sessão |
| Storage INSERT `completion-evidence` (prestador autenticado) | Upload sob prefixo da sessão; sessão open, não expirada, CS CONFIRMED, contagem &lt; `max_files` (RLS); **sem** Edge de URL assinada de upload |
| Storage SELECT `completion-evidence` | Prestador: prefixo próprio (draft + frozen). Cliente do CS: paths do CS **somente** se evidência `frozen` (`service_completion_evidence_storage_path_client_readable`) — `createSignedUrl` para galeria em “Avaliar serviço”. Admin: sim. |
| `service_completion_register_upload_object` | Sessão `open` do prestador; path sob prefixo; registra em `completion_evidence_upload_objects` |
| `service_completion_mark_executed` | Auth prestador do CS; `CONFIRMED`; payload checklist; paths registrados (`EVIDENCE_PATH_NOT_REGISTERED`); freeze atômico; sessões open → committed |
| `service_completion_auto_mark_executed` / cron | service_role; grace `auto_mark_executed_grace_hours` após `service_completion_scheduled_end_at`; batch `auto_mark_executed_batch_size`; evidência frozen sintética + `auto_executed_without_checklist`; MMD `SERVICE_EXECUTED`; cron `15 9,15,21,3 * * *` |
| `service_completion_confirm_with_rating` | Auth cliente; `EXECUTED`; scores obrigatórios; evidência frozen (invariante deferred) |
| `service_completion_auto_complete_executed` | service_role / cron; grace hours após `executed_at`; batch `auto_complete_batch_size` (default 100); `SKIP LOCKED` |
| `enrichment_repair_ready_without_dispatch` | READY sem dispatch; janela **7 dias** em `materialized_at`; só bootstrap |
| Janitor orphan uploads (`service_completion_janitor_orphan_uploads`) | SQL (padrão KYC): expira sessões + `DELETE FROM storage.objects` / registry quando `referenced_in_responses = false`; checagem frozen JSONB só no batch locked; cron `service_completion_cron_orphan_upload_janitor` + `job_runs`; sem Edge / sem finalize RPC |

---

## 11. Status e transições

### Enrichment (`enrichment_status`)

`PENDING` → `RUNNING` → `READY` (terminal) \| retry → `PENDING`; ou `ABORTED` (terminal).

### Contrato (conclusão)

`CONFIRMED` → `EXECUTED` (mark manual **ou** auto-mark sem checklist) → `COMPLETED` (confirm ou auto-complete).

### Evidência

`draft` (mutável em CONFIRMED) → `frozen` (com EXECUTED).

---

## 12. Persistência

Servidor: tabelas enrichment/evidence/upload sessions+objects/ratings; `platform_constants` (checklist, enrichment, `auto_mark_executed_grace_hours` / `auto_mark_executed_batch_size`, `auto_complete_grace_hours`, **`auto_complete_batch_size`**, orphan TTL). Helper SQL `service_completion_scheduled_end_at(start, end)` = fim do dia BRT de `coalesce(end, start)`. Cliente: projeção leve `enrichmentStatus`/`enrichmentReady` em `get_service`/`list_services`; React Query com `get_service_completion_context` só no wizard/CTA elegível; prompt global com query `get_client_pending_evaluation_prompt` (`staleTime` ~10 min, sem refetch on focus); snooze Preferences `orbit_pending_evaluation_prompt_snooze`; sem SELECT autenticado em `service_request_enrichments`; sem draft local próprio além do estado do wizard.

---

## 13. Integrações

| Sistema | Contrato |
|---------|----------|
| Matching | `matching_bootstrap_dispatch_for_service_request` (+ repair ≤7 dias) |
| Edge | `generate-completion-checklist` (só enrichment; upload de evidência **sem** Edge) |
| Storage | Bucket `completion-evidence` — INSERT autenticado sob sessão (prestador); SELECT também para cliente do CS com evidência `frozen` (`createSignedUrl`) |
| MMD | `SERVICE_EXECUTED` / `SERVICE_COMPLETED` / `SERVICE_AUTO_COMPLETED` |
| view-services | Host: CTAs na `ServiceContractedSection` (Public API; gate leve via `enrichmentReady` do modelo + contexto só no fluxo) |
| my-services | Cards `in_progress`: highlight de follow-up (pós-data-fim `CONFIRMED` / `EXECUTED`); prestador `CONFIRMED` + past → CTA **“Concluir serviço”** no card (sheet; contexto ao abrir); cliente `EXECUTED` → CTA **“Avaliar serviço”** no card (`ClientEvaluateServiceSheet` hospedado na página; contexto RPC só ao abrir o wizard); cards `completed`: `COMPLETED` + sem `clientRatingOverallScore` → **“Avaliar serviço”** com `ratingOnly` (dados de `list_services`); demais → “Ver detalhes” — ver [solicitacoes-do-cliente](../../my-services/features/solicitacoes-do-cliente.md) Anexos D e F |
| RootLayout / push-permission | `PendingEvaluationPromptHost` após fila localização + push (`appOpenOverlaySequence`) |
| Analytics | `service_completion_dispute_stub_opened`; `pending_evaluation_prompt_opened` / `_dismissed` / `_completed` |

---

## 14. Ações disponíveis

| Ação | Quem | Pré-condição | Resultado |
|------|------|--------------|-----------|
| Abrir “Marcar serviço como concluído” | Prestador contratado | UI: `CONFIRMED` + `enrichmentReady` (`get_service`); contexto RPC ao abrir o sheet | Sheet/dialog; wizard carrega checklist |
| Salvar draft | Prestador contratado | `CONFIRMED` (+ capability do contexto no wizard) | Evidência draft |
| Criar sessão → upload autenticado → register path | Prestador contratado | CS CONFIRMED; sessão open; &lt; max_files | Objeto em `completion-evidence` + registry |
| Marcar executado (submit no sheet) | Prestador contratado | `CONFIRMED` + paths registrados + validação | `EXECUTED`; sessões → committed; sheet permanece aberta na fase `success` (`ProviderExecutedSuccessStep` → `CompletionSuccessStep`, `chrome="immersive"`); dismiss só com **“Entendi”** (ou fechar o shell) |
| Auto-mark EXECUTED (sistema) | Sistema (cron) | `CONFIRMED` + grace após fim agenda BRT | `EXECUTED` + evidência frozen sintética (`auto_executed_without_checklist`) |
| Abrir “Avaliar serviço” | Cliente | UI: contrato `EXECUTED` (`canConfirmWithRating`) ou `COMPLETED` system sem rating (`canSubmitOptionalRating`) | Manual: sheet/dialog 2 etapas (revisão + declaração + disputa se `EXECUTED` → rating). Opcional: sheet/dialog **só** etapa de notas (`ratingOnly`; sem disputa). Detalhe via `ClientEvaluateServiceAction` (mantém sheet montada enquanto `open` pós-capabilities); lista Meus Serviços via `ClientEvaluateServiceSheet` |
| Prompt de avaliação pendente | Cliente (`RootLayout`) | Role `client`; RPC retorna pending na grace; não snoozed; fila localização+push concluída | Sheet fases `intro` → `wizard` → `success`; dismiss no intro/wizard = snooze ~4h |
| Confirmar + avaliar | Cliente | `EXECUTED` | `COMPLETED` + rating; sheet permanece na fase `success` (`ClientEvaluateSuccessStep` mode `confirm` → `CompletionSuccessStep`, `chrome="immersive"`; CTA **“Entendi”**); sem toast de sucesso no hook; hosts (`useClientEvaluateServiceDialog` / `usePendingEvaluationPrompt`) **não** fecham no `onCompleted` — só invalidam; no prompt, o próximo pending só após dismiss da success (~800 ms) |
| Falar com o suporte (stub disputa) | Cliente | durante o fluxo Avaliar serviço com CS `EXECUTED` (capability `show_dispute_stub`) | Banner título “Abrir disputa”; botão “Falar com o suporte” → URL ou toast **somente** no wizard Avaliar serviço em `EXECUTED` — **nunca** após `COMPLETED` nem inline no detalhe (ver §8) |
| Submeter rating pós auto | Cliente | `COMPLETED` + `completed_by=system` + sem rating (`canSubmitOptionalRating`) | Rating opcional: mesmo CTA/sheet, abre direto nas notas (`ratingOnly`); após envio, fase `success` com mode `optional` |

---

## 15. Dependências

Upstream: pedido (`request-quote` / republish), contrato pago (`payments`/`CNS`), matching. Downstream UI: `view-services`. Notificações: MMD.

---

## 16. Regras implícitas

- Consumidores externos **não** importam internals de `service-completion` — só `index.ts`.
- Host preferencial: `ProviderMarkExecutedAction` / `ClientEvaluateServiceAction` no detalhe; na lista Meus Serviços, hosts usam `ProviderMarkExecutedSheet` / `ClientEvaluateServiceSheet` (wizards ainda exportados para composição embutida / legado de API, mas **não** montados inline no detalhe).
- Após mark-executed com sucesso, `ProviderMarkExecutedSheet` troca fase `checklist` → `success` na mesma `CompletionFlowSheetDialog` (`chrome` standard → immersive; corpo `ProviderExecutedSuccessStep` → `CompletionSuccessStep`) e **não** fecha no `onExecuted` do host; toast de sucesso do mark foi removido do hook.
- Após avaliação com sucesso (confirm-with-rating ou optional rating), `ClientEvaluateServiceSheet` troca fase `wizard` → `success` na mesma `CompletionFlowSheetDialog` (`chrome` standard → immersive; corpo `ClientEvaluateSuccessStep` → `CompletionSuccessStep`; modes `confirm` \| `optional`) e **não** fecha no submit; toast de sucesso removido de `useClientConfirmRating`. `ClientEvaluateServiceAction` mantém a sheet montada enquanto `open` após as capabilities sumirem.
- `CompletionSuccessStep` é o corpo genérico de sucesso (eyebrow, title, description, tips, CTA **“Entendi”**); `ProviderExecutedSuccessStep` e `ClientEvaluateSuccessStep` só fornecem a copy (prestador / cliente). Os três exportados na Public API.
- Checklist de execução **não** permanece aberto na página de detalhe — só dentro do sheet/dialog.
- `ServiceDetailPage` **não** chama `get_service_completion_context` ao abrir o detalhe; banner e gate do CTA prestador usam só o modelo de `get_service`.
- `ProviderMarkExecutedAction` **não** prefetcha contexto ao montar; a RPC roda no `ProviderExecutedWizard` ao abrir o dialog.
- `ClientEvaluateServiceAction` **não** busca contexto em `CONFIRMED` (só `EXECUTED`/`COMPLETED`); o sheet controlado (`ClientEvaluateServiceSheet`) monta o wizard só com `open` e carrega contexto ao abrir.
- `ClientEvaluateServiceAction` reutiliza `ClientEvaluateServiceSheet` (mesmo shell da lista).
- Prompt global (`variant="prompt"`) monta intro **antes** do wizard; `get_service_completion_context` só após Continuar; após rating, mesma fase `success`.
- `view-services` não reexporta mais lifecycle de payments para conclusão.
- Chargeback / `is_disputed` em payments **não** é o stub de disputa do app.

---

## 17. Riscos

| Risco | Nota |
|-------|------|
| Suporte: “pedido não no feed” | Enrichment ainda não READY |
| Expectativa de disputa completa | Stub only — ver visão geral / pendências |
| Confusão payment vs completion writers | ADR-0004 |

---

## 18. Evidências

- `src/features/service-completion/**` (incl. `ProviderMarkExecutedAction`, `ProviderMarkExecutedSheet`, `ProviderExecutedSuccessStep`, `ClientEvaluateSuccessStep`, `CompletionSuccessStep`, `ClientEvaluateServiceAction`, `ClientEvaluateServiceSheet`, `PendingEvaluationPromptHost`, `PendingEvaluationIntroStep`, `CompletionFlowSheetDialog`, `CompletionEvidenceGallery`)
- `src/layouts/RootLayout.tsx`; `src/lib/appOpenOverlaySequence.ts`
- Migrations `20260804010000`–`2026080452*` (constants, RLS, evidence/sessions, mark/confirm/auto-complete, context RPC, janitor, indexes); `20260806180328_service_completion_auto_mark_executed.sql`; `20260806205555_get_client_pending_evaluation_prompt.sql`
- Edge: `generate-completion-checklist` (upload evidência: RPCs create/register + storage autenticado; sem Edge)
- Janitor SQL: `service_completion_janitor_orphan_uploads` + `service_completion_cron_orphan_upload_janitor`
- Auto-mark: `service_completion_auto_mark_executed` + `service_completion_cron_auto_mark_executed` (`15 9,15,21,3 * * *`); helper `service_completion_scheduled_end_at`
- `docs/service-completion/design.md` §3.7 / §4.1; matching CONTEXT **#135**
- Testes: `src/features/service-completion/**/__tests__` (CTAs, gallery, auto-executed UI, pending eval prompt/host/hook/api/storage); boundary em `view-services`; pgTAP `supabase/tests/service_completion/*` (incl. `auto_mark_executed_grace_and_cron_test.sql`, `get_client_pending_evaluation_prompt_test.sql`)

---

## 19. Pendências

| ID | Item | Status |
|----|------|--------|
| SC-01 | FSM completa de disputa in-app | Fora do escopo atual (stub) |
| SC-02 | Aba Disputas vazia em Meus Serviços | Produto / view-services |

---

## 20. Atualização de auditoria

- **2026-08-04** — Documentação de negócio alinhada ao cutover service-completion (READY-handoff, RPCs `service_completion_*`, UX enrichment/EXECUTED/confirm/auto-complete/dispute stub).
- **2026-08-05** — Endurecimento SQL: paths registrados / `EVIDENCE_PATH_NOT_REGISTERED`; sessões → `committed` no freeze; storage INSERT gated; imutabilidade frozen/READY; FK RESTRICT; constraint EXECUTED/COMPLETED↔frozen; contexto full vs marketplace; sem SELECT autenticado em enrichments; `auto_complete_batch_size`; repair ≤7 dias; janitor via `referenced_in_responses`.
- **2026-08-05 (UX)** — Checklist/avaliação saem do inline do detalhe: CTAs na seção Serviço contratado → sheet (mobile) / dialog (desktop); cliente com stepper 2 etapas; fotos de evidência como thumbnails + lightbox.
- **2026-08-06** — Lazy load do completion context: detalhe/banner usam só `enrichmentStatus`/`enrichmentReady` de `get_service` (como o card); CTA prestador gated por `CONFIRMED` + `enrichmentReady` sem prefetch; RPC `get_service_completion_context` ao abrir o wizard; CTA cliente só busca contexto em `EXECUTED`/`COMPLETED`.
- **2026-08-06 (lista)** — Cards em Meus Serviços: highlight de follow-up pós-data-fim / `EXECUTED` (sem prefetch de contexto na lista).
- **2026-08-06 (card prestador)** — Prestador `CONFIRMED` + past: CTA **“Concluir serviço”** no card abre sheet (`ProviderMarkExecutedSheet`; contexto RPC ao abrir; gate `enrichmentReady`); secundário “Ver detalhes”.
- **2026-08-06 (card cliente)** — Cliente `EXECUTED`: CTA **“Avaliar serviço”** no card abre `ClientEvaluateServiceSheet` hospedado na página (`ClientEvaluateServiceDialogs` + `useClientEvaluateServiceDialog`); secundário “Ver detalhes”; contexto RPC só ao abrir o wizard; `ClientEvaluateServiceAction` no detalhe reutiliza o mesmo sheet.
- **2026-08-06 (storage SELECT cliente)** — Política `storage_objects_completion_evidence_select` passa a permitir SELECT/`createSignedUrl` ao cliente do CS quando a evidência está `frozen` (helper `service_completion_evidence_storage_path_client_readable`); corrige thumbnails/lightbox “Indisponível” em “Avaliar serviço”. INSERT continua só prestador; SELECT do prestador (draft + frozen no próprio prefixo) inalterado. Migração editada in-place: `20260804100000_service_completion_evidence_storage.sql`.
- **2026-08-06 (Avaliar serviço — declaração + CTA disputa)** — Step de revisão do `ClientConfirmRatingWizard`: checkbox obrigatório de declaração de execução (copy fixa; “Continuar para avaliação” disabled até marcar); só no review, abaixo do stub de disputa quando houver; ausente no step de rating. `DisputeStubEntry`: título permanece “Abrir disputa”; botão interno passa a **“Falar com o suporte”** (URL/toast + analytics, sem FSM).
- **2026-08-06 (auto-mark EXECUTED)** — Se prestador não marca `CONFIRMED`→`EXECUTED` em `auto_mark_executed_grace_hours` (default 24) após fim do dia BRT de `coalesce(scheduled_end, scheduled_start)` (`service_completion_scheduled_end_at`), batch/cron promove a EXECUTED com evidência frozen sintética (`responses = {}`, `auto_executed_without_checklist = true`), audit system, MMD `SERVICE_EXECUTED`; invariante frozen mantido. UI Avaliar serviço: alerta + sem lista vazia de critérios + copy do checkbox suavizada. Distinto do auto-complete EXECUTED→COMPLETED (`auto_complete_grace_hours` após `executed_at`).
- **2026-08-06 (stub disputa — só no wizard)** — `ClientEvaluateServiceAction` deixa de renderizar `DisputeStubEntry` inline no detalhe / `ServiceContractedSection` quando não há CTA Avaliar serviço. Stub **nunca** no host do detalhe; permanece **somente** dentro do `ClientConfirmRatingWizard` no fluxo Avaliar serviço.
- **2026-08-06 (prompt de avaliação pendente)** — RPC `get_client_pending_evaluation_prompt` + índice parcial; `PendingEvaluationPromptHost` no `RootLayout` (só client); sheet 3 passos (intro leve → review → rating); snooze Preferences ~4h; abre **por último** na fila localização → push → avaliação; pós auto-complete (rating opcional) fora do escopo deste prompt.
- **2026-08-07 (rating opcional pós auto-complete)** — Com `canSubmitOptionalRating` (`COMPLETED` + `completed_by=system` + sem rating), `ClientConfirmRatingWizard` abre **direto** no step de rating: sem revisão de checklist, sem checkbox de declaração, sem “Continuar para avaliação”, sem voltar às evidências. Stub de disputa (`DisputeStubEntry` / `shouldShowDisputeStub`) alinhado à RPC `show_dispute_stub`: **somente** `EXECUTED` — **não** após `COMPLETED` (cliente não abre disputa via stub no dialog opcional). `ClientEvaluateServiceAction` / `ClientEvaluateServiceSheet` passam `ratingOnly` para ocultar o contador “N de M”. Path manual `canConfirmWithRating` (`EXECUTED`) permanece 2 etapas (revisão+ack+disputa → rating).
- **2026-08-07 (card Meus Serviços `completed`)** — Cliente fase `completed` com `COMPLETED` + `clientRatingOverallScore == null`: CTA **“Avaliar serviço”** no card (`evaluate_service` + `ratingOnly` via `ClientEvaluateServiceDialogs`); secundário “Ver detalhes”; sem request extra (`list_services`). Com rating, só “Ver detalhes”.
- **2026-08-07 (stub disputa — copy sem checklist)** — `DisputeStubEntry` / `ClientConfirmRatingWizard`: quando `autoExecutedWithoutChecklist` é true (auto-mark EXECUTED sem checklist), a descrição do stub **não** menciona “com base no checklist evidenciado acima”; copy alternativa fala só de erro na execução / não cumprimento → plataforma pode pedir correção ou devolver parcial/integralmente. Com checklist (default), mantém a copy anterior que cita o checklist evidenciado.
- **2026-08-07 (step de sucesso pós mark-executed)** — Após submit bem-sucedido do checklist (`service_completion_mark_executed` → `EXECUTED`), `ProviderMarkExecutedSheet` / `CompletionFlowSheetDialog` **não fecha** de imediato: fase `success` com step de sucesso (orientação ao cliente + CTA **“Entendi”**). Toast “Serviço marcado como executado.” removido de `useProviderMarkExecuted` (feedback = step na sheet). Em Meus Serviços, `useProviderMarkExecutedDialog.handleExecuted` continua invalidando list/detail no sucesso, mas **não** fecha a sheet (dismiss no step de sucesso).
- **2026-08-07 (arquitetura do step de sucesso)** — Separação de responsabilidades sem mudar o produto: `CompletionFlowSheetDialog` usa `chrome="standard"` ou `chrome="immersive"` (substitui `hideHeaderCopy`; immersive = título sr-only + X/handle flutuantes para full-bleed). Novo `CompletionSuccessStep` (Public API) — corpo reutilizável (eyebrow, title, description, tips, CTA). `ProviderExecutedSuccessStep` vira wrapper fino só com copy do prestador (eyebrow “Enviado ao cliente”; título “Checklist enviado com sucesso”; tips pedir confirmação / revisar evidências / lembrar avaliação). `ProviderMarkExecutedSheet` orquestra `checklist` (wizard + chrome standard) vs `success` (success step + chrome immersive); sheet permanece aberta até **“Entendi”**.
- **2026-08-07 (step de sucesso pós avaliação do cliente)** — Após envio bem-sucedido (confirm-with-rating ou optional rating), `ClientEvaluateServiceSheet` **não fecha** de imediato: fases `intro` (só prompt) \| `wizard` \| `success`; corpo `ClientEvaluateSuccessStep` → `CompletionSuccessStep` com `chrome="immersive"`; CTA **“Entendi”**; copy `confirm` vs `optional` (`ratingOnly`). Toast de sucesso removido de `useClientConfirmRating`. `ClientEvaluateServiceAction` mantém a sheet montada enquanto `open` após as capabilities sumirem (mesmo padrão do prestador). Public API exporta `ClientEvaluateSuccessStep`.
- **2026-08-07 (hosts não fecham no onCompleted)** — `useClientEvaluateServiceDialog` e `usePendingEvaluationPrompt` só invalidam no `onCompleted` (entrada em `success`); dismiss fica com **“Entendi”** / `onOpenChange(false)`. No prompt, o próximo pending só após dismiss da success (sem snooze); enquanto success está aberta, o effect não fecha a sheet quando a query deixa de retornar pending.
