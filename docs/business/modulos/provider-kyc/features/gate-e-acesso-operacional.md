# Gate de KYC — acesso operacional do prestador

## 1. Visão geral

- **Objetivo:** bloquear o **shell operacional** do dashboard do prestador enquanto `onboarding_status !== ACTIVE` (ou enquanto não houver conta NetCred).
- **Perfis:** apenas `provider`. Cliente não passa pelo gate (children renderizados normalmente).
- **Dependências:** leitura de `provider_gateway_accounts` (gateway `netcred`); layout em `DashboardLayout`.

---

## 2. Onde o gate atua

No `DashboardLayout`, o conteúdo envolvido por `ProviderKycGate` é:

- `ProviderJobsPersistentSlot`
- `ProviderMyServicesPersistentSlot`
- `<Outlet />` (rotas filhas do dashboard)

**Fora do gate:** `ClientMyServicesPersistentSlot` e o sheet de detalhe de serviço (uso cliente).

**Exceção de rota (allowlist):** pathname igual a `/dashboard/conta` ou prefixo `/dashboard/conta/…` — o gate **não** substitui o conteúdo; Minha conta permanece usável (logout vive ali).

**Evidência:** `ProviderKycGate.tsx`, `kyc.constants.ts` (`PROVIDER_KYC_ALLOWED_PATH_PREFIX`), `DashboardLayout.tsx`.

---

## 3. Critério de bloqueio

| Situação | Bloqueia conteúdo operacional? |
|----------|--------------------------------|
| Conta NetCred **null** (ainda sem registro) | Sim |
| `onboarding_status` **diferente de** `ACTIVE` | Sim |
| `onboarding_status === ACTIVE` | Não — renderiza children |

Não se limita a `PENDING_DOCUMENTS` ou “e-mail pendente”: qualquer status não-`ACTIVE` (incl. `SUSPENDED`, `REJECTED`, `UNDER_NETCRED_REVIEW`, `DOCUMENTS_SUBMITTED`, etc.) bloqueia o shell operacional, salvo a allowlist de conta.

Helpers: `shouldBlockProviderForKyc`, `isProviderCredentialed` em `kyc.api.ts`.

---

## 4. Telas de status (full-screen no outlet)

Enquanto bloqueado e **fora** de `/dashboard/conta`, a UI depende do estado da conta:

| Condição | UI | Comportamento |
|----------|-----|---------------|
| Loading da conta | Spinner “Verificando credenciamento…” | — |
| `DOCUMENTS_SUBMITTED` **sem** `email_dispatched_at` | “Enviando credenciamento…” | Polling 5 s; retry de dispatch de e-mail |
| Conta null **ou** `PENDING_DOCUMENTS` | Formulário `ProviderKycForm` (wizard multi-etapas) | Coleta e submissão de credenciamento — [formulário-credenciamento-wizard](./formulario-credenciamento-wizard.md) |
| `DOCUMENTS_SUBMITTED` **com** `email_dispatched_at` | “Documentos enviados” | Polling 30 s |
| `UNDER_NETCRED_REVIEW` | “Credenciamento em análise” | Polling 30 s |
| `REJECTED` | “Credenciamento não aprovado” + CTA **Reenviar documentos** | CTA abre o formulário de novo; FSM permite `REJECTED` → `DOCUMENTS_SUBMITTED` no reenvio |
| `SUSPENDED` | “Conta suspensa” | Acesso operacional bloqueado; suporte |
| Demais / fallback | “Credenciamento necessário” | Genérico |

**Evidência:** `ProviderKycGate.tsx`; componentes em `components/status/*`; `useProviderPaymentAccount` (`refetchInterval`); trigger FSM em `provider_gateway_accounts` (migration de criação da conta).

---

## 5. Menu desktop e mobile

Quando o prestador está bloqueado (ou a conta ainda está carregando), `useProviderKycNavItems` reduz o menu a **somente Minha conta** (`/dashboard/conta`). Com `ACTIVE`, o menu completo do papel prestador é mantido.

**Evidência:** `useProviderKycNavItems.ts`; consumo em `DashboardLayout.tsx`.

---

## 6. Polling da conta

| Estado | Intervalo |
|--------|-----------|
| `DOCUMENTS_SUBMITTED` sem e-mail disparado | 5 s |
| `DOCUMENTS_SUBMITTED` com e-mail disparado **ou** `UNDER_NETCRED_REVIEW` | 30 s |
| Demais | Sem polling automático |

`staleTime` da query: 10 s.

**Evidência:** `useProviderPaymentAccount.ts`.

---

## 7. Perfis e permissões

| Perfil | Efeito do gate |
|--------|----------------|
| `client` | Nenhum — children liberados |
| `provider` + `ACTIVE` | Shell operacional liberado |
| `provider` + não-`ACTIVE` / sem conta | Shell operacional bloqueado; `/dashboard/conta*` liberado; nav só Minha conta |

Guards de rota (`ProtectedRoute`) **não** substituem este gate: rotas como `/dashboard/jobs` continuam declaradas no router, mas o conteúdo operacional é substituído pelas telas de KYC quando o prestador não está `ACTIVE`.

---

## 8. Entidades

| Entidade / campo | Uso |
|------------------|-----|
| `provider_gateway_accounts` | `onboarding_status`, `email_dispatched_at`, `onboarding_submitted_at` (gateway `netcred`) |

---

## 9. Integrações

- Backend de submissão / detecção de onboarding: RPCs e Edge em [checkout-e-cobranca](../../payments/features/checkout-e-cobranca.md#prestador-kyc--onboarding-netcred) e no wizard ([formulário-credenciamento-wizard](./formulario-credenciamento-wizard.md)) — `payment_submit_provider_kyc`, sessões de upload, `dispatch-kyc-email`, `detect-netcred-onboarding`.
- Storage de documentos: bucket `provider-kyc-documents` (constante na feature).
- Host do formulário: `ProviderKycForm` recebe `providerId`, e-mail da conta, `defaultPhone` / `defaultFullName` do perfil e `onSubmitted` (refetch da conta).

### Notificações MMD (prestador)

| Evento | Template (ex.) | Observação |
|--------|----------------|------------|
| `PROVIDER_KYC_SUBMITTED` | `account.provider_kyc_submitted` | Já existia no catálogo de pagamentos |
| `PROVIDER_ONBOARDING_UNDER_REVIEW` | `account.provider_kyc_under_review` | Análise NetCred |
| `PROVIDER_KYC_REJECTED` | `account.provider_kyc_rejected` | Rejeição; UI permite reenvio |
| `PROVIDER_ACTIVATED` | `account.provider_activated` | Já existia (cron de ativação) |
| `PROVIDER_SUSPENDED` | `account.provider_suspended` (+ variantes cliente/serviço) | Já existia |

Evidência: migrations `payment_mmd_notification_catalog`, `provider_activated_mmd_notification`; testes `payment_mmd_notification_catalog_test.sql`.

---

## 10. Fluxo operacional (resumo)

1. Prestador autenticado entra em `/dashboard/...`.
2. Layout aplica filtro de menu via KYC; `ProviderKycGate` consulta a conta NetCred.
3. Se path é Minha conta → conteúdo da conta.
4. Se `ACTIVE` → slots + outlet normais.
5. Caso contrário → tela de status / wizard de credenciamento conforme status; oportunidades e demais áreas operacionais ficam inacessíveis pelo shell.

---

## 11. Lacunas

| Item | Status |
|------|--------|
| Detalhamento campo a campo do formulário KYC | **Resolvido (Fase 3):** [formulário-credenciamento-wizard](./formulario-credenciamento-wizard.md) |
