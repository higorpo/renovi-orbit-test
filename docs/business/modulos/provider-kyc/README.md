# Credenciamento do prestador (`provider-kyc`)

## 1. Leitura para negócio

- **Para que serve:** impedir que o prestador use o **conteúdo operacional** do painel (trabalhos, serviços, conversas, ajuda, etc.) até o onboarding NetCred estar **`ACTIVE`**; coletar/reenviar documentos via wizard multi-etapas; informar o status da análise.
- **Quem usa:** prestadores autenticados (`profiles.role === provider`).
- **Não é:** onboarding de cadastro/auth (`/cadastro/profissional`). É **credenciamento de pagamentos NetCred** (KYC para split/recebimento).
- **Valor:** só prestadores credenciados operam na plataforma; o logout permanece acessível via **Minha conta**.
- **Fases de UI:** Fase 2 — gate no shell + telas de status; Fase 3 — wizard de credenciamento (`entity → identity → bank → documents → review`) hospedado pelo gate. Backend de cobrança/KYC (RPCs `payment_*`, Edge NetCred) permanece no domínio de pagamentos.

## 2. Features do módulo

| Feature | Documento |
|---------|-----------|
| Gate de acesso operacional, telas de status, menu reduzido e polling | [features/gate-e-acesso-operacional.md](./features/gate-e-acesso-operacional.md) |
| Wizard de formulário KYC (Fase 3): passos, banco FEBRABAN, uploads Option A, identidade na RPC, analytics | [features/formulario-credenciamento-wizard.md](./features/formulario-credenciamento-wizard.md) |

## 3. Relação com outros módulos

- **`dashboard-shell`:** `DashboardLayout` envolve slots persistentes do prestador (`ProviderJobsPersistentSlot`, `ProviderMyServicesPersistentSlot`) + `<Outlet />` com `ProviderKycGate`; filtra o menu via `useProviderKycNavItems`.
- **`my-account`:** `/dashboard/conta` (e paths aninhados) continua acessível com KYC bloqueado — logout e ajustes de conta.
- **`payments`:** regra “sem `ACTIVE` não há cobrança”; conta em `provider_gateway_accounts`; cron `detect-netcred-onboarding`; RPCs `payment_*` de submit/upload; e-mail operacional via `dispatch-kyc-email`.
- **`message-dispatcher`:** eventos KYC (`PROVIDER_KYC_SUBMITTED`, `PROVIDER_ONBOARDING_UNDER_REVIEW`, `PROVIDER_KYC_REJECTED`, `PROVIDER_ACTIVATED`, `PROVIDER_SUSPENDED`).

## 4. Evidências principais

- `src/features/provider-kyc/`
- `src/layouts/DashboardLayout/DashboardLayout.tsx`
- RPCs/storage: `payment_submit_provider_kyc`, sessões `provider_kyc_upload_sessions`, janitor `payment_janitor_orphan_kyc_documents`, bucket `provider-kyc-documents`
