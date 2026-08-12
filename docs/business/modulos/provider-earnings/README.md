# Ganhos / liquidações (`provider-earnings`)

## 1. Leitura para negócio

- **Para que serve:** mostrar ao **prestador**, numa única página **Ganhos**, dois conceitos distintos: **Cobranças** (valor combinado na captura / `provider_payout`) e **Depósitos** (liquidações bancárias, que podem ser parceladas). Os números **não** se misturam.
- **Quem usa:** prestadores autenticados (`profiles.role === provider`); UI hospedada no hub Configurações (`/dashboard/settings/earnings`), com `SettingsRoleGate` provider. Sem KYC `ACTIVE`, o `ProviderKycGate` substitui o conteúdo operacional e o chrome de nav fica oculto (entrada via hub Configurações na allowlist `/dashboard/settings`).
- **Não é:** uma seção **Recebimentos** na nav (item removido). A captura continua sendo dado de `payments` (`provider_payment_receivables_v`), agora na aba Cobranças. Também não altera o calendário NetCred — só **lê** movements já sincronizados. **Não** há item **Ganhos** no `dashboardMenu` (removido).
- **Valor:** transparência de “quanto combinamos” vs “quando cai na conta”, com filtros Previsto / Liquidado e fallback de estimativa D+30 no caption do ledger quando ainda não há `settling_at` real na lista.
- **Riscos operacionais:** lista de depósitos vazia se ingestão (PAYOUT_*, enrich pós-captura/estorno ou `sync-netcred-settlements`) atrasar; `ProviderSettlementStatus` (payments) pode usar só o fallback D+30 (sem `settlingAt` real) — ver feature. Totais de Cobranças = soma client-side da lista completa (sem RPC nova).

## 2. Visão geral funcional

- **Objetivo:** hub Ganhos com ledger de duas visões + lista paginada de linhas de liquidação (`payment_settlement_movements`) + componente de disclosure de previsão reutilizável (outras superfícies).
- **Escopo:** UI em `/dashboard/settings/earnings` (`ROUTE_PROVIDER_EARNINGS`); ownership da liquidação permanece em `provider-earnings`; host `ProviderEarningsSectionPage` em `settings` **compõe** Public API (não importa internals). Filtros server-side da lista de depósitos, agrupamento visual por parcela do mesmo `payment_schedule_id`, Public API do disclosure. Query `view` troca Cobranças/Depósitos.
- **Limites:** sem mutações; sem filtros de data na UI (RPC aceita, front não envia); sem filtro por serviço; sem analytics GA/Sentry específicos na feature; sem RPC/migration nova na unificação das telas.
- **Relação:** backend de ingestão e persistência em **payments**; navegação via hub **settings** + chrome **dashboard-shell** + **provider-kyc**. Rota top-level `/dashboard/earnings` **removida** (sem redirect). Rota legado `/dashboard/settings/receivables` **existe** e redireciona para `?view=charges`.

## 3. Features do módulo

| Feature | Resumo | Documento |
|---------|--------|-----------|
| Ganhos e liquidações | Página unificada (ledger Cobranças/Depósitos); lista, filtros, cards, disclosure D+30 / `settling_at`, hold estorno / chargeback / `service_dispute` | [features/ganhos-e-liquidacoes.md](./features/ganhos-e-liquidacoes.md) |

## 4. Perfis envolvidos

| Papel | Acesso |
|-------|--------|
| Prestador (`ACTIVE` KYC) | Seção Ganhos no hub Configurações + RPC lista os próprios movements |
| Prestador (KYC não `ACTIVE`) | Menus ocultos; gate do shell; hub `/dashboard/settings*` na allowlist (conteúdo liberado) |
| Cliente / visitante | Sem seção earnings; `SettingsRoleGate` provider na página host |
| Admin | Sem UI dedicada; RLS da tabela permite SELECT a admin na política original — app autenticado lê via RPC DEFINER filtrando `provider_id = auth.uid()` |

## 5. Principais fluxos

1. Prestador abre **Configurações → Ganhos** (`/dashboard/settings/earnings`, default Depósitos) → ledger + `EarningsPage` → `useProviderSettlements` → RPC `list_provider_settlement_movements` → lista / vazio / erro.
2. Troca de painel do ledger → `view=charges` (Cobranças) ou remove o param (Depósitos); `useEarningsViewParam` com `replace: true`.
3. Troca de aba de filtro da lista de depósitos → nova `queryKey` → refetch página 1.
4. **Carregar mais** → próxima página (page size 20).
5. Disclosure em `ProviderSettlementStatus` (consumidor em `payments`) mostra previsão ou mensagem de hold — **não** nos cards da lista de captura.

## 6. Regras transversais

- Distinção **captura (Cobranças)** vs **liquidação bancária (Depósitos)** (obrigatória no ledger: valor em R$ vs contagem de depósitos).
- Somente leitura; ingestão só por `service_role` (webhook PAYOUT_*, enrich GraphQL pós-captura/estorno, cron reconcile).
- Página e RPC não antecipam depósito ao marcar serviço concluído (`PROVIDER_SETTLEMENT_COMPLETION_NOTE` no caption do ledger).

## 7. Entidades

| Artefato | Papel |
|----------|--------|
| `payment_settlement_movements` | Persistência; UNIQUE `(gateway_slug, gateway_movement_id)` |
| `provider_settlement_movements_v` | View sem `raw_snapshot` (`security_invoker`) |
| `list_provider_settlement_movements` | Lista paginada para o prestador autenticado |
| `payment_upsert_settlement_movements` | Upsert `service_role` |
| Domain TS `SettlementMovement` | Modelo camelCase no front |

## 8. Integrações

- **payments / NetCred:** (1) `PAYOUT_CREATE` / `PAYOUT_SETTLE` → `payment_webhook_handle_payout`; (2) após `TRANSACTION_CAPTURE` / `TRANSACTION_REFUND` com sucesso, `netcred-webhook` enriquece best-effort via GraphQL `movements(transactionId)` → `payment_upsert_settlement_movements` (mesmo pipeline do sync; falha do enrich **não** falha o ACK); (3) cron `sync-netcred-settlements` como backfill. Motivo do enrich: NetCred reusa lotes de payout por `(company, settling_at)` — movements novos em lote existente **não** disparam `PAYOUT_CREATE`.
- **settings / payments UI:** uma página Ganhos no hub (`/dashboard/settings/earnings`); nav só **Ganhos**; `/dashboard/settings/receivables` redireciona para `?view=charges`. Settings importa só Public API. Disclosure importado da Public API (não nos cards de captura).
- **payments:** `ProviderSettlementStatus` (componente + holds) consome o disclosure; `ProviderPaymentHistoryList` **não** monta disclosure por card. **Não** montado em `ServiceContractedSection` após redesign do card Serviço contratado.
- **provider-kyc / dashboard-shell:** gate do outlet + `useProviderKycBlocksNav` (chrome oculto até `ACTIVE`); **sem** item Ganhos em `getDashboardMenu` — entrada só pelo hub Configurações.

## 9. Riscos e lacunas

- `ProviderSettlementStatus` (payments) **não passa** `settlingAt` — previsões embutidas nesse componente usam D+30 até a lista Depósitos (ou outro consumidor) exibir a data real do movement. A lista de captura **não** mostra previsão por card.
- Params de intervalo de datas da RPC existem sem UI.
- Sem instrumentação de analytics na feature.
- Detalhe operacional NetCred / runbooks: `docs/payment-system/` (fora deste módulo).

## 10. Evidências

- `src/features/provider-earnings/` (`EarningsPage`, `EarningsLedgerSwitch`, `useProviderSettlements`, `useEarningsViewParam`, `parseEarningsView`, `providerEarningsPath`, `settlements.api.ts`, disclosure, `ROUTE_PROVIDER_EARNINGS`)
- `src/features/settings/components/sections/ProviderEarningsSectionPage.tsx` — host unificado; `ProviderReceivablesPage.tsx` — redirect legado
- `src/features/settings/hooks/useEarningsLedgerSummary.ts` — totais do ledger (soma captura client-side + `totalCount` depósitos)
- `src/router.tsx` — `settings/earnings` e `settings/receivables` (redirect)
- `src/layouts/DashboardLayout/dashboardMenu.ts` — **sem** item Ganhos
- `src/features/settings/constants/settingsNav.ts` — um item Ganhos; sem Recebimentos
- Migrations `20260802240000_create_payment_settlement_movements.sql`, `20260802250000_payment_sync_netcred_settlements_cron.sql`, grants em `20260802300000_*`
- EFs: `netcred-webhook` (PAYOUT_* + enrich pós-CAPTURE/REFUND), `sync-netcred-settlements`; shared `enrichSettlementMovements`
- Feature: [ganhos-e-liquidacoes.md](./features/ganhos-e-liquidacoes.md)
- Engenharia complementar: `docs/payment-system/design.md` §3.13; `docs/payment-system/payments-api.md` §10 (`PayoutPayload`)
