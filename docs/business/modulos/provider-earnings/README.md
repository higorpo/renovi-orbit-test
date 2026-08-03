# Ganhos / liquidações (`provider-earnings`)

## 1. Leitura para negócio

- **Para que serve:** mostrar ao **prestador** as **liquidações bancárias** (depósitos previstos e efetivos na conta), distintas dos **recebimentos na captura** listados em Minha conta.
- **Quem usa:** prestadores autenticados (`profiles.role === provider`), com rota guard provider-only. Sem KYC `ACTIVE`, o `ProviderKycGate` substitui o conteúdo e o chrome de nav fica oculto (item Ganhos só aparece no menu após `ACTIVE`).
- **Não é:** histórico de captura/`provider_payout` (isso fica em `payments` → Minha conta → Recebimentos). Também não altera o calendário NetCred — só **lê** movements já sincronizados.
- **Valor:** transparência de “quando cai na conta”, com filtros Previsto / Liquidado e fallback de estimativa D+30 quando ainda não há `settling_at` real.
- **Riscos operacionais:** lista vazia se ingestão (PAYOUT_*, enrich pós-captura/estorno ou `sync-netcred-settlements`) atrasar; disclosure embutido em Recebimentos/detalhe do serviço pode usar só o fallback D+30 (sem `settlingAt` real) — ver feature.

## 2. Visão geral funcional

- **Objetivo:** lista paginada de linhas de liquidação (`payment_settlement_movements`) + componente de disclosure de previsão reutilizável.
- **Escopo:** UI `/dashboard/earnings`, filtros server-side, agrupamento visual por parcela do mesmo `payment_schedule_id`, Public API do disclosure.
- **Limites:** sem mutações; sem filtros de data na UI (RPC aceita, front não envia); sem analytics GA/Sentry específicos na feature.
- **Relação:** backend de ingestão e persistência em **payments**; shell/menu em **dashboard-shell** + **provider-kyc**.

## 3. Features do módulo

| Feature | Resumo | Documento |
|---------|--------|-----------|
| Ganhos e liquidações | Lista, filtros, cards, disclosure D+30 / `settling_at`, hold estorno/disputa | [features/ganhos-e-liquidacoes.md](./features/ganhos-e-liquidacoes.md) |

## 4. Perfis envolvidos

| Papel | Acesso |
|-------|--------|
| Prestador (`ACTIVE` KYC) | Menu Ganhos + rota + RPC lista os próprios movements |
| Prestador (KYC não `ACTIVE`) | Menus ocultos; gate do shell substitui o outlet operacional pela UI KYC |
| Cliente / visitante | Sem item de menu; rota guard `allowedRoles={['provider']}` |
| Admin | Sem UI dedicada; RLS da tabela permite SELECT a admin na política original — app autenticado lê via RPC DEFINER filtrando `provider_id = auth.uid()` |

## 5. Principais fluxos

1. Prestador abre **Ganhos** → `useProviderSettlements` → RPC `list_provider_settlement_movements` → lista / vazio / erro.
2. Troca de aba de filtro → nova `queryKey` → refetch página 1.
3. **Carregar mais** → próxima página (page size 20).
4. Disclosure em Recebimentos / detalhe do serviço contratado (consumidores em `payments` / `view-services`) mostra previsão ou mensagem de hold.

## 6. Regras transversais

- Distinção **captura** vs **liquidação bancária** (obrigatória na cópia da página e nos docs de payments).
- Somente leitura; ingestão só por `service_role` (webhook PAYOUT_*, enrich GraphQL pós-captura/estorno, cron reconcile).
- Página e RPC não antecipam depósito ao marcar serviço concluído (`PROVIDER_SETTLEMENT_COMPLETION_NOTE`).

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
- **my-account / payments UI:** link cruzado Recebimentos ↔ Ganhos; disclosure importado da Public API.
- **view-services:** `ProviderSettlementStatus` (payments) no detalhe contratado, usando o disclosure.
- **provider-kyc / dashboard-shell:** gate do outlet + `useProviderKycBlocksNav` (chrome oculto até `ACTIVE`); definição de menu via `getDashboardMenu` (Ganhos no menu do prestador quando chrome visível).

## 9. Riscos e lacunas

- Disclosure em Recebimentos e `ProviderSettlementStatus` **não passam** `settlingAt` — previsões embutidas usam D+30 até a lista Ganhos (ou outro consumidor) exibir a data real do movement.
- Params de intervalo de datas da RPC existem sem UI.
- Sem instrumentação de analytics na feature.
- Detalhe operacional NetCred / runbooks: `docs/payment-system/` (fora deste módulo).

## 10. Evidências

- `src/features/provider-earnings/` (`EarningsPage`, `useProviderSettlements`, `settlements.api.ts`, disclosure)
- `src/router.tsx` — `path: 'earnings'`, lazy `EarningsPage`, guard provider
- `src/layouts/DashboardLayout/dashboardMenu.ts` — item Ganhos
- Migrations `20260802240000_create_payment_settlement_movements.sql`, `20260802250000_payment_sync_netcred_settlements_cron.sql`, grants em `20260802300000_*`
- EFs: `netcred-webhook` (PAYOUT_* + enrich pós-CAPTURE/REFUND), `sync-netcred-settlements`; shared `enrichSettlementMovements`
- Feature: [ganhos-e-liquidacoes.md](./features/ganhos-e-liquidacoes.md)
- Engenharia complementar: `docs/payment-system/design.md` §3.13; `docs/payment-system/payments-api.md` §10 (`PayoutPayload`)
