# Meus serviços (`my-services`)

## 1. Leitura para negócio

- **Para que serve:** lista unificada de **pedidos em acompanhamento** para **cliente** e **prestador** na mesma rota `/dashboard/services`, com UI por papel.
- **Cliente:** vê pedidos solicitados; busca, filtros, abas por fase, deep link `?serviceRequestId=`, sheet comparar/histórico de orçamentos, cancelamento.
- **Prestador:** central de gerenciamento com cards compactos por fase; header (cliente + status), título IA, destaque contextual, metadados secundários e até 2 CTAs.
- **Dados:** `view-services` (`list_services`, `get_service`, `cancel_service_request`); detalhe em `/dashboard/services/:id`.

## 2. Visão geral técnica

| Aspecto | Detalhe |
|---------|---------|
| Rota lista | `/dashboard/services` — `MyServicesRouteSlot` (cliente ou prestador por `profile.role`) |
| Detalhe | `/dashboard/services/:id` — `ServiceDetailShell` (`view-services`) |
| Cliente | `ClientMyServicesPage` → `MyServicesPageShell` + `ServiceListCard` |
| Prestador | `ProviderMyServicesPage` → `MyServicesPageShell` + `ProviderServiceListCard` |
| Dados lista | `useMyServicesList` → `useServicesList` → RPC `list_services` |
| Deep link (cliente) | `?serviceRequestId=` — `getMyServicesPageUrlWithFocus` |
| Orçamentos (cliente) | `ReceivedBudgetDetailsSheet` (`negotiation-proposals`) |

## 3. Documentação da feature

| Documento | Conteúdo |
|-----------|----------|
| [features/solicitacoes-do-cliente.md](./features/solicitacoes-do-cliente.md) | Fluxo cliente (abas, filtros, card, sheet) |
| [Comparar orçamentos / histórico](../chats/features/comparar-orcamentos-meus-servicos.md) | Sheet `ReceivedBudgetDetailsSheet` |
| [Visualização de serviços (RPC)](../view-services/features/visualizacao-de-servicos.md) | Contrato `ServiceModel`, RPCs, fases |

## 4. Mapa de arquivos

| Área | Caminhos |
|------|----------|
| Roteamento | `components/MyServicesRouteSlot.tsx` |
| Shell compartilhado | `components/MyServicesPageShell.tsx`, `components/shared/*` |
| Cliente | `components/client/ClientMyServicesPage.tsx`, hooks `useClientMyServicesPage.ts` |
| Cliente (card) | `components/client/ClientServiceListCard.tsx`, `ClientServiceCardIcons.tsx`, `utils/clientServiceCardPresentation.ts` |
| Prestador | `components/provider/ProviderMyServicesPage.tsx`, `ProviderServiceListCard.tsx`, `ProviderServiceCardIcons.tsx`, `utils/providerServiceCardPresentation.ts`, `useProviderMyServicesPage.ts` |
| Destaque compartilhado | `utils/pendingPaymentHighlight.ts` — copy do highlight quando `contracted.status === PENDING_PAYMENT` |
| Core | `hooks/useMyServicesPageCore.ts`, `useMyServicesList.ts`, `useMyServicesFilters.ts` |
| Tipos / rotas | `types/my-services.types.ts`, `constants/routes.ts` |

## 5. Integrações

- **`view-services`** — lista, detalhe, cancelamento (cliente), fases, `ServiceModel` enriquecido (`myProposal`, `chatSummary`, `lastActivityAt` para prestador).
- **`negotiation-proposals`** — sheet compare/history (cliente).
- **`chats`** — ação primária no card prestador.
- **`provider-jobs`** — descoberta de oportunidades (fora desta lista).

## 6. API pública (`index.ts`)

Exporta: `MyServicesRouteSlot`, `ClientMyServicesPage`, `ProviderMyServicesPage`, `ROUTE_MY_SERVICES_LIST`, `getMyServicesPageUrlWithFocus`, `SERVICE_REQUEST_FOCUS_QUERY`.

## 7. Migração / schema

- RPCs `get_service`, `list_services` — enriquecimento prestador: `my_proposal` (revisão, envio, recusa), `chat` (preview da última mensagem), `counterparty` (nome completo + avatar), `cancelled_at` / `completed_at` / `contracted.updated_at` (migrations `20260710120000_*`, `20260710160000_enrich_provider_service_card_data.sql`).

## 8. Cards na listagem — destaque `PENDING_PAYMENT`

Quando o serviço contratado está em **`PENDING_PAYMENT`**, o destaque do card (cliente e prestador) prioriza o pagamento em relação ao highlight genérico de agenda. Implementação: `getPendingPaymentHighlightContent` (`utils/pendingPaymentHighlight.ts`), consumido por `clientServiceCardPresentation.ts` e `providerServiceCardPresentation.ts`.

| Papel | Título do destaque | Descrição | Ícone / ênfase |
|-------|--------------------|-----------|----------------|
| Cliente | Aguardando pagamento | Serviço agendado para {data}, pagamento ainda pendente. | `payment_pending` (cartão) · `attention` |
| Prestador | Aguardando pagamento do cliente | Mesma descrição do cliente | Idem |

- **Fallback** (sem data utilizável): detalhe curto “Pagamento ainda pendente.”
- **Prioridade:** mensagem não lida no chat ainda sobrescreve este destaque (agenda vai para info secundária).
- **Antes:** título era o highlight de agenda (“Agendado para…”) + detalhe curto “Aguardando pagamento” / “Aguardando pagamento do cliente” + ícone de calendário.

## 9. Card do prestador (`ProviderServiceListCard`)

Estrutura fixa em cinco zonas: **header** (avatar + nome do cliente | badge de fase + urgência só se `high`) → **título IA** (2 linhas) → **destaque** (ação pendente / situação atual, maior peso visual) → **informações secundárias** (local, valor, data — sem descrição do pedido) → **rodapé** (máx. 2 botões).

| Fase / substatus | Destaque (exemplo) | CTAs |
|------------------|-------------------|------|
| Negociação — nova mensagem | 📩 Nova mensagem recebida + preview | Responder · Ver detalhes |
| Negociação — proposta enviada | ⏳ Aguardando decisão do cliente sobre sua proposta | Ver proposta · Ver negociação |
| Negociação — revisão | 📝 Cliente solicitou revisão | Revisar proposta · Ver negociação |
| Negociação — conversa ativa | 💬 Negociação em andamento | Ver negociação · Ver detalhes |
| `in_progress` + `PENDING_PAYMENT` | 💳 Aguardando pagamento do cliente + data do serviço e “pagamento ainda pendente” (ver §8) | Ver conversa · Ver detalhes |
| `in_progress` (hoje, já pago / sem pendência de pagamento) | 🔥 Serviço hoje — borda destacada | Ver conversa · Ver detalhes |
| `in_progress` | 📅 Agendado para amanhã / data | Ver conversa · Ver detalhes |
| `completed` | ✅ Serviço concluído + avaliação mock | Ver detalhes |
| `cancelled` | ❌ Serviço cancelado + motivo | Ver detalhes |

Regras: negociação **sem proposta** → CTA primário **Ver negociação** (nunca "Enviar orçamento" no card). Urgência baixa/média oculta. Aba **Disputas** permanece placeholder.
