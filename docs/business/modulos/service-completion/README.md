# Conclusão de serviço e enrichment (`service-completion`)

Módulo de produto que cobre (1) **prontidão de publicação** do pedido (checklist de conclusão gerado antes do matching) e (2) **conclusão pós-contrato** (evidências, EXECUTED, confirmação+avaliação, auto-complete).

UI embutida no detalhe/lista via [view-services](../view-services/README.md) (só Public API). Backend: RPCs `service_completion_*` / `enrichment_*` + Edge `generate-completion-checklist` ([ADR-0004](../../../service-completion/adr/0004-completion-rpcs-outside-payments.md)).

Detalhe: [features/conclusao-e-enrichment.md](./features/conclusao-e-enrichment.md).

---

## 1. Leitura para negócio

- **Para que serve:** após criar/republicar um pedido, materializa um **checklist de conclusão** imutável; só então o matching pode começar. Depois do pagamento (`CONFIRMED`), o prestador abre **“Marcar serviço como concluído”** (sheet/dialog com checklist + evidências) e marca **EXECUTED**; o cliente abre **“Avaliar serviço”** (2 etapas: revisar → avaliar) ou o sistema **auto-completa** ~24h após EXECUTED.
- **Quem usa:** cliente e prestador no detalhe do serviço (seção Serviço contratado); sistema (cron enrichment + auto-complete).
- **Valor:** pedido só entra no feed após READY; conclusão com evidência congelada e rating; writers fora do domínio de pagamentos.
- **Riscos de suporte:** pedido `OPEN` ainda “em processamento” **não** aparece no feed; disputa no app é **stub** (URL de suporte ou toast “Em breve”) — sem FSM de disputa.

---

## 2. Visão geral funcional

| Aspecto | Detalhe |
|---------|---------|
| Feature front | `src/features/service-completion/` |
| Superfícies UI | Banner enrichment; CTAs na seção contratada → sheet (mobile) / dialog (desktop); wizards embutidos; stub de disputa (inline quando sem CTA avaliar) |
| Public API (host) | `EnrichmentProcessingBanner`, **`ProviderMarkExecutedAction`**, **`ClientEvaluateServiceAction`** (+ wizards ainda exportados para composição embutida) |
| Host | `view-services` (`ServiceContractedSection`, `ServiceDetailPage`, `SimpleServiceCard`) — **só** imports da Public API |
| Enrichment | Tabela `service_request_enrichments` (`PENDING` → `RUNNING` → `READY` \| `ABORTED`); enqueue em create/republish |
| Matching | Bootstrap **só** via `matching_bootstrap_dispatch_for_service_request` na TX de READY (trigger OPEN **DROP**ado) |
| Conclusão | RPCs `service_completion_mark_executed`, `service_completion_confirm_with_rating`, `service_completion_auto_complete_executed` (+ cron) |
| Removidos | `payment_mark_service_executed`, `payment_confirm_service_completed`, `payment_cron_auto_complete_*` |

---

## 3. Features do módulo

| Feature | Resumo | Documento |
|---------|--------|-----------|
| Enrichment + conclusão + disputa stub | Bootstrap READY; checklist; EXECUTED; confirm+rating; auto-complete; stub | [features/conclusao-e-enrichment.md](./features/conclusao-e-enrichment.md) |

---

## 4. Perfis envolvidos

| Perfil | Papel |
|--------|--------|
| **Cliente** | Vê banner “em processamento”; após EXECUTED: CTA **“Avaliar serviço”** (revisão + scores); stub de disputa; rating opcional pós auto-complete |
| **Prestador** | Em `CONFIRMED`: CTA **“Marcar serviço como concluído”** (checklist no sheet/dialog, não inline); vê conclusão após COMPLETED |
| **Sistema** | Worker/cron enrichment; cron auto-complete (`completed_by=system`, batch `auto_complete_batch_size`); sweeper READY-sem-dispatch (≤7 dias); janitor de uploads órfãos |

---

## 5. Principais fluxos

1. Create/republish → `OPEN` + enrichment `PENDING` → Edge `generate-completion-checklist` → READY → `matching_bootstrap_dispatch_for_service_request` (delay 5 min a partir daí).
2. Prestador `CONFIRMED` → CTA “Marcar serviço como concluído” → sheet/dialog com draft + upload evidência (RPC create session → `storage.from('completion-evidence').upload()` autenticado → RPC register; sem Edge) → fotos como thumbnails + lightbox → `service_completion_mark_executed` → `EXECUTED` (+ `executed_late` se atrasado).
3. Cliente → CTA “Avaliar serviço” → etapa 1 revisão congelada (thumbnails) → etapa 2 scores → `service_completion_confirm_with_rating` → `COMPLETED`.
4. Sem confirmação manual → cron ~24h (`auto_complete_grace_hours`) → `COMPLETED` pelo sistema; rating pode vir depois (mesmo CTA, label opcional).

---

## 6. Regras transversais

- Enrichment ≠ `service_request_status` ≠ `DISPATCH_*` ≠ status do contrato.
- Matching **não** inicia no insert `OPEN` (trigger bootstrap removida).
- Writers de EXECUTED/COMPLETED são `service_completion_*` (não `payment_*`).
- Disputa: `VITE_SERVICE_COMPLETION_DISPUTE_SUPPORT_URL` / override `orbit.dispute_support_url`; sem URL → toast “Em breve” + analytics `service_completion_dispute_stub_opened`.
- **Paths de evidência** no mark-executed devem estar registrados em `completion_evidence_upload_objects` sob sessão do CS/prestador; caso contrário → `EVIDENCE_PATH_NOT_REGISTERED`.
- No freeze, sessões de upload **`open`** do CS passam a **`committed`**.
- Upload de evidência (padrão KYC): `service_completion_create_upload_session` → upload autenticado no bucket `completion-evidence` sob prefixo da sessão (RLS) → `service_completion_register_upload_object`. **Sem** Edge de URL assinada.
- INSERT no storage `completion-evidence` exige sessão `open`, não expirada, CS `CONFIRMED`, contagem &lt; `max_files`.
- Evidência **frozen** e schema de enrichment **READY** são imutáveis no DB (triggers); CS `EXECUTED`/`COMPLETED` exige evidência frozen (constraint deferred); FK evidência→CS é **ON DELETE RESTRICT**.
- Leitura de produto: RPC `get_service_completion_context` (não SELECT direto em `service_request_enrichments` por `authenticated`). Detalhe completo só para cliente do SR, prestador contratado ou admin; prestador só-marketplace recebe payload limitado (status/`ready`, sem checklist nem ids de contraparte).
- Constantes: `auto_complete_batch_size` (default **100**, distinto de `enrichment_claim_batch_size`); sweeper READY-sem-dispatch limitado a enrichment materializado nos **últimos 7 dias**.
- Sessão de upload: `storage_bucket` = `completion-evidence`; `provider_id` deve coincidir com o CS.

---

## 7. Entidades

| Entidade | Função |
|----------|--------|
| `service_request_enrichments` | FSM de prontidão + schema imutável após READY; sem SELECT direto autenticado |
| `completion_checklist_templates` | Fallback se IA esgota tentativas |
| `contracted_service_completion_evidence` | Draft → frozen; `executed_late` no freeze; FK CS RESTRICT |
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
| **view-services** | Consome Public API: banner; **`ProviderMarkExecutedAction`** / **`ClientEvaluateServiceAction`** na `ServiceContractedSection` |
| **dynamic-form** | Blocos `completion_criterion` / `static_text` no checklist (fotos via galeria do service-completion) |
| **message-dispatcher** | Intents `SERVICE_EXECUTED`, `SERVICE_COMPLETED`, `SERVICE_AUTO_COMPLETED` |
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
| App | `src/features/service-completion/` (`ProviderMarkExecutedAction`, `ClientEvaluateServiceAction`, `CompletionEvidenceGallery`, wizards) |
| Host UI | `ServiceContractedSection.tsx` (CTAs); `ServiceDetailPage.tsx` (banner); `SimpleServiceCard.tsx` |
| Migrations | `supabase/migrations/20260804*` (enrichment, bootstrap DROP, RPCs, cron) |
| Edge | `generate-completion-checklist/` (enrichment only) |
| Upload evidência | RPCs `service_completion_create_upload_session` / `service_completion_register_upload_object` + storage autenticado `completion-evidence` (sem Edge) |
| Janitor SQL | `service_completion_janitor_orphan_uploads` + cron `service_completion_cron_orphan_upload_janitor` |
| Design / ADR | `docs/service-completion/design.md`, ADR-0004 |
| Matching CONTEXT | decisão **#135** em `docs/matching-algorithm/CONTEXT.md` |
| Feature doc | [features/conclusao-e-enrichment.md](./features/conclusao-e-enrichment.md) |
