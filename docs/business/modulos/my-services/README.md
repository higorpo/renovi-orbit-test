# Meus serviços (`my-services`)

## 1. Leitura para negócio

- **Para que serve:** lista unificada de **pedidos em acompanhamento** na rota `/dashboard/services`, com UI distinta por papel (`client` | `provider`).
- **Cliente:** acompanha pedidos solicitados — busca, filtros, abas por fase, deep link `?serviceRequestId=`, sheet comparar/histórico de orçamentos (`ReceivedBudgetDetailsSheet`), cancelamento na listagem, CTA de pagamento manual quando falha permanente.
- **Prestador:** acompanha propostas e serviços contratados — mesmos filtros/abas; banner de entrada para **calendário** (`ProviderCalendarEntryBanner` → `/dashboard/services/calendar`); dialogs de ver/revisar proposta; CTAs de chat, mapa e detalhe.
- **Valor:** hub operacional pós-pedido/proposta; detalhe canônico em `/dashboard/services/:id` (`view-services`).
- **Impacto se falhar:** cliente/prestador perdem visão consolidada do funil; deep links e CTAs de pagamento/chat deixam de funcionar nesta superfície.

## 2. Visão geral funcional

| Aspecto | Detalhe |
|---------|---------|
| Rota lista | `/dashboard/services` — outlet `MyServicesRouteSlot` (retorna `null`); lista real nos **persistent slots** do `DashboardLayout` |
| Detalhe | `/dashboard/services/:id` — `ServiceDetailShell` (`view-services`); sheet modal quando navegação com state de my-services |
| Calendário (prestador) | `/dashboard/services/calendar` — `ProviderCalendarPage` (`provider-calendar`); guard `allowedRoles={['provider']}` |
| Cliente | `ClientMyServicesPersistentSlot` → `ClientMyServicesPage` → `MyServicesPageShell` + `ClientServiceListCard` |
| Prestador | `ProviderMyServicesPersistentSlot` → `ProviderMyServicesPage` → shell + `ProviderServiceListCard` + `ProviderCalendarEntryBanner` |
| Dados | `useMyServicesList` → `useServicesList` (`view-services`) → RPC `list_services` (página 20) |
| Deep link (cliente) | `?serviceRequestId=` — `getMyServicesPageUrlWithFocus` / `SERVICE_REQUEST_FOCUS_QUERY` |
| Orçamentos (cliente) | `ReceivedBudgetDetailsSheet` (`negotiation-proposals`); modo `compare` \| `history` por `listPhase` |

## 3. Features do módulo

| Documento | Conteúdo |
|-----------|----------|
| [features/solicitacoes-do-cliente.md](./features/solicitacoes-do-cliente.md) | Fluxo completo cliente + prestador (abas, filtros, cards, sheet, banner calendário, CTAs) |
| [Comparar orçamentos / histórico](../chats/features/comparar-orcamentos-meus-servicos.md) | Sheet `ReceivedBudgetDetailsSheet` (detalhe do sheet) |
| [Visualização de serviços (RPC)](../view-services/features/visualizacao-de-servicos.md) | Contrato `ServiceModel`, RPCs, fases |
| Calendário do prestador | Feature `provider-calendar` — rota `/dashboard/services/calendar`; entrada via banner em Meus Serviços |

## 4. Perfis envolvidos

| Perfil | Acesso à lista `/dashboard/services` | Superfície |
|--------|--------------------------------------|------------|
| `client` | Sim (menu “Meus Serviços”) | `ClientMyServicesPage` |
| `provider` | Sim (menu “Meus Serviços”) | `ProviderMyServicesPage` + banner calendário |
| `admin` | Sem rota dedicada nesta feature | — |

Guards: dashboard sob `ProtectedRoute` `client` \| `provider`. Calendário: guard adicional `provider`.

## 5. Principais fluxos

1. **Abrir lista** → persistent slot monta página por `profile.role` → `list_services` com filtros.
2. **Cliente — foco** → `?serviceRequestId=` → lista com 1 item (`get_service` no backend via list) + banner + scroll até o card.
3. **Cliente — orçamentos** → CTA no card → sheet compare (negociação) ou history (demais fases).
4. **Cliente — pagamento falhou** → CTA “Ajustar pagamento” → `ManualPaymentDialog` (`payments`).
5. **Prestador — calendário** → banner “Ver calendário de serviços” → `/dashboard/services/calendar`.
6. **Prestador — proposta** → “Ver proposta” / “Revisar proposta” → dialogs `ProviderServiceProposalDialogs`.
7. **Detalhe** → navega para `/dashboard/services/:id` com state de sheet (lista permanece montada).

## 6. Regras transversais

- Paginação server-side (20 itens); busca debounced **300 ms**.
- Aba **Disputas** existe na UI mas `tabIncludesStatus(..., dispute)` sempre `false` — sem linhas (stub de disputa fica no detalhe via **service-completion**, não nesta aba).
- Opções de dropdown de filtro (categoria/cidade/bairro) derivadas dos **itens já carregados** — podem ficar incompletas com paginação.
- Campo `categoryId` no estado de filtro envia **título** do serviço como `p_category_title` (não UUID).
- Destaque `PENDING_PAYMENT`: copy compartilhada em `pendingPaymentHighlight.ts`; no cliente, `FAILED_PERMANENT` prevalece sobre unread.
- Prestador: avaliação no card `completed` usa **hash mock** (`mockClientRating`) — não é nota real do cliente.
- Calendário: documentação de domínio em `provider-calendar`; neste módulo só o **ponto de entrada** (banner).

## 7. Entidades

Consumidas via `view-services` / RPCs (não há API própria de `my-services`):

- `service_requests`, `contracted_services`, propostas (`my_proposal`), chat summary, counterparty.
- Fases de lista: `negotiation` \| `in_progress` \| `completed` \| `cancelled` (`list_phase`).

## 8. Integrações

| Módulo | Uso |
|--------|-----|
| `view-services` | Lista, detalhe, cancelamento, budget sheet helpers, navegação sheet |
| `service-completion` | Conclusão no **detalhe** (`view-services`): enrichment banner; CTAs “Marcar serviço como concluído” / “Avaliar serviço” (sheet/dialog); stub disputa — não na listagem |
| `negotiation-proposals` | `ReceivedBudgetDetailsSheet`; dialogs de proposta do prestador |
| `chats` | Navegação para conversa / filtro por service request |
| `payments` | `ManualPaymentDialog` + `usePaymentSchedule` no card cliente |
| `provider-calendar` | `ProviderCalendarEntryBanner` + rota calendar |
| `provider-jobs` | Empty state prestador → `/dashboard/jobs` |
| `request-quote` | Empty/CTA cliente → `/pedir-orcamento` |

## 9. Riscos e lacunas

| Item | Status |
|------|--------|
| Aba Disputas | Placeholder — sem dados |
| Opções de filtro só dos itens carregados | Lacuna de UX com paginação |
| Rating no card concluído (prestador) | Mock determinístico por `serviceId` |
| Sheet compare / modo | **Reconciliado (2026-08-02):** modo via `listPhase` (`getServiceRequestBudgetSheetMode`); ver [comparar-orcamentos](../chats/features/comparar-orcamentos-meus-servicos.md) |
| Showcase DEV | Rotas de showcase de cards existem em `router.tsx` (DEV) — fora do fluxo de negócio |

## 10. Evidências

- `src/features/my-services/`
- `src/router.tsx` — `services`, `services/calendar`, `services/:id`
- `src/layouts/DashboardLayout/DashboardLayout.tsx` — persistent slots
- `src/layouts/DashboardLayout/dashboardMenu.ts` — item “Meus Serviços”
- `src/features/provider-calendar/components/ProviderCalendarEntryBanner.tsx`
- Feature detalhada: [features/solicitacoes-do-cliente.md](./features/solicitacoes-do-cliente.md)
