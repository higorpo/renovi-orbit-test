# Credenciamento do prestador (`provider-kyc`)

## 1. Leitura para negócio

- **Para que serve:** impedir que o prestador use o **conteúdo operacional** do painel (trabalhos, serviços, conversas, ganhos, ajuda via menu, etc.) até o onboarding NetCred estar **`ACTIVE`**; coletar/reenviar documentos via wizard; informar o status da análise.
- **Quem usa:** prestadores autenticados (`profiles.role === provider`).
- **Não é:** onboarding de cadastro/auth (`/cadastro/profissional`). É **credenciamento de pagamentos NetCred** (KYC para split/recebimento).
- **Valor:** só prestadores credenciados operam na plataforma; o logout permanece acessível via **Minha conta** (após o loading da conta).
- **Fases de UI:** Fase 2 — gate no shell + telas de status + menu reduzido + polling; Fase 3 — wizard (`entity → identity → bank → documents → review`) hospedado pelo gate. Backend de cobrança/KYC (RPCs `payment_*`, Edge NetCred) permanece no domínio de pagamentos.

## 2. Visão geral funcional

- **Objetivo:** `ProviderKycGate` no `DashboardLayout` substitui slots do prestador + `<Outlet />` por status/wizard enquanto `onboarding_status !== ACTIVE` (ou conta NetCred ausente); `useProviderKycNavItems` limita o menu a Minha conta no mesmo critério (inclui loading).
- **Escopo deste módulo (front):** gate, telas `components/status/*`, nav, query/polling da conta, retry de e-mail, wizard e API de upload/submit usadas pelo wizard.
- **Limites:** não redefine guards de rota; não implementa cobrança; `ClientMyServicesPersistentSlot` e `ServiceDetailSheet` ficam **fora** do gate.
- **Exceção de path:** `/dashboard/conta` e `/dashboard/conta/…` liberam children **depois** do loading (allowlist `PROVIDER_KYC_ALLOWED_PATH_PREFIX`).

## 3. Features do módulo

| Feature | Resumo | Documento |
|---------|--------|-----------|
| Gate de acesso operacional | Bloqueio do shell, telas por status, allowlist conta, menu reduzido, polling 5s/30s, retry e-mail 15s | [features/gate-e-acesso-operacional.md](./features/gate-e-acesso-operacional.md) |
| Wizard de formulário KYC (Fase 3) | Passos, banco FEBRABAN, uploads Option A, identidade na RPC, analytics | [features/formulario-credenciamento-wizard.md](./features/formulario-credenciamento-wizard.md) |

## 4. Perfis envolvidos

| Papel | Comportamento |
|-------|---------------|
| Prestador | Gate + query NetCred; se não `ACTIVE` (ou loading), menu só Minha conta; UIs de status/wizard |
| Cliente | Gate transparente (`children`); query KYC desabilitada no filtro de nav |
| Visitante | Sem dashboard (guards de `auth`) |

## 5. Principais fluxos

1. Prestador autenticado entra em `/dashboard/...`.
2. Layout aplica `useProviderKycNavItems`; `ProviderKycGate` consulta `provider_gateway_accounts` (`gateway_slug = netcred`).
3. Loading → spinner “Verificando credenciamento…” (também cobre path de conta).
4. Path Minha conta (allowlist) → conteúdo da conta.
5. `ACTIVE` → slots + outlet normais; menu completo.
6. Caso contrário → tela de status ou wizard conforme status/`email_dispatched_at`; deep links operacionais mostram KYC, não a feature alvo.

## 6. Regras transversais do módulo

1. Liberação operacional = `onboarding_status === ACTIVE`.
2. Qualquer outro status (incl. `SUSPENDED`, `REJECTED`, `UNDER_NETCRED_REVIEW`, `DOCUMENTS_SUBMITTED`, …) ou conta null bloqueia o shell (salvo allowlist).
3. `DOCUMENTS_SUBMITTED` sem `email_dispatched_at` = UI “Enviando…” + retry Edge `dispatch-kyc-email` (`retry_only`).
4. Menu bloqueado também enquanto a conta carrega.
5. FSM no banco permite reenvio `REJECTED` → `DOCUMENTS_SUBMITTED` (e related); `ACTIVE` é terminal para saída de status.
6. Detalhe de campos/validação do envio: feature wizard; regra de cobrança sem `ACTIVE`: módulo payments.

## 7. Entidades

| Entidade / campo | Uso |
|------------------|-----|
| `provider_gateway_accounts` | `onboarding_status`, `email_dispatched_at`, `onboarding_submitted_at` (gateway `netcred`) |
| `provider_profiles_private` | Prefill do wizard (não do gate) |
| `provider_kyc_upload_sessions` + bucket `provider-kyc-documents` | Uploads Option A (wizard) |
| Cache React Query `["provider-payment-account", providerId]` | Leitura/polling do gate e do nav |

## 8. Integrações

| Módulo / peça | Relação |
|---------------|---------|
| **dashboard-shell** | `DashboardLayout` hospeda `ProviderKycGate` e consome `useProviderKycNavItems` |
| **my-account** | Allowlist `/dashboard/conta*` — logout e ajustes com KYC bloqueado |
| **payments** | Conta NetCred; RPCs `payment_*`; cron `detect-netcred-onboarding`; cobrança exige `ACTIVE` |
| **message-dispatcher** | Eventos `PROVIDER_KYC_SUBMITTED`, `PROVIDER_ONBOARDING_UNDER_REVIEW`, `PROVIDER_KYC_REJECTED`, `PROVIDER_ACTIVATED`, `PROVIDER_SUSPENDED` |
| Edge `dispatch-kyc-email` | Envio pós-submit e retry do gate |

## 9. Riscos e lacunas

- Falha na fetch da conta: hook lança erro; gate sem `data` trata como pendente → wizard (sem tela de erro dedicada) — ver gate §17–§20.
- Loading temporário bloqueia também Minha conta.
- Deep link operacional + menu só conta pode confundir QA.
- Wizard e gate são features distintas no mesmo módulo; não misturar escopos de documentação.

## 10. Evidências

- `src/features/provider-kyc/` (`ProviderKycGate`, `status/*`, hooks de conta/nav/retry/wizard, `api/kyc.api.ts`)
- `src/layouts/DashboardLayout/DashboardLayout.tsx`, `dashboardMenu.ts`
- FSM: `supabase/migrations/20260801060000_create_provider_gateway_accounts.sql`
- RPCs/storage: `payment_submit_provider_kyc`, sessões `provider_kyc_upload_sessions`, janitor `payment_janitor_orphan_kyc_documents`, bucket `provider-kyc-documents`
- Features: [gate-e-acesso-operacional](./features/gate-e-acesso-operacional.md), [formulário-credenciamento-wizard](./features/formulario-credenciamento-wizard.md)
