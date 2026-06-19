# Task Issues — Auditoria Thermos (codebase completo)

Tarefas derivadas da revisão de segurança/produção e da revisão de qualidade de código (Thermos). Ordenadas da **maior** para a **menor** prioridade.

Legenda de prioridade:

| Nível | Significado |
|-------|-------------|
| **P0** | Bloqueador de produção — corrigir antes de lançar |
| **P1** | Risco alto (segurança, custo, produto quebrado) |
| **P2** | Risco médio ou débito que afeta confiabilidade/manutenção |
| **P3** | Melhoria importante, menor urgência |
| **P4** | Higiene de código, baixo risco imediato |

Status: `[ ]` pendente · `[~]` em progresso · `[x]` concluído

---

## P0 — Bloqueador

### 1. IDOR de endereço na criação de pedido (request-quote)

- [x] **Área:** Segurança / Backend  
- **Arquivos:**
  - `supabase/functions/create-request-quote-order/index.ts`
  - `supabase/migrations/20260705218300_create_request_quote_order_idempotency.sql`
- **Problema:** Quando o cliente escolhe um endereço existente (`address.kind === "existing"`), o edge function repassa `addressId` para um RPC com **service role**, sem validar que o endereço pertence ao usuário que está criando o pedido. O RLS de `client_addresses` é bypassado. Qualquer caller capaz de criar pedidos (cliente logado ou guest com `userId` + e-mail correspondente) pode associar **endereço de outra pessoa** ao service request — vazamento de localização, dados errados, abuso.
- **Solução sugerida:** Antes de criar o pedido, validar no RPC (não só no edge handler):
  ```sql
  SELECT 1 FROM client_addresses
  WHERE id = p_address_id AND client_id = p_actor_user_id AND is_active
  ```
  Rejeitar com `42501` se não existir. Aplicar a mesma regra para endereços novos (já criados com `client_id` correto).
- **Resolução (2026-06-19):** Migration `20260712080000_create_request_quote_address_ownership_check.sql` — `create_request_quote_service_request` exige `p_address_id` e valida ownership + `is_active` antes do insert. pgTAP: `supabase/tests/platform/create_request_quote_address_ownership_test.sql`.

---

## P1 — Risco alto

### 2. Bypass de quota de push no fluxo SCHEDULED → QUEUED

- [ ] **Área:** Backend / Message Dispatcher  
- **Arquivos:**
  - `supabase/migrations/20260621100100_create_message_dispatcher_fsm_functions.sql`
- **Relacionado:** `todo.md` linha 91 (*"várias push scheduled viram queued ao mesmo tempo e não respeitam os limites"*)
- **Problema:** `message_dispatcher_activate_scheduled` move até **500** dispatches `SCHEDULED` para `PENDING_EVALUATION` e chama `evaluate_pending`. A contagem de quota diária inclui apenas `DELIVERED | QUEUED | PROCESSING | SCHEDULED` — **não** inclui `PENDING_EVALUATION`. Itens restantes são movidos em massa para `QUEUED` (até 500 por tick de cron). Muitas pushes adiadas podem disparar de uma vez, ignorando quota e cooldown.
- **Solução sugerida:** Incluir `PENDING_EVALUATION` na contagem de quota; ou processar `evaluate_pending` com lock por profile; ou limitar transições para `QUEUED` por profile por execução de cron.

---

### 3. `bypassLimits` controlável pelo cliente no message-dispatcher-ingest

- [x] **Área:** Segurança / Backend  
- **Arquivos:**
  - `supabase/functions/message-dispatcher-ingest/index.ts`
  - `supabase/functions/message-dispatcher-ingest/types.ts`
- **Problema:** A edge function aceita `bypassLimits: true` no body e repassa como `p_bypass_limits` ao RPC. Qualquer usuário autenticado pode enviar push/e-mail para si mesmo usando templates ativos, **pulando limites diários e cooldowns** da plataforma.
- **Solução sugerida:** Remover `bypassLimits` da API pública; hardcodar `false` no edge handler. Reservar bypass apenas para triggers internos/cron (service role direto, sem edge pública).
- **Resolução (2026-06-19):** Removido `bypassLimits` de `IngestDispatchBody`; edge handler sempre envia `p_bypass_limits: false`. Bypass continua disponível apenas via RPC/triggers internos (service role). Teste Deno atualizado em `ingest_handler_test.ts`.

---

### 4. reCAPTCHA desabilitado silenciosamente quando secret ausente

- [ ] **Área:** Segurança / Backend  
- **Arquivos:**
  - `supabase/functions/_shared/recaptcha.ts`
  - Consumidores: `create-request-quote-order`, signup, `verify-recaptcha`
- **Relacionado:** `todo.md` linha 39 (*"cadastro e criação de service requests não estão funcionando por conta da proteção"*)
- **Problema:** Se `RECAPTCHA_SECRET_KEY` não estiver configurada, a validação retorna `{ success: true, skipped: true }`. Deploy mal configurado em produção = **zero proteção contra bots** em cadastro e criação de pedidos.
- **Solução sugerida:** Fail closed em produção (`success: false` quando secret ausente). Adicionar health check / gate de deploy que exige `RECAPTCHA_SECRET_KEY` configurada.

---

### 5. Feed de trabalhos mostra jobs após prestador remover serviço oferecido

- [x] **Área:** Produto / Backend (Matching)  
- **Arquivos:**
  - `supabase/migrations/20260711110000_matching_feed_audit_rpcs.sql`
  - `supabase/migrations/20260712090000_matching_feed_batch_offered_service_check.sql`
- **Relacionado:** `todo.md` linha 91 (*"se o prestador tirar um serviço que ele presta ele continua vendo aquele serviço no feed?"*)
- **Problema:** O braço **batch** do feed faz join com `service_request_provider_visibility` (snapshot no dispatch) mas **não** verifica `provider_offered_services`. O braço fallback já faz esse join. Prestador remove um serviço da conta mas continua vendo oportunidades daquele serviço no feed.
- **Solução sugerida:** Adicionar ao braço batch:
  ```sql
  EXISTS (
    SELECT 1 FROM provider_offered_services pos
    WHERE pos.provider_id = p_provider_id AND pos.service_id = sr.service_id
  )
  ```
  Alternativa: revogar visibilidade de batch quando serviço oferecido for removido (trigger ou RPC de delete).
- **Resolução (2026-06-19):** Migration `20260712090000_matching_feed_batch_offered_service_check.sql` — join em `provider_offered_services` no braço batch de `list_provider_opportunities` e em `matching_provider_has_opportunity_access`. pgTAP: `list_provider_opportunities_batch_offered_service_test.sql`.

---

## P2 — Risco médio

### 6. Feed de trabalhos inclui oportunidades com chat ACTIVE vazio

- [ ] **Área:** Produto / Backend (Matching)  
- **Arquivos:**
  - `supabase/migrations/20260711110000_matching_feed_audit_rpcs.sql`
- **Relacionado:** `todo.md` linha 90 (*"na tela de trabalhos está mostrando trabalhos dos quais eu já tenho chat ativo"*)
- **Problema:** A exclusão por chat ativo exige que exista **pelo menos uma mensagem** no chat. Se o prestador abriu conversa (`cns_initiate_conversation`) mas ainda não enviou mensagem, o job continua aparecendo em Trabalhos.
- **Solução sugerida:** Excluir quando existir chat `ACTIVE` entre provider e service request, **independente** de haver mensagens. Ou excluir imediatamente após `cns_initiate_conversation`.

---

### 7. Autenticação de pedido guest baseada só em e-mail (sem prova de posse)

- [ ] **Área:** Segurança / Backend  
- **Arquivos:**
  - `supabase/functions/create-request-quote-order/validateRequestUser.ts`
- **Problema:** Fluxo não autenticado aceita `userId` + `email` correspondente via `auth.admin.getUserById`, sem magic link, OTP ou sessão. Se `userId` vazar (logs, URL, client-side), atacante pode criar pedidos em nome da vítima. Combina mal com o IDOR de endereço (tarefa 1).
- **Solução sugerida:** Exigir sessão autenticada para criar pedidos; ou token de verificação de e-mail no fluxo guest/resume.

---

### 8. Rate limiter de edge functions falha aberto em erro de DB

- [x] **Área:** Segurança / Backend  
- **Arquivos:**
  - `supabase/functions/_shared/rateLimiter.ts`
  - `supabase/migrations/20260712100000_platform_check_rate_limit_rpc.sql`
  - `create-request-quote-order`, `chat-upload-media`, `generate-smart-description` (fail-closed)
- **Problema:** Em falha ao criar client service role ou em erro de query, retorna `allowed: true`. Sob stress ou misconfig do DB, `generate-smart-description`, `create-request-quote-order` e `chat-upload-media` perdem proteção de rate limit — abuso e custo.
- **Solução sugerida:** RPC atômico increment-or-reject; opção fail-closed configurável por função (especialmente funções com custo: AI, upload).
- **Resolução (2026-06-19):** RPC `platform_check_rate_limit` (SELECT FOR UPDATE atômico). `rateLimiter.ts` usa RPC; `failClosed: true` em order, upload e AI. `list-provider-opportunities` mantém fail-open. Testes: pgTAP + Deno `rateLimiter_test.ts`.

---

### 9. Verificação NSFW de fotos só no cliente (request-quote)

- [ ] **Área:** Segurança / Produto  
- **Arquivos:**
  - `src/features/request-quote/utils/photoContentCheck.ts`
  - `supabase/functions/create-request-quote-order/uploadPhotos.ts`
- **Relacionado:** `todo.md` linha 31 (*"erros de upload de imagens"*)
- **Problema:** `checkPhotosContent` roda nsfwjs no browser. O edge function valida apenas magic bytes, não conteúdo. Chamadas diretas à edge function bypassam o gate NSFW.
- **Solução sugerida:** Moderação server-side; ou rejeitar uploads sem attestation token de check confiável emitido pelo cliente após validação.

---

### 10. Supabase client usado fora da camada `api/` (hooks e utils)

- [x] **Área:** Arquitetura / Convenção  
- **Arquivos:**
  - `src/features/chats/hooks/useInboxRealtime.ts`
  - `src/features/chats/hooks/useConversationRealtime.ts`
  - `src/features/chats/hooks/useConversationTypingPresence.ts`
  - `src/features/my-account/hooks/usePortfolioItems.ts`
  - `src/features/my-account/hooks/useProfilePhotoMutation.ts`
  - `src/features/my-account/hooks/useProfileImageUrl.ts`
  - `src/features/request-quote/hooks/useServiceRequestPhotoUrls.ts`
  - `src/features/device-beacon/utils/locationSync.ts`
- **Problema:** Realtime, storage e beacon sync importavam `@/lib/supabase/client` diretamente em hooks/utils, violando a regra `api-layer`. RLS ainda se aplica, mas queries ficavam fora de validação centralizada, logging e testes da camada API. `locationSync.ts` postava direto em `/rest/v1/user_device_beacons`.
- **Solução aplicada:** `chats/api/realtime.api.ts` (subscribe/remove/presence channels); storage com client interno em `profileImageStorage.api.ts`, `portfolioImageStorage.api.ts` e `request-quote/api/serviceRequestPhotoStorage.api.ts`; fallback HTTP Android em `device-beacon/api/deviceBeaconHttp.api.ts`. Hooks/utils apenas orquestram.

---

### 11. Constantes de plataforma legíveis por qualquer usuário autenticado

- [ ] **Área:** Segurança / Backend  
- **Arquivos:**
  - `supabase/migrations/20260706000000_harden_rls_security_audit_fixes.sql` (grants em `platform_constant_int` / `platform_constant_bool`)
- **Problema:** Thresholds de matching, limites de dispatch, configs de rate limit expostos a todo usuário logado — intel competitivo e facilita tuning de abuso.
- **Solução sugerida:** Restringir RPCs de constantes a roles que precisam; ou expor subconjunto sanitizado para o app.

---

### 12. Acoplamento chats ↔ negotiation-proposals via imports internos

- [x] **Área:** Arquitetura  
- **Arquivos:**
  - `src/features/chats/components/ChatsLayout/ChatsConversationRoute.tsx`
  - `src/features/chats/hooks/useProposalTimelineHydration.ts`
- **Problema:** `ChatsConversationRoute` importava 12+ símbolos de internals de `negotiation-proposals` (`api/proposals.api`, dialogs, hooks, types, utils) apesar de `negotiation-proposals/index.ts` exportar quase tudo. Mesmo padrão em `useProposalTimelineHydration`.
- **Solução aplicada:** Imports cross-feature via `@/features/negotiation-proposals`; `buildDateUnavailableRevisionInitialValues` exportado na Public API; estado e handlers de dialogs extraídos para `useChatProposalDialogs` (~120 linhas a menos no route component).

---

### 13. Frontend importa paths de `supabase/functions/`

- [x] **Área:** Arquitetura  
- **Arquivos:**
  - `src/features/view-services/utils/suggestedItemsMapper.ts`
  - `src/features/view-services/constants/serviceDetail.constants.ts`
  - `src/features/request-quote/types/request-quote.types.ts`
  - `src/features/provider-jobs/types/provider-jobs.types.ts`
- **Problema:** Código do app importava types/constants de pastas de edge functions Deno (ex.: `generate-smart-description/allowedValues.ts`, `list-provider-opportunities/types`). Acopla bundle Vite ao layout Deno e quebra fronteiras de feature.
- **Solução aplicada:** Contratos em `src/lib/contracts/` (`generate-smart-description/`, `list-provider-opportunities/`); frontend via `@/lib/contracts/...`; Edge via alias Deno `@orbit/contracts/`; re-exports finos nas pastas das functions. Regra Cursor `shared-contracts.mdc`.

---

### 14. God hook `useChatMessages` (~749 linhas)

- [ ] **Área:** Arquitetura / Manutenibilidade  
- **Arquivos:**
  - `src/features/chats/hooks/useChatMessages.ts`
  - `src/features/chats/hooks/__tests__/useChatMessages.test.ts` (~574 linhas)
- **Problema:** Um único hook concentra: infinite query, sends otimistas, idempotency map, preview de imagem, upload de imagem/áudio, fila de envio, gap-fill refetch, 6+ helpers de patch de cache, 15+ `useCallback`s. Difícil testar, estender e revisar.
- **Solução sugerida:** Dividir em unidades composáveis: `useChatMessageQuery`, `useChatOptimisticSend`, `useChatMediaSend`. Manter `useChatMessages` como fachada fina. Fazer **depois** da tarefa 12 (imports) e usar teste existente como rede de segurança.

---

## P3 — Melhorias importantes

### 15. Duplicação client/provider nos service cards

- [ ] **Área:** Arquitetura / DRY  
- **Arquivos:**
  - `src/features/my-services/utils/clientServiceCardPresentation.ts` (~500 linhas)
  - `src/features/my-services/utils/providerServiceCardPresentation.ts` (~464 linhas)
  - `src/features/my-services/utils/clientServiceCardTheme.ts`
  - `src/features/my-services/utils/providerServiceCardTheme.ts`
- **Problema:** Hierarquias de tipos paralelas (`ClientCard*` vs `ProviderCard*`), maps Tailwind idênticos (`PHASE_BADGE`, `PHASE_INFO`) em ambos os themes, imports compartilhados de formatters de `view-services`.
- **Solução sugerida:** Extrair `buildServiceCardPresentation(service, role)` com branches por role; unificar tokens em `serviceCardTheme.ts`. Reduz ~900 linhas para ~400 compartilhadas + adaptadores finos.

---

### 16. Public API incompleta de `provider-profile`

- [ ] **Área:** Arquitetura  
- **Arquivos:**
  - `src/features/provider-profile/index.ts`
  - Consumidores: `ClientServiceListCard.tsx`, `ProviderServiceListCard.tsx`, `BudgetCompareProviderHeader.tsx`, `ChatDetailsParticipantRow.tsx`
- **Problema:** Hook `usePublicProfileImageUrl` é testado mas **não** exportado do barrel. Quatro call sites importam `@/features/provider-profile/hooks/usePublicProfileImageUrl` diretamente.
- **Solução sugerida:** Exportar `usePublicProfileImageUrl` (e `useProviderPublicProfile` se aplicável) em `index.ts`; corrigir os 4 call sites.

---

### 17. `my-services` ignora barrel de `view-services`

- [x] **Área:** Arquitetura  
- **Arquivos:** `src/features/my-services/utils/*ServiceCard*.ts`
- **Problema:** Imports profundos (`@/features/view-services/types/`, `utils/formatDate`, etc.) apesar de `view-services/index.ts` já exportar `ServiceModel`, `formatServiceDate`, `formatLocationDisplay`, `getServiceRequestBudgetActionState`, `mapRpcServiceRow`.
- **Solução aplicada:** Imports via `@/features/view-services` e `@/features/negotiation-proposals`; exports adicionados ao barrel (`StatusBadgeVariant`, `getScheduleHighlightContent`, `getScheduledTiming`).

---

### 18. `PortfolioManagementSection` — monólito de UI (~671 linhas)

- [ ] **Área:** Arquitetura  
- **Arquivos:** `src/features/my-account/components/PortfolioManagementSection.tsx`
- **Problema:** DnD sortable, dialogs create/edit/delete, subcomponentes que chamam `getPortfolioImageSignedUrl` direto com `useEffect` + `Promise.all`. Lógica de signed URLs deveria estar em hook.
- **Solução sugerida:** Extrair `usePortfolioImageUrls(paths)`; dividir em `PortfolioItemList`, `PortfolioItemFormDialog`, `SortablePortfolioItem`.

---

### 19. Formulários de signup quase duplicados (~520 linhas cada)

- [ ] **Área:** Arquitetura / DRY  
- **Arquivos:**
  - `src/features/auth/components/ClientSignup/ClientSignupForm.tsx`
  - `src/features/auth/components/ProviderSignup/ProviderSignupForm.tsx`
- **Problema:** Imports idênticos, arrays `INPUT_CLASS`/`CONFIRM_STEPS`, UI de força de senha, estrutura de wizard duplicados. Lógica já está corretamente nos hooks (`useClientSignupForm` / `useProviderSignupForm`).
- **Solução sugerida:** Extrair componentes compartilhados: `SignupWizardShell`, `PasswordStrengthFields`, `EmailConfirmSteps`. Manter campos específicos por role separados.

---

### 20. `ServiceAreaField` — lógica de negócio no componente (~555 linhas)

- [ ] **Área:** Arquitetura  
- **Arquivos:** `src/features/my-account/components/ServiceAreaField.tsx`
- **Problema:** `useQuery` para busca de cidade + resolução de bairro, debounce, branching desktop popover vs mobile sheet, helper `groupByCity` — tudo no componente.
- **Solução sugerida:** Extrair `useServiceAreaSelection(form)`; componente renderiza apenas UI do picker.

---

### 21. `src/lib/` importa internals de features

- [ ] **Área:** Arquitetura  
- **Arquivos:**
  - `src/lib/sentry.ts` → `chats/utils/sentryChatScrubbing`
  - `src/lib/capacitor/audioRecorder.ts` → `chats/utils/chatAudioConstants`, `chatAudioValidation`
- **Problema:** Viola isolamento de features (compartilhado deveria ir para `src/lib/` ou public API da feature). Chats `index.ts` já re-exporta scrubbing utils.
- **Solução sugerida:** Importar de `@/features/chats` em `sentry.ts`. Re-exportar constantes/validação de áudio na public API de chats ou mover helpers compartilhados para `src/lib/media/`.

---

### 22. Sprawl de migrations e arquivos SQL gigantes

- [ ] **Área:** Backend / DevEx  
- **Arquivos:** 209 arquivos em `supabase/migrations/`
- **Problema:** Vários arquivos >500 linhas (ex.: `20260621100100_create_message_dispatcher_fsm_functions.sql` ~1969, `20260708120000_remove_domain_events_from_mutation_rpcs.sql` ~1684). Domínio matching adicionou 20+ migrations em curto período. `db:reset` e modelo mental pesados.
- **Solução sugerida:** Continuar consolidando conforme regra do projeto (editar originais em dev); adicionar `supabase/migrations/README.md` mapeando grupos → features; considerar squash pré-release.

---

### 23. Router bypassa feature barrels (code-splitting)

- [ ] **Área:** Arquitetura (tradeoff documentado)  
- **Arquivos:** `src/router.tsx`
- **Problema:** Lazy routes importam paths profundos (`@/features/my-services/components/...`) em vez de barrels, para Rollup dividir chunks por tela. Padrão pode se espalhar para código de app.
- **Solução sugerida:** Aceitar tradeoff no router; adicionar ESLint `no-restricted-imports` para código de app (exceto `router.tsx`); ou subpath exports no Vite por tela.

---

### 24. Test bloat e enforcement fraco de public API

- [ ] **Área:** Qualidade / Testes  
- **Arquivos:**
  - `src/features/negotiation-proposals/hooks/__tests__/useServiceRequestProposalComposer.test.ts` (~947 linhas)
  - `src/features/chats/hooks/__tests__/useChatMessages.test.ts` (~574 linhas)
  - Único `publicApi.test.ts`: `provider-jobs`
  - Outliers fora de `__tests__/`: `device-beacon/hooks/useProviderLocationTracking.test.ts`, `view-services/hooks/useRecordProviderOpportunityView.test.ts`
- **Problema:** Testes de hook gigantes mockam módulos inteiros; apenas uma feature valida contrato do barrel em CI.
- **Solução sugerida:** Dividir testes grandes por comportamento (`pricing`, `photo upload`, `submit`); adicionar `publicApi.test.ts` em `chats`, `negotiation-proposals`, `view-services`; mover testes avulsos para `__tests__/`.

---

## P4 — Higiene / baixa urgência

### 25. CORS allowlist vazia quando `ALLOWED_ORIGINS` não configurado

- [ ] **Área:** DevEx / Deploy  
- **Arquivos:** `supabase/functions/_shared/cors.ts`
- **Problema:** Sem `Access-Control-Allow-Origin` se origin não estiver na allowlist. Default seguro, mas misconfig silenciosa quebra clientes browser.
- **Solução sugerida:** Checklist de deploy para `ALLOWED_ORIGINS`; log de warning no cold start se vazio em produção.

---

### 26. Endpoint público `verify-recaptcha` (`verify_jwt = false`)

- [ ] **Área:** Segurança  
- **Arquivos:**
  - `supabase/functions/verify-recaptcha/index.ts`
  - `supabase/config.toml`
- **Problema:** Validação de token reCAPTCHA acessível sem JWT — oracle de validação; vetor menor de abuso se rate limits falharem aberto.
- **Solução sugerida:** Exigir sessão ou amarrar ao mesmo bucket de rate limit da ação pai (signup, order).

---

### 27. `generate-smart-description` callable com JWT anon (exposição de custo)

- [ ] **Área:** Segurança / Custo  
- **Arquivos:** `supabase/functions/generate-smart-description/index.ts`
- **Problema:** `verify_jwt = true` mas anon key satisfaz; `userId` só usado para rate limit, não obrigatório. Abuso de custo AI com sessões anon rotativas + rate limiter fail-open.
- **Solução sugerida:** Exigir usuário autenticado; limites mais rígidos por IP; fail closed.

---

### 28. Rate limiter TOCTOU (~1 request extra por janela)

- [ ] **Área:** Segurança (soft limit)  
- **Arquivos:** `supabase/functions/_shared/rateLimiter.ts`
- **Problema:** Race documentada no header do módulo; aceitável para soft limits, inadequado para fronteiras de segurança duras.
- **Solução sugerida:** RPC upsert atômico se limites virarem security-critical (ver também tarefa 8).

---

### 29. Maturidade desigual entre features / módulos stub

- [ ] **Área:** Arquitetura  
- **Arquivos:**
  - `src/features/notifications/` (3 arquivos, só `recordPushClick`)
  - `src/features/my-account/index.ts` (exporta só `MyAccountPage`)
  - `src/features/auth/index.ts` (superfície pública muito ampla — exporta APIs diretamente)
- **Problema:** Disciplina de public API varia: `chats`/`negotiation-proposals` exemplares; `my-account`/`notifications` mínimos. `notifications` candidato a merge.
- **Solução sugerida:** Template padronizado de public API (comment block + `publicApi.test.ts`); fundir `notifications` em `push-permission` ou `chats` até crescer.

---

## Sequência recomendada de execução

Ordem sugerida para corrigir **todos** os pontos com menor risco de regressão:

| Fase | Tarefas | Tipo |
|------|---------|------|
| **1 — Segurança imediata** | 1, 3, 4 | P0 + P1 rápidos |
| **2 — Produto / dispatcher** | 2, 5, 6 | P1 + P2 matching/todo |
| **3 — Segurança complementar** | 7, 8, 9, 11, 25–28 | P2/P3 security |
| **4 — Imports sem mudança de comportamento** | 12, 16, 17, 21 | Arquitetura rápida |
| **5 — Extrações focadas** | 18, 19, 20, extrair `useChatProposalDialogs` (parte de 12) | Refactors médios |
| **6 — Contratos compartilhados** | 13 | Desacoplar app ↔ edge functions |
| **7 — Camada API** | 10 | Realtime/storage/beacon |
| **8 — Deduplicação maior** | 15, 14 | Cards + split `useChatMessages` |
| **9 — Higiene backend/testes** | 22, 23, 24, 29 | DevEx + CI guards |

---

## O que já está em bom estado (não requer tarefa)

- Feature folders (`api/`, `hooks/`, `components/`, `types/`, `utils/`, `index.ts`) aplicados consistentemente
- **Zero** imports diretos de Supabase em **components**
- ~365 arquivos de teste, majoritariamente co-localizados
- Edge functions modulares (`handleRequest.ts`, `parseBody.ts`, `__tests__/`)
- Auth em `list-provider-opportunities` (JWT, `providerId = user.id`, role/suspension)
- `chat-upload-media`: session RPC + magic bytes
- `message-dispatcher-worker`: secret header + timing-safe compare
- Matching dispatch tables: RLS deny-all; RPCs service_role-only
- Idempotency em chat sends e order creation
- Bloqueio de escalação de role admin (`profiles_block_admin_role_update`)

---

*Gerado a partir da auditoria Thermos (revisão de segurança + revisão de qualidade de código). Atualizar status `[ ]` → `[~]` → `[x]` conforme tarefas forem concluídas.*
