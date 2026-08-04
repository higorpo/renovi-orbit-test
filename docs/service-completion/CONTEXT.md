# Service Completion — Glossário

Termos canônicos do domínio de **enriquecimento pré-publicação do pedido**, **checklist de execução**, **marcação de execução**, **confirmação de entrega** e **avaliação pós-conclusão**. Sem detalhes de implementação.

Requisitos: [`requirements.md`](./requirements.md).

ADR: [`adr/0001-separate-enrichment-fsm-for-publication-readiness.md`](./adr/0001-separate-enrichment-fsm-for-publication-readiness.md) · [`adr/0002-evidence-images-block-not-image-gallery.md`](./adr/0002-evidence-images-block-not-image-gallery.md) · [`adr/0003-completion-criterion-block.md`](./adr/0003-completion-criterion-block.md).

## Language

**Checklist de conclusão**:
Documento estruturado (schema de formulário dinâmico) que define os critérios verificáveis de execução de um serviço contratado. Gerado por IA a partir do formulário e da descrição do pedido; preenchido pelo prestador na execução; revisado pelo cliente na confirmação.
_Avoid_: formulário de pedido, form_data de intake, dynamic form genérico (sem qualificar)

**Prontidão para publicação (Publication Readiness)**:
Condição operacional do pedido que autoriza o início do matching/dispatch. Enquanto não estiver pronta, o pedido existe mas **não** é visível a prestadores nem dispara batches.
_Avoid_: published (ambiguo com marketing), OPEN (status de domínio do pedido ≠ readiness)

**Enriquecimento assíncrono do pedido**:
Pipeline pós-criação que materializa artefatos derivados (ex.: checklist de conclusão) antes da prontidão para publicação.
_Avoid_: generate-smart-description (pré-create, sync), matching delay

**Serviço executado (EXECUTED)**:
Estado de `contracted_services` em que o prestador declarou a execução do trabalho, com evidências/checklist preenchidos conforme regras do domínio.
_Avoid_: concluído (reservado a COMPLETED), finalizado, entregue (sem qualificar ator)

**Serviço concluído (COMPLETED)**:
Estado terminal de `contracted_services` em que o cliente confirmou a entrega (ou o sistema auto-completou após grace). Habilita avaliação.
_Avoid_: EXECUTED, service_requests.COMPLETED (aceite de proposta)

**Avaliação de serviço**:
Feedback multidimensional do cliente ao prestador após `COMPLETED`, vinculado ao `contracted_service`.
_Avoid_: review genérico, nota do card mockada

**Checklist template fallback**:
Checklist canônico pré-definido, resolvido em cascata **serviço → categoria → global**, aplicado quando a geração via IA esgota a política de retry. Origem auditável `fallback_template`.
_Avoid_: checklist vazio, publicar sem checklist

**Schema do checklist**:
Definição imutável dos itens/perguntas/requisitos de evidência do checklist de conclusão (estrutura Dynamic Form). Distinto das respostas.
_Avoid_: form_schema do intake

**Respostas do checklist (evidências de execução)**:
Valores preenchidos pelo prestador no momento da marcação como `EXECUTED` (met/não met, imagens, justificativas), referenciando o schema imutável de `completion_criterion`.
_Avoid_: form_data do pedido

**Justificativa de critério não atendido**:
Texto obrigatório no `completion_criterion` quando `met = false`, exigido para aceitar a transição para `EXECUTED`.
_Avoid_: comment genérico da avaliação; textarea solta no schema

**Pacote de evidência de execução**:
Snapshot imutável das respostas do checklist + anexos no momento do `EXECUTED`.
_Avoid_: draft de checklist, form_data

**Visibilidade do schema**:
Direito de leitura do schema do checklist por atores autorizados antes e durante a negociação/execução, sem implicar acesso às respostas.
_Avoid_: publicação do pedido (readiness)

**Enriquecimento do pedido (FSM)**:
Ciclo de vida operacional que materializa o checklist de conclusão e sinaliza prontidão para publicação. Fonte de verdade do gate de matching.
_Avoid_: service_request_status, DISPATCH_PENDING

**Janela de marcação de execução**:
Intervalo de datas (America/Sao_Paulo, date-only) em que o prestador pode submeter o pacote de evidência e transicionar para `EXECUTED` **sem** flag de atraso. Fim efetivo = `coalesce(scheduled_end_date, scheduled_start_date)`; teto on-time = fim efetivo **+ 1 dia**.
_Avoid_: payment_service_execution_at (hora do turno para pagamento)

**Execução atrasada (`executed_late`)**:
Marcação `EXECUTED` ocorrida após o teto on-time da janela. Permitida no self-serve; deve ser sinalizada ao cliente.
_Avoid_: bloqueio hard pós-grace

**Draft de evidência**:
Respostas/anexos do checklist persistidos no servidor enquanto o serviço está `CONFIRMED`, ainda não submetidos como pacote de evidência. Invisível ao cliente.
_Avoid_: pacote de evidência de execução (imutável pós-EXECUTED)

**Confirmação com avaliação**:
Transição manual `EXECUTED`→`COMPLETED` acoplada atomicamente à criação da avaliação de serviço.
_Avoid_: confirm sem rating no path manual; saga compensável

**Abortamento de enrichment**:
Término do pipeline de enriquecimento porque o pedido foi cancelado antes da prontidão; impede materialização e bootstrap de matching.
_Avoid_: completar enrichment após cancel

**Allowlist de blocos do checklist**:
Conjunto fechado de tipos Dynamic Form permitidos no schema de conclusão: `completion_criterion`, `static_text`.
_Avoid_: yes_no genérico do intake, image_gallery, evidence_images como tipo top-level do schema

**Critério de conclusão (`completion_criterion`)**:
Bloco Dynamic Form composto que representa um critério verificável de execução: enunciado, resposta atendeu/não atendeu, evidências fotográficas embutidas e justificativa obrigatória quando não atendido.
_Avoid_: yes_no + evidence_images separados; formulário de intake

**Cardinalidade do checklist**:
Faixa válida de itens `completion_criterion` no schema (default **3–12**, configurável). `static_text` não conta. Fora da faixa → schema inválido.
_Avoid_: checklist sem bound

**Política de evidência do critério**:
Regras de obrigatoriedade de fotos no `completion_criterion`: sempre no não-atendido; no atendido somente se `requires_evidence_when_met`; bounds min/max por critério.
_Avoid_: evidência global única no fim do formulário

**Disputa (stub)**:
Ação de UI no fluxo pós-EXECUTED que não abre FSM de disputa; no MVP redireciona o cliente a canal de suporte humano. Auto-complete permanece ativo.
_Avoid_: dispute FSM; rejeitar EXECUTED; pausar auto-complete

**Sessão de upload de evidência**:
Fluxo create session → upload assinado → register path para fotos do `completion_criterion`, análogo a KYC/chat; órfãos limpos por janitor.
_Avoid_: upload direto sem sessão; reuso do bucket de fotos do pedido/chat

**Constantes operacionais de conclusão**:
Defaults seed de `platform_constants` para cardinalidade, evidência, retries de IA, lease de enrichment, batch claim, backoff e orphan TTL (ver decisão 23).
_Avoid_: hardcode sem constant

## Decisões registradas

| # | Decisão | Data |
|---|---------|------|
| 1 | **Gate de publicação (opção A):** após criar o pedido, o matching **não** inicia até o checklist de conclusão estar materializado (ou política de fallback terminal definida). Pedido permanece em processamento/enrichment; não é visível a prestadores nem dispara batches. Distinto do delay de 5 min do matching, que só aplica **depois** da prontidão. | 2026-08-04 |
| 2 | **Falha terminal da IA (opção B):** após esgotar retries, aplica template fallback (cascata serviço → categoria → global; decisão 19), origem `fallback_template`, libera prontidão. Sem publicar vazio; sem auto-cancel por falha de IA. | 2026-08-04 |
| 3 | **Mutabilidade do schema (opção A):** após materialização (IA ou fallback), o **schema do checklist é imutável**. Cliente e prestador só leem o schema; o prestador escreve **respostas/evidências** na transição para `EXECUTED`. Edição do schema na negociação (`todo.md`) fica **fora de escopo** deste domínio por agora. | 2026-08-04 |
| 4 | **Itens “não atendeu” (opção C):** `EXECUTED` é permitido com critérios `met=false` **somente se** cada um tiver justificativa + evidências exigidas; todos os critérios obrigatórios respondidos. Destino `EXECUTED`. Disputa stub. *(Justificativa/evidência modeladas no bloco `completion_criterion` — decisão 17.)* | 2026-08-04 |
| 5 | **Avaliação × confirmação (opção A):** na confirmação **manual**, o cliente **deve** avaliar no mesmo fluxo (revisar checklist → notas → confirmar → `COMPLETED` + `service_ratings`). Auto-complete por grace (~24h, `completed_by=system`) **não** exige rating; após auto-complete, rating permanece opcional enquanto `COMPLETED` (regras de submit/edit do matching). | 2026-08-04 |
| 6 | **Emenda pós-EXECUTED (opção A):** respostas/evidências do checklist são **imutáveis** após a transição para `EXECUTED`. Sem emenda pelo prestador no MVP; correção só via suporte/ops (fora de escopo). | 2026-08-04 |
| 7 | **Visibilidade (opção A):** schema do checklist legível pelo **cliente** desde a prontidão e por **prestadores com acesso ao pedido** (feed/detalhe/chat/proposta). **Respostas/evidências** só após `EXECUTED`, e apenas para o **cliente** e o **prestador contratado**. | 2026-08-04 |
| 8 | **Modelo de prontidão (opção B):** FSM **separada** de enriquecimento do pedido (`PENDING` → `RUNNING` → `READY`, com ramo de retry e fallback → `READY`). Matching **só bootstrapa** quando enrichment = `READY`. `service_requests.status` **não** é a fonte de verdade do gate. UI “em processamento” projeta o estado do enrichment. ADR-0001. | 2026-08-04 |
| 9 | **Janela temporal de EXECUTED:** date-only BRT; início = `scheduled_start_date`; fim efetivo = `coalesce(scheduled_end_date, scheduled_start_date)`; on-time até **fim efetivo + 1 dia**. | 2026-08-04 |
| 10 | **Após o grace (opção B):** `executed_late` permitido self-serve após o teto on-time; visível ao cliente; sem bloqueio hard no MVP. | 2026-08-04 |
| 11 | **Draft (opção B):** draft server-side enquanto `CONFIRMED`, invisível ao cliente; submit final valida + congela + `EXECUTED` atômico. | 2026-08-04 |
| 12 | **Confirmação + avaliação (opção A):** path manual em **uma TX/RPC** (`COMPLETED` + `service_ratings`). Auto-complete sem rating. | 2026-08-04 |
| 13 | **Cancel durante enrichment (opção A):** cancelamento do pedido **aborta** o enrichment; workers MUST NO-OP se SR cancelado; MUST NOT materializar checklist nem bootstrap matching. | 2026-08-04 |
| 14 | **Allowlist de blocos:** *superseded by #16–#17*. Originalmente yes_no/image_gallery; depois evidence_images; agora ver decisão 17. | 2026-08-04 |
| 15 | **Cardinalidade (opção A):** schema MUST ter entre **3 e 12** itens de critério (agora `completion_criterion`; bounds em `platform_constants`). `static_text` não conta. | 2026-08-04 |
| 16 | **Evidência fotográfica:** *parcialmente superseded by #17*. Não reusar `image_gallery` de intake; evidência embutida em `completion_criterion`. ADR-0002. | 2026-08-04 |
| 17 | **Unidade do item (opção B):** bloco **`completion_criterion`**. Allowlist: `completion_criterion` \| `static_text`. ADR-0003. | 2026-08-04 |
| 18 | **Evidência fotográfica obrigatória (opção D):** `met=false` → ≥1 foto + justificativa; `met=true` → só se `requires_evidence_when_met`; min 1 / max 5. | 2026-08-04 |
| 19 | **Templates de fallback (opção B):** cascata serviço → categoria → global; seed no deploy. | 2026-08-04 |
| 20 | **Cliente discorda sem disputa (opção B):** Disputa stub abre suporte; auto-complete segue; sem FSM. | 2026-08-04 |
| 21 | **Upload de evidência (opção A):** `completion_evidence_upload_sessions` (padrão KYC/chat); janitor de órfãos. | 2026-08-04 |
| 22 | **Cutover (dev reset):** banco será resetado; sem grandfather/backfill de SRs OPEN legados. Enrichment gate aplica a todos os pedidos pós-deploy. | 2026-08-04 |
| 23 | **Defaults operacionais (opção A):** criterion 3–12; evidence 1–5; AI attempts 3; lease 120s; batch 20; retry base 30s; orphan TTL 24h; auto-complete 24h. Support link via env/remote config. | 2026-08-04 |
| 24 | **Feature ownership (opção A):** `src/features/service-completion/` concentra enrichment UX, checklist fill, confirm+rating e APIs de app. RPCs `payment_*` permanecem no Postgres; `view-services` consome a public API. Matching bootstrap e payments monetários ficam nos domínios atuais. | 2026-08-04 |
