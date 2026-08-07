# Meus Serviços (cliente e prestador)

Documentação baseada em `src/features/my-services/`, com dados e detalhe em `view-services`, sheet de orçamentos em `negotiation-proposals`, pagamento manual em `payments` e banner/rota de calendário em `provider-calendar`.

---

## 1. Resumo executivo

Lista unificada **Meus Serviços** em `/dashboard/services`: o cliente acompanha pedidos solicitados (filtros, deep link, sheet de orçamentos, cancelamento, ajuste de pagamento); o prestador acompanha propostas e serviços (mesmos filtros, CTAs de chat/mapa/proposta, banner para calendário). A UI é escolhida por `profile.role` via persistent slots no `DashboardLayout`; o outlet da rota (`MyServicesRouteSlot`) não renderiza conteúdo.

## 2. Objetivo de negócio

- Dar uma visão operacional contínua do funil pós-pedido (cliente) e pós-proposta (prestador).
- Encaminhar ações críticas sem sair do hub: comparar orçamentos, abrir chat, detalhe, calendário, pagamento falhou.
- Reduzir atrito de deep link: `?serviceRequestId=` foca um pedido na lista do cliente.

## 3. Localização na plataforma

| Superfície | Path / entry | Observação |
|------------|--------------|------------|
| Lista | `/dashboard/services` | Menu “Meus Serviços” (`dashboardMenu.ts`); chrome mobile **tab-root** |
| Detalhe | `/dashboard/services/:id` | `ServiceDetailShell` (`view-services`); sheet se state de my-services |
| Calendário prestador | `/dashboard/services/calendar` | `ProviderCalendarPage`; stack mobile título “Calendário”; **não** é pasta `my-services`, mas entrada via banner |
| Deep link cliente | `/dashboard/services?serviceRequestId=<uuid>` | `SERVICE_REQUEST_FOCUS_QUERY`; helper `getMyServicesPageUrlWithFocus` |
| CTA novo pedido (cliente) | `/pedir-orcamento` | Header desktop + FAB mobile |
| Empty prestador | `/dashboard/jobs` | “Ver trabalhos” |
| Showcase cards (DEV) | Rotas lazy de showcase em `router.tsx` | Fora do fluxo produto |

**Persistent slots:** `ClientMyServicesPersistentSlot` / `ProviderMyServicesPersistentSlot` mantêm a lista montada ao abrir detalhe em sheet (`DashboardLayout`).

## 4. Perfis envolvidos

| Perfil | Usa esta feature? | Quem não usa |
|--------|-------------------|--------------|
| `client` | Sim — página cliente | — |
| `provider` | Sim — página prestador + banner calendário | — |
| Visitante | Não | Redirecionado por `ProtectedRoute` |
| `admin` | Sem superfície dedicada no router | — |

## 5. Fluxo funcional principal

```mermaid
flowchart TD
  A[/dashboard/services] --> B{profile.role}
  B -->|client| C[ClientMyServicesPersistentSlot]
  B -->|provider| D[ProviderMyServicesPersistentSlot]
  C --> E[ClientMyServicesPage]
  D --> F[ProviderMyServicesPage]
  E --> G[MyServicesPageShell]
  F --> G
  F --> H[ProviderCalendarEntryBanner]
  H --> I[/dashboard/services/calendar]
  G --> J[useMyServicesPageCore]
  J --> K[useServicesList / list_services]
  E --> L[ReceivedBudgetDetailsSheet]
  E --> M[ManualPaymentDialog se FAILED_PERMANENT]
  F --> N[ProviderServiceProposalDialogs]
  G --> O[/dashboard/services/:id]
```

## 6. Fluxos alternativos e exceções

| Fluxo | Comportamento |
|-------|---------------|
| Deep link inválido / pedido ausente | Banner: “Não encontramos esse pedido…” + botão “Ver todos os serviços” |
| Sheet de orçamentos aberto | `document.body` / `html` overflow `hidden` enquanto aberto |
| Cancelar pedido | Só se `requestStatus === "OPEN"` (ação no card); RPC via `useCancelService` |
| Chat sem `chatSummary.id` | CTA chat desabilitado: “Conversa ainda não disponível…” |
| Pagamento sem `contractedServiceId` | Toast: “Não foi possível carregar o pagamento deste serviço.” |
| Erro ao carregar schedule do modal | Fecha modal + mesmo toast de erro |
| Erro de lista | `MyServicesErrorState` + “Tentar novamente” |
| Filtros ativos sem resultados | `MyServicesNoFilterResultsState` + limpar filtros |
| Lista vazia sem filtros | Empty state por papel (cliente → pedir orçamento; prestador → trabalhos) |
| Aba Disputas | Sempre vazia de dados (`tabIncludesStatus` false) |
| Prestador — revisar sem `myProposal.id` | `openReviseProposal` / `openViewProposal` no-op |

## 7. Regras de negócio (numeradas)

1. **Papel define a página:** `profile.role === "provider"` → prestador; caso contrário (com perfil) → cliente (`MyAccount`/`slots` equivalentes em my-services).
2. **Paginação:** 20 itens por página (`useServicesList`); “Carregar mais” via `fetchNextPage`.
3. **Busca:** debounce 300 ms antes de ir ao RPC (`SEARCH_DEBOUNCE_MS`).
4. **Fase / aba:** `statusTabIdToListPhase` — `all` e `dispute` → `p_list_phase` null / sem match; demais mapeiam 1:1.
5. **Foco (`serviceRequestId`):** conta como filtro ativo; limpar foco remove query; limpar filtros da barra também remove o focus query (cliente).
6. **Foco sincroniza aba:** `setStatusTabId(statusToTabId(focusedRequest.listPhase))` quando o item focado carrega.
7. **Scroll ao foco:** só quando loading terminou e `items.length === 1`; elemento `#service-request-{id}`.
8. **Sheet compare vs history:** `listPhase === "negotiation"` → `compare`; senão → `history` (`getServiceRequestBudgetSheetMode` em `view-services`).
9. **Labels do CTA de orçamentos:** 1 proposta → “Ver orçamento” / “Ver histórico”; >1 → “Comparar orçamentos” / “Histórico de orçamentos”; desabilitado se `proposalCount <= 0`.
10. **Cancelar no card:** apenas negociação com `requestStatus === "OPEN"` (secundário “Cancelar pedido”).
11. **Ajustar pagamento:** `listPhase` in_progress + `contracted.status === PENDING_PAYMENT` + `paymentScheduleState === FAILED_PERMANENT` → CTA primário; prioridade sobre unread.
12. **Destaque pagamento (cliente):** em `FAILED_PERMANENT`, alerta de falha prevalece sobre unread; nos demais `PENDING_PAYMENT`, unread sobrescreve o destaque de pagamento.
13. **Destaque pagamento (prestador):** unread sobrescreve pagamento; se não unread e `PENDING_PAYMENT` → destaque “Aguardando pagamento do cliente”.
14. **Follow-up de conclusão no card (`in_progress`):** usa só dados de `list_services` / `ServiceModel` (`contracted.status`, `scheduledStartDate` / `scheduledEndDate` via `getScheduledTiming`; end null ou dia inteiro → end = start; `past` = rangeEnd &lt; hoje). **Prestador:** `CONFIRMED` + past → banner “Marque o serviço como executado” (+ detalhe pedindo evidências); primário **“Concluir serviço”** (`intent: mark_executed`) abre sheet/dialog no card via `ProviderMarkExecutedSheet` (hospedado em `ProviderMarkExecutedDialogs` + `useProviderMarkExecutedDialog`); contexto RPC só ao abrir o wizard; se `enrichmentReady` for false, o botão fica disabled com tooltip (“Checklist de conclusão ainda não está pronto”); secundário “Ver detalhes”. `EXECUTED` → “Aguardando confirmação do cliente” (primário “Ver detalhes”). **Cliente:** `CONFIRMED` + past → “Aguardando conclusão do prestador” (primário “Ver detalhes”); `EXECUTED` → “Aceite a conclusão e avalie o serviço” (ênfase `attention`); primário **“Avaliar serviço”** (`intent: evaluate_service`) abre sheet/dialog via `ClientEvaluateServiceSheet` (Public API de `service-completion`) hospedado na página (`ClientEvaluateServiceDialogs` + `useClientEvaluateServiceDialog`), mesmo padrão do prestador com mark-executed; contexto RPC só ao abrir o wizard; secundário “Ver detalhes”. Sem prefetch de `get_service_completion_context` na lista.
15. **Rating opcional no card `completed` (cliente):** se `contracted.status === COMPLETED` e `clientRatingOverallScore == null` (campo já no `ServiceModel` de `list_services` — sem request extra), primário **“Avaliar serviço”** (`intent: evaluate_service`); secundário “Ver detalhes”; o host (`ClientEvaluateServiceDialogs`) abre com `ratingOnly` (só etapa de notas; título “Avaliar serviço (opcional)”). Se já houver rating, só “Ver detalhes” (comportamento anterior).
16. **Prioridade do highlight `in_progress`:** unread e pagamento pendente **vencem** o banner de follow-up de conclusão; só então agenda (“Agendado para…” / “Serviço hoje”) se não houver follow-up.
17. **Urgência no card:** badge/urgência visual só se `urgency === "high"` (`showUrgency`).
18. **Proposta expirando (prestador):** `expiredAt` dentro de 3 dias e ainda no futuro → sufixo “Expira em breve” / ênfase attention.
19. **Banner calendário:** apenas na página do prestador; link para `ROUTE_PROVIDER_CALENDAR` (`/dashboard/services/calendar`).
20. **Portfólio de CTAs do card:** no máximo 2 ações (primary + secondary); detalhes sempre disponíveis como fallback em vários ramos.
21. **Categoria no filtro:** valor selecionado é o **título** do serviço enviado como `p_category_title`.
22. **staleTime da lista:** 60 s; `refetchOnWindowFocus: false`.
23. **Invalidação pós-pagamento manual / proposta:** invalida `SERVICES_LIST_QUERY_KEY` (e chaves de payment/proposal conforme hook).

## 8. Campos e dados (inputs / shape)

Não há formulário de criação nesta feature. Filtros locais:

| Campo de UI / estado | Tipo | Envio RPC (via `listServices`) |
|----------------------|------|--------------------------------|
| Busca | string (debounced) | `p_search` |
| Aba status | `StatusTabId` | `p_list_phase` (null se all/dispute) |
| Categoria | título string \| null (`categoryId` no state) | `p_category_title` |
| Cidade | string \| null | `p_city_name` |
| Bairro | string \| null | `p_neighborhood` |
| Data de / até | string \| null | `p_date_from` / `p_date_to` |
| Com orçamentos/proposta | boolean \| null | `p_has_proposals` |
| Com imagens | boolean \| null | `p_has_images` |
| Foco | UUID \| null | `serviceRequestId` → listagem focada |

Labels de “com propostas”: cliente **“Com orçamentos recebidos”**; prestador **“Com proposta enviada”**.

Modelo de card: `ServiceModel` (`view-services`) — título, fase, endereço, contracted, myProposal, chatSummary, contadores de proposta/chat, etc.

## 9. Validações de front-end

- Filtros: sem Zod; selects nativos e toggles booleanos.
- Ações: guards de disabled (chat sem id; orçamentos com count 0; mapa sem coordenadas).
- Pagamento manual: exige `contractedServiceId`; schedule só fetch com modal aberto.
- Prestador revise/view: exige `myProposal.id`.

## 10. Validações de back-end (RPC, RLS, Edge)

Delegadas a `view-services` / migrations:

- `list_services` / `get_service` — escopo por `auth.uid()` + papel.
- `cancel_service_request` — cancelamento do cliente.
- Sheet: RPC de compare/histórico em `negotiation-proposals` (ver doc do sheet).
- Pagamento: `usePaymentSchedule` / fluxos `payment_*` + Edge de cobrança (ver `payments`).

**Evidência parcial neste módulo:** my-services não encapsula SQL; regras de elegibilidade de cancelamento/pagamento estão no backend consumido.

## 11. Status, estados e transições

| `listPhase` / aba | UI |
|-------------------|-----|
| `negotiation` | Cards de negociação; sheet **compare** |
| `in_progress` | Agenda / pagamento / chat / follow-up de conclusão (pós-data-fim ou `EXECUTED`) |
| `completed` | Concluído; cliente sem rating → primário **“Avaliar serviço”** + secundário “Ver detalhes”; com rating → só “Ver detalhes” |
| `cancelled` | Cancelado; CTA só detalhes |
| `dispute` (aba) | Sem itens |
| `all` | Todas as fases |

Transições de domínio (OPEN → contratado → etc.) **não** são feitas nesta feature além de cancelar (cliente) e side-effects via dialogs/sheet/detalhe.

## 12. Persistência

| Camada | O quê |
|--------|--------|
| Servidor | Pedidos, contratos, propostas, chats (via RPCs) |
| Cliente | Estado de filtros/busca em memória (não Preferences); TanStack Query cache lista (`SERVICES_LIST_QUERY_KEY`, stale 60s) |
| URL | `serviceRequestId` no cliente |

## 13. Integrações

| Integração | Papel |
|------------|-------|
| `view-services` | Lista, detalhe path, cancel, budget helpers, modal detail state |
| `negotiation-proposals` | Sheet cliente; getProposalDetail / composer / details dialogs prestador |
| `chats` | `getChatsPageUrlWithServiceRequestFilter`; `/dashboard/chats/:chatId` |
| `payments` | `ManualPaymentDialog`, `usePaymentSchedule`, `PAYMENT_SCHEDULE_QUERY_KEY` |
| `provider-calendar` | Banner + rota calendar |
| `service-completion` | Prestador `CONFIRMED` + past: “Concluir serviço” no card abre `ProviderMarkExecutedSheet` (hospedado na página); cliente `EXECUTED` (fase `in_progress`) **ou** `COMPLETED` sem `clientRatingOverallScore` (fase `completed`): “Avaliar serviço” no card abre `ClientEvaluateServiceSheet` (hospedado na página; `ratingOnly` no path opcional); contexto RPC só ao abrir o wizard; CTAs equivalentes também no detalhe (`ProviderMarkExecutedAction` / `ClientEvaluateServiceAction`) |
| Maps | `openGoogleMaps` + `getServiceCoordinates` (prestador, serviço hoje) |

## 14. Listagens, buscas, filtros, paginação, ordenação

- **Lista:** infinite query, page size 20, botão carregar mais.
- **Busca:** texto livre debounced 300 ms.
- **Filtros avançados:** popover (desktop) / sheet (mobile) em `MyServicesFiltersBar`.
- **Opções de categoria/cidade/bairro:** uniques dos `items` atuais ordenados — **lacuna** se houver mais páginas.
- **Ordenação:** definida no RPC `list_services` (não reordenada no front desta feature).
- **Skeletons:** 4 cards (`SKELETON_COUNT`).

## 15. Ações disponíveis

### Cliente (`ClientServiceListCard` / presentation)

| Ação | Pré-condição | Resultado | Erro / disabled |
|------|--------------|-----------|-----------------|
| Ver detalhes | Sempre (ramos) | Navigate detalhe + state sheet | — |
| Comparar / ver orçamentos | `proposalCount > 0` | Abre `ReceivedBudgetDetailsSheet` | Disabled se count 0 |
| Ver mensagem(ns) | Unread | Chat direto ou lista chats filtrada | — |
| Cancelar pedido | `OPEN` e sem propostas/unread priorizados | `cancel_service_request` | `isCancelling` |
| Responder / ver conversa | in_progress | Chat | Sem `chatSummary.id` |
| Ajustar pagamento | `PENDING_PAYMENT` + `FAILED_PERMANENT` | `ManualPaymentDialog` | Toast se sem contracted id / erro schedule |
| Avaliar serviço (`evaluate_service`) | `EXECUTED` (fase `in_progress`, banner follow-up) **ou** `COMPLETED` + `clientRatingOverallScore == null` (fase `completed`; dados de `list_services`) | Abre sheet/dialog na página (`ClientEvaluateServiceSheet` via `ClientEvaluateServiceDialogs` + `useClientEvaluateServiceDialog`); em `COMPLETED` sem rating o host passa `ratingOnly`; RPC de contexto só ao abrir o wizard | — |
| Ver detalhes (follow-up `CONFIRMED` + past) | `CONFIRMED` + timing `past` — sem unread/pagamento prioritário | Detalhe (aguardar conclusão do prestador) | — |
| Ver detalhes | — (incl. secundário nos ramos `EXECUTED` e `completed` sem rating) | Detalhe sheet/página | — |
| Novo serviço | Header/FAB/empty | `/pedir-orcamento` | — |
| Limpar foco | Query focus | Remove `serviceRequestId` | — |

### Prestador (`ProviderServiceListCard`)

| Ação | Pré-condição | Resultado | Erro / disabled |
|------|--------------|-----------|-----------------|
| Responder / Ver conversa / Ver negociação | Chat disponível | `/dashboard/chats/:id` | Sem `chatSummary.id` |
| Ver proposta | Proposta PENDING/REVISED/hasPending | Dialog detalhes | — |
| Revisar proposta | `REVISION_REQUESTED` | Composer com proposta carregada | — |
| Abrir no mapa | Serviço **hoje** + coordenadas | Google Maps | Sem coordenadas |
| Concluir serviço (`mark_executed`) | `CONFIRMED` + timing `past` (banner follow-up; sem unread prioritário) | Abre sheet/dialog no card (`CompletionFlowSheetDialog` + `ProviderExecutedWizard`); RPC de contexto só ao abrir | Disabled + tooltip se `!enrichmentReady` |
| Ver detalhes (follow-up `EXECUTED`) | `EXECUTED` — sem unread prioritário | Detalhe (aguardar confirmação / evidências no host) | — |
| Ver detalhes | — (incl. secundário no ramo `CONFIRMED` + past) | Detalhe sheet/página | — |
| Ver calendário | Banner | `/dashboard/services/calendar` | — |
| Ver trabalhos | Empty state | `/dashboard/jobs` | — |

## 16. Dependências

- **Upstream de dados:** `view-services`, RPCs Supabase.
- **Downstream UI:** `negotiation-proposals`, `chats`, `payments`, `provider-calendar`, `provider-jobs`, `request-quote`.
- **Shell:** `DashboardLayout`, menu, mobile chrome (`services` tab-root; `services/calendar` stack; `services/:id` sheet/stack).

## 17. Regras implícitas

- `MyServicesRouteSlot` retorna `null` — a lista só aparece se o persistent slot estiver visível.
- `handleClearFilters` **não** reseta a aba de status nem a busca (só filtros da barra: categoria, cidade, bairro, datas, flags); no cliente, versão da página também limpa focus query.
- Prestador **não** tem deep link `serviceRequestId` no hook.
- Card concluído prestador: nota real `clientRatingOverallScore` (omitida se null).
- Card concluído cliente: sem rating → CTA “Avaliar serviço” (`ratingOnly`); com rating → só “Ver detalhes”.
- Motivos de cancelamento no card prestador: heurísticas de `myProposal` / status (`cancelReason`).
- Body scroll lock também no sheet de filtros mobile.
- CTA “Enviar orçamento” **não** aparece no card do prestador em negociação sem proposta — primário é “Ver negociação”.

## 18. Riscos

- Filtros derivados da página carregada podem omitir valores existentes no servidor.
- Doc legado do sheet (status `open`) pode divergir de `listPhase` — preferir código `serviceRequestBudgetAction.ts`.
- Dependência forte de enriquecimento RPC (`my_proposal`, `chat`, `payment_schedule_state`); se RPC atrasar, cards degradam.

## 19. Evidências

- `src/features/my-services/components/client/ClientMyServicesPage.tsx`
- `src/features/my-services/components/provider/ProviderMyServicesPage.tsx`
- `src/features/my-services/hooks/useClientMyServicesPage.ts`, `useProviderMyServicesPage.ts`, `useMyServicesPageCore.ts`, `useMyServicesList.ts`, `useClientCardManualPayment.ts`, `useClientMyServicesCancel.ts`, `useProviderServiceProposalDialogs.ts`, `useClientEvaluateServiceDialog.ts`, `useProviderMarkExecutedDialog.ts`
- `src/features/my-services/components/client/ClientEvaluateServiceDialogs.tsx`, `ClientServiceListCard.tsx`; `components/provider/ProviderMarkExecutedDialogs.tsx`
- `src/features/my-services/utils/clientServiceCardPresentation.ts`, `providerServiceCardPresentation.ts`, `clientServiceCardTheme.ts`, `pendingPaymentHighlight.ts`, `providerProposalStatus.ts`
- Timing de agenda: `getScheduledTiming` / `getScheduleHighlightContent` em `view-services` (`formatScheduledSummary.ts`)
- `src/features/my-services/constants/routes.ts`, `constants/statusTabs.ts`
- `src/features/view-services/hooks/useServicesList.ts`, `utils/serviceRequestBudgetAction.ts`
- `src/features/provider-calendar/components/ProviderCalendarEntryBanner.tsx`
- `src/router.tsx`, `src/layouts/DashboardLayout/*`

## 20. Pendências

| Item | Nota |
|------|------|
| Aba Disputas | Sem implementação de dados |
| Completude das opções de filtro | Só itens já paginados |
| Alinhar doc do sheet compare | Atualização cabe ao módulo chats/negotiation-proposals (fora deste escopo de edição forçada) |
| Showcase DEV | Não documentar como fluxo de negócio |

---

## Anexo A — Destaque `PENDING_PAYMENT` (copy)

| Papel / condição | Título | Descrição | Ênfase |
|------------------|--------|-----------|--------|
| Cliente — `FAILED_PERMANENT` | Pagamento falhou | Atualize suas informações de pagamento manualmente para confirmar o serviço. | `error` |
| Cliente — demais | Aguardando pagamento | Serviço agendado para {data}, pagamento ainda pendente. (fallback: “Pagamento ainda pendente.”) | `attention` |
| Prestador | Aguardando pagamento do cliente | Idem padrão com data / fallback | `attention` |

Ícone: `payment_pending` (cartão).

## Anexo B — Sheet compare / history (ponto de vista my-services)

- Componente: `ReceivedBudgetDetailsSheet` no footer do shell cliente.
- Estado: `useServiceRequestBudgetSheet` (`view-services`).
- Modo: `compare` se `listPhase === "negotiation"`; senão `history`.
- Documentação aprofundada do conteúdo do sheet: [comparar-orcamentos-meus-servicos.md](../../chats/features/comparar-orcamentos-meus-servicos.md).

## Anexo C — Banner calendário prestador

- Componente: `ProviderCalendarEntryBanner` (`@/features/provider-calendar`).
- Texto: “Ver calendário de serviços” / subtítulo sobre agenda por dia ou mês e turnos.
- Destino: `/dashboard/services/calendar` (`ROUTE_PROVIDER_CALENDAR`).
- Renderizado no header da `ProviderMyServicesPage` abaixo de `ProviderMyServicesHeader`.

## Anexo D — Highlight de follow-up de conclusão (`in_progress`)

Dados: `contracted.status` + `getScheduledTiming(scheduledStartDate, scheduledEndDate)` do `ServiceModel` (lista). Sem RPC extra.

| Papel | Condição | Título | Detalhe (resumo) | Ênfase | Primário | Secundário |
|-------|----------|--------|------------------|--------|----------|------------|
| Prestador | `CONFIRMED` + timing `past` | Marque o serviço como executado | Pedido de evidências de conclusão | `attention` | **Concluir serviço** (`mark_executed` → sheet no card; disabled + tooltip se `!enrichmentReady`) | Ver detalhes |
| Prestador | `EXECUTED` | Aguardando confirmação do cliente | Evidências enviadas; cliente confirma/avalia | `default` | Ver detalhes | (chat, se houver) |
| Cliente | `CONFIRMED` + timing `past` | Aguardando conclusão do prestador | Aguarda conclusão e evidências do profissional | `default` | Ver detalhes | — |
| Cliente | `EXECUTED` | Aceite a conclusão e avalie o serviço | Prestador enviou evidências; confirmar e avaliar | `attention` | **Avaliar serviço** (`evaluate_service` → sheet na página; contexto RPC só ao abrir o wizard) | Ver detalhes |

Prioridade: unread / pagamento pendente vencem este banner. Caso contrário, se não houver follow-up, mantém highlight de agenda (`getScheduleHighlightContent`: “Agendado para…”, “Serviço hoje”, etc.).

**Prestador `CONFIRMED` + past:** sheet/dialog hospedado na página (`ProviderMarkExecutedDialogs` + `useProviderMarkExecutedDialog` → `ProviderMarkExecutedSheet`); `get_service_completion_context` só ao montar o wizard. Evidência: `providerServiceCardPresentation.ts`, `ProviderServiceListCard.tsx`.

**Cliente `EXECUTED`:** sheet/dialog hospedado na página (`ClientEvaluateServiceDialogs` + `useClientEvaluateServiceDialog` → `ClientEvaluateServiceSheet`); contexto RPC só ao abrir o wizard (`ClientConfirmRatingWizard`). Evidência: `clientServiceCardPresentation.ts`, `ClientServiceListCard.tsx`.

**Nota — fase `completed`:** o CTA **“Avaliar serviço”** também aparece no card concluído quando `COMPLETED` + `clientRatingOverallScore == null` (rating opcional pós auto-complete; `ratingOnly`). Ver regra 15 e Anexo F — **não** confundir com o banner de follow-up deste anexo (só `in_progress` / `EXECUTED`).

## Anexo E — Checklist QA (cenários)

- [ ] Cliente: lista vazia → CTA pedir orçamento
- [ ] Cliente: foco válido / inválido / limpar
- [ ] Cliente: abas + carregar mais + erro de rede
- [ ] Cliente: compare (negociação) vs history (outras fases)
- [ ] Cliente: cancelar OPEN; FAILED_PERMANENT → ajustar pagamento
- [ ] Cliente: `CONFIRMED` + data fim passada → highlight “Aguardando conclusão do prestador”; primário Ver detalhes
- [ ] Cliente: `EXECUTED` → highlight “Aceite a conclusão e avalie…”; primário “Avaliar serviço” abre sheet na página; secundário “Ver detalhes”; contexto RPC só ao abrir o wizard
- [ ] Cliente: fase `completed` + `COMPLETED` sem `clientRatingOverallScore` → primário “Avaliar serviço” (`ratingOnly`); secundário “Ver detalhes”
- [ ] Cliente: fase `completed` com rating → só “Ver detalhes”
- [ ] Prestador: banner calendário → rota calendar (só provider)
- [ ] Prestador: revisar / ver proposta; mapa só “hoje” com coords
- [ ] Prestador: `CONFIRMED` + past → “Marque o serviço como executado”; primário “Concluir serviço” abre sheet no card; secundário “Ver detalhes”; `!enrichmentReady` → botão disabled + tooltip
- [ ] Prestador: `EXECUTED` → “Aguardando confirmação do cliente”; primário Ver detalhes
- [ ] Unread / PENDING_PAYMENT vencem o banner de follow-up de conclusão
- [ ] Disputas: lista vazia mesmo com outros itens
- [ ] Sheet detalhe: lista permanece montada (persistent slot)

## Anexo F — CTA “Avaliar serviço” no card `completed` (cliente)

Dados: `contracted.status` + `contracted.clientRatingOverallScore` do `ServiceModel` (`list_services`). Sem RPC extra.

| Condição | Primário | Secundário | Sheet |
|----------|----------|------------|-------|
| `COMPLETED` + `clientRatingOverallScore == null` | **Avaliar serviço** (`evaluate_service`) | Ver detalhes | `ClientEvaluateServiceDialogs` com `ratingOnly` (título “Avaliar serviço (opcional)”; só etapa de notas) |
| `COMPLETED` + rating existente | Ver detalhes | — | — |

Evidência: `buildCompletedActions` em `clientServiceCardPresentation.ts`; host em `ClientEvaluateServiceDialogs.tsx`.

## 21. Atualização de auditoria (2026-08-02)

- Confirmado persistent slot + `MyServicesRouteSlot` null.
- Banner calendário prestador evidenciado em `ProviderMyServicesPage`.
- Modo sheet por `listPhase` (não status legado `open`).
- CTAs e prioridades de `PENDING_PAYMENT` / unread revalidados em presentation utils.
- Empty states e labels de filtro por papel documentados.

## 22. Atualização (2026-08-06) — follow-up de conclusão no card

- Highlight `in_progress` pós-data-fim / `EXECUTED` documentado (Anexo D; regras 14 e 16).
- Lista não prefetcha `get_service_completion_context`.
- Evidência: `clientServiceCardPresentation.ts`, `providerServiceCardPresentation.ts`, `clientServiceCardTheme.ts` + testes associados.

## 23. Atualização (2026-08-06) — CTA “Concluir serviço” no card do prestador

- Prestador `CONFIRMED` + schedule past: primário **“Concluir serviço”** (`mark_executed`) abre sheet/dialog no card; secundário “Ver detalhes”; gate `enrichmentReady` (disabled + tooltip).
- Ramo prestador `EXECUTED` segue com primário “Ver detalhes” (aguardar confirmação no detalhe).
- Evidência: `providerServiceCardPresentation.ts`, `ProviderServiceListCard.tsx` + testes.

## 24. Atualização (2026-08-06) — CTA “Avaliar serviço” no card do cliente

- Cliente `EXECUTED` (banner “Aceite a conclusão e avalie o serviço”): primário **“Avaliar serviço”** (`evaluate_service`) abre `ClientEvaluateServiceSheet` (Public API de `service-completion`) hospedado na página (`ClientEvaluateServiceDialogs` + `useClientEvaluateServiceDialog`); secundário “Ver detalhes”; contexto RPC só ao abrir o wizard — mesmo padrão do prestador com mark-executed.
- `ClientEvaluateServiceAction` no detalhe refatorado para reutilizar `ClientEvaluateServiceSheet`.
- Evidência: `clientServiceCardPresentation.ts`, `ClientServiceListCard.tsx`, `useClientEvaluateServiceDialog.ts`, `ClientEvaluateServiceDialogs.tsx` + testes.

## 25. Atualização (2026-08-07) — “Avaliar serviço” também no card `completed`

- Cliente fase `completed` com `contracted.status === COMPLETED` e `clientRatingOverallScore == null`: primário **“Avaliar serviço”** (`evaluate_service`); secundário “Ver detalhes”; host com `ratingOnly` (dados já em `list_services`). Com rating existente, mantém só “Ver detalhes”.
- Evidência: `buildCompletedActions` em `clientServiceCardPresentation.ts`; `ClientEvaluateServiceDialogs.tsx` (`ratingOnly`). Documentado na regra 15 e Anexo F.
