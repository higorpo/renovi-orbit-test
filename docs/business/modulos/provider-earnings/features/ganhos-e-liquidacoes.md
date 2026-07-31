# Ganhos e liquidações bancárias

## Objetivo

Listar para o prestador as **linhas de liquidação** (movements NetCred) vinculadas às cobranças capturadas: previsão de depósito, liquidação efetiva, valor líquido e estornos na liquidação (`DEBIT`).

## Onde aparece na UI

| Superfície | Rota / componente | Perfil |
|------------|-------------------|--------|
| Página Ganhos | `/dashboard/earnings` → `EarningsPage` | Prestador |
| Disclosure de previsão | `ProviderSettlementDisclosure` (Public API de `provider-earnings`) | Prestador (Ganhos; também consumido por histórico/captura e detalhe do serviço via import direto) |

Evidência: `src/router.tsx`; `src/features/provider-earnings/components/EarningsPage.tsx`; `src/layouts/DashboardLayout/dashboardMenu.ts` (item Ganhos).

## Distinção de negócio

| Conceito | O que é | Onde |
|----------|---------|------|
| **Recebimento (captura)** | `provider_payout` no momento em que o cartão do cliente é capturado (`paid_at`) | Minha conta → `provider_payment_receivables_v` (`payments`) |
| **Ganho / liquidação bancária** | Movement do payout NetCred: depósito previsto (`settling_at`) ou efetivo (`settled_at`) | Ganhos → `list_provider_settlement_movements` |

A página Ganhos inclui link explícito para “Minha conta → Recebimentos”.

## Lista e filtros

RPC paginada `list_provider_settlement_movements` via `settlements.api.ts` + `useProviderSettlements` (`useInfiniteQuery`).

Abas (`SETTLEMENT_FILTER_TABS`):

| Aba | Filtro |
|-----|--------|
| Todos | Sem filtro de status/tipo |
| Previsto | `movement_status = PENDING` |
| Liquidado | `movement_status = PAID_OUT` |
| Estorno | `record_type = DEBIT` |

Por item: `net_amount`, previsão/efetivo, parcela (`installment`), badge de estorno quando `DEBIT`. Agrupamento visual por `payment_schedule_id` quando há várias parcelas (`groupSettlementsBySchedule`).

Evidência: `constants/filterTabs.ts`, `SettlementMovementsList.tsx`, `SettlementMovementCard.tsx`.

## Previsão e fallback D+30

- Com movement conhecido: preferir `settling_at` (e `settled_at` quando liquidado).
- Sem movement ainda: `estimateProviderBankSettlementDate` = `paid_at + 30 dias` (UTC), usado no disclosure.
- Nota de produto: marcar serviço como concluído **não** antecipa o depósito (`PROVIDER_SETTLEMENT_COMPLETION_NOTE`).

Evidência: `utils/providerSettlementDisclosure.ts`; consumo em `payments` (`ProviderPaymentHistoryList`, `ProviderSettlementStatus`).

## Persistência e ingestão (backend payments)

| Artefato | Papel |
|----------|--------|
| `payment_settlement_movements` | Tabela; join `gateway_transaction_id` ↔ `payment_schedules.gateway_transaction_id` |
| `provider_settlement_movements_v` | View CLS (sem `raw_snapshot`) |
| `payment_upsert_settlement_movements` | Upsert (`service_role`) |
| `payment_webhook_handle_payout` | `PAYOUT_CREATE` / `PAYOUT_SETTLE` |
| `sync-netcred-settlements` + `payment_cron_sync_netcred_settlements` | Reconcile GraphQL secundário |

Enums de movement (status `PENDING`/`PAID_OUT`; `CREDIT`/`DEBIT`; sources/types): ver `docs/payment-system/payments-api.md` §10.

## Fora de escopo neste documento

- Checkout, cobrança T-2, reembolso ToS e histórico de captura — [payments](../../payments/README.md).
- Detalhe operacional NetCred / runbooks — `docs/payment-system/`.
