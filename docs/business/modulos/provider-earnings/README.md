# Ganhos / liquidações (`provider-earnings`)

## 1. Leitura para negócio

- **Para que serve:** mostrar ao **prestador** as **liquidações bancárias** (depósitos previstos e efetivos na conta), distintas dos **recebimentos na captura** listados em Minha conta.
- **Quem usa:** prestadores autenticados (`profiles.role === provider`), com rota guard provider-only.
- **Não é:** histórico de captura/`provider_payout` (isso fica em `payments` → Minha conta → Recebimentos). Também não muda o calendário NetCred — só lê movements já sincronizados.
- **Valor:** transparência de “quando cai na conta”, com filtros Previsto / Liquidado / Estorno e fallback de estimativa D+30 quando ainda não há movement.

## 2. Features do módulo

| Feature | Documento |
|---------|-----------|
| Lista Ganhos, filtros, disclosure de previsão | [features/ganhos-e-liquidacoes.md](./features/ganhos-e-liquidacoes.md) |

## 3. Relação com outros módulos

- **`payments`:** domínio backend de cobrança (`payment_schedules`, webhooks `PAYOUT_*`, tabela `payment_settlement_movements`). Histórico de captura em Minha conta; `provider-earnings` só **lê** settlements via RPC/view. Disclosure de liquidação vive em `provider-earnings` e é importado por `payments` / `view-services` onde necessário.
- **`dashboard-shell`:** item de menu **Ganhos** → `/dashboard/earnings` (já não é placeholder).
- **`my-account`:** link cruzado na página Ganhos aponta para Recebimentos em `/dashboard/conta`.
- **`provider-kyc`:** sem onboarding `ACTIVE`, o menu do prestador fica só em Minha conta — Ganhos só aparece após KYC ativo (mesmo gate do shell).

## 4. Evidências principais

- `src/features/provider-earnings/` (`EarningsPage`, `useProviderSettlements`, `settlements.api.ts`)
- `src/router.tsx` — `path: 'earnings'`, lazy `EarningsPage`, guard provider
- RPC `list_provider_settlement_movements`; view `provider_settlement_movements_v`
- Ingestão: `payment_webhook_handle_payout` (`PAYOUT_CREATE` / `PAYOUT_SETTLE`); reconcile `sync-netcred-settlements`
- Engenharia: `docs/payment-system/design.md` §3.13; `docs/payment-system/payments-api.md` §10 (`PayoutPayload`)
