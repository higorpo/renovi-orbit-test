# Comparar orçamentos / histórico (sheet em Meus Serviços)

Documentação baseada em `src/features/negotiation-proposals/` — componentes e API consumidos por **`client-my-services`** via Public API (`index.ts`).

---

## 1. Visão geral

| Item | Descrição |
|------|-----------|
| **Objetivo** | Exibir propostas recebidas de um pedido em sheet lateral: **comparar** orçamentos ativos (pedido aberto) ou consultar **histórico** (demais status do pedido). |
| **Onde abre** | Card em **Meus Serviços** (`ClientMyServicesPage` / `ClientMyServicesCard`) quando `proposalCount > 0`. |
| **Quem usa** | Cliente autenticado (dono do pedido). |
| **Não é rota dedicada** | Não há página `/dashboard/orcamentos`; o sheet substitui a antiga listagem em `client-budgets`. |

---

## 2. Modos do sheet

Helpers em `constants/serviceRequestBudgetSheet.ts`:

| Status do pedido (`service_requests.status`) | Modo (`ServiceRequestBudgetSheetMode`) | Título do sheet | Label do botão no card |
|---------------------------------------------|----------------------------------------|-----------------|------------------------|
| `open` | `compare` | Comparar orçamentos | Comparar orçamentos |
| Qualquer outro (`in_progress`, `closed`, `cancelled`, …) | `history` | Histórico de orçamentos | Histórico de orçamentos |

- `getServiceRequestBudgetSheetMode(status)` — define o modo.
- `getServiceRequestBudgetActionLabel(status)` — label do botão no card.
- `getServiceRequestBudgetSheetTitle(mode)` — título exibido no sheet.

---

## 3. UI e ações

**Componente:** `ReceivedBudgetDetailsSheet` — recebe `open`, `serviceRequestId`, `sheetMode`, `onOpenChange`.

**Carregamento:** hook `useServiceRequestBudgetCompareDetail` → API `fetchServiceRequestBudgetCompareDetail` (RPC `get_client_budget_service_request_detail`).

**Conteúdo:**

- Agrupa propostas por prestador; exibe preview do perfil (`ProviderProfileInlinePreview`).
- Bloco da versão mais recente por prestador (`ServiceRequestBudgetCompareVersionBlock`).
- Versões anteriores do mesmo prestador aparecem em seção **Histórico** quando há mais de uma.
- Badge de status por proposta (`ServiceRequestBudgetStatusBadge` / `getBudgetStatusConfig`).

**Ações no modo `compare`:**

- **Recusar orçamento** — habilitado quando a proposta mais recente do prestador está pendente (`isPendingProposalStatus`); abre `ServiceRequestBudgetRejectDialog` → `rejectServiceRequestBudgetProposal` (RPC `reject_client_budget_proposal`).
- **Aprovar orçamento** — botão presente, **desabilitado** no código atual (aceite canônico via CNS / conversas).

**Estados vazios / erro:**

- Erro de carga: alerta com retry.
- Sem propostas: mensagem distinta por modo (`compare` vs `history`).

---

## 4. Integração com `client-my-services`

| Artefato | Papel |
|----------|-------|
| `ClientMyServicesCard` | Renderiza botão ao lado de **Ver detalhes** quando `proposalCount > 0`; ícone `GitCompare` (compare) ou `History` (history). |
| `ClientMyServicesPage` | Monta `ReceivedBudgetDetailsSheet`; estado `selectedBudgetSheetMode` via `useClientMyServicesPage`. |
| Import | Somente via `@/features/negotiation-proposals` (Public API). |

---

## 5. Public API exportada (`negotiation-proposals/index.ts`)

- `ReceivedBudgetDetailsSheet`
- `getServiceRequestBudgetSheetMode`, `getServiceRequestBudgetSheetTitle`, `getServiceRequestBudgetActionLabel`
- `fetchServiceRequestBudgetCompareDetail`, `rejectServiceRequestBudgetProposal`
- `useServiceRequestBudgetCompareDetail`
- Tipos `ServiceRequestBudgetCompareDetail`, `ServiceRequestBudgetCompareProposal`, `ServiceRequestBudgetSheetMode`

---

## 6. Evidências

- `src/features/negotiation-proposals/components/ReceivedBudgetDetailsSheet.tsx`
- `src/features/negotiation-proposals/api/serviceRequestBudgetCompare.api.ts`
- `src/features/negotiation-proposals/constants/serviceRequestBudgetSheet.ts`
- `src/features/view-services/components/ServiceListCard.tsx`
- `src/features/client-my-services/components/ClientMyServicesPage.tsx`
