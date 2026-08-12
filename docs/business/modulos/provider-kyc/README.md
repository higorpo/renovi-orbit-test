# Credenciamento do prestador (`provider-kyc`)

## 1. Leitura para negócio

- **Para que serve:** impedir que o prestador use o **conteúdo operacional** do painel e o **chrome de navegação** (desktop nav, bottom nav, hamburger) até o onboarding NetCred estar **`ACTIVE`**; coletar/reenviar documentos via wizard; informar o status da análise. Depois do envio, os anexos e os dados bancários persistidos podem ser **consultados** (não editados) em Configurações.
- **Quem usa:** prestadores autenticados (`profiles.role === provider`).
- **Não é:** onboarding de cadastro/auth (`/cadastro/profissional`). É **credenciamento de pagamentos NetCred** (KYC para split/recebimento).
- **Valor:** só prestadores credenciados operam na plataforma; header com **logo** permanece; allowlist de conteúdo **`/dashboard/settings*`**. Menus ficam **completamente ocultos** enquanto loading ou status ≠ `ACTIVE`.
- **Fases de UI:** Fase 2 — gate no shell + telas de status + polling; Fase 3 — wizard (`entity → identity → bank → documents → review`) hospedado pelo gate; chrome de nav oculto via `useProviderKycBlocksNav`. Backend de cobrança/KYC (RPCs `payment_*`, Edge NetCred) permanece no domínio de pagamentos.

## 2. Visão geral funcional

- **Objetivo:** `ProviderKycGate` no `DashboardLayout` substitui slots do prestador + `<Outlet />` por status/wizard enquanto `onboarding_status !== ACTIVE` (ou conta NetCred ausente). Em paralelo, `useProviderKycBlocksNav` faz o layout esconder DesktopNav, bottom nav e hamburger (e remover `pb-20` do `main`). Isso **substitui** o comportamento de “menu completo sempre visível enquanto o gate bloqueia só o conteúdo”.
- **Escopo deste módulo (front):** gate, hook de bloqueio de nav, telas `components/status/*`, query/polling da conta, retry de e-mail, wizard e API de upload/submit usadas pelo wizard; Public API de consulta (`listKycOnboardingDocuments`, `getKycDocumentSignedUrl`, URLs de suporte) consumida pelo hub Configurações.
- **Limites:** não redefine guards de rota; não implementa cobrança; `ClientMyServicesPersistentSlot` e `ServiceDetailSheet` ficam **fora** do gate; `getDashboardMenu` ainda define o menu completo — o layout **omite** a renderização quando bloqueado.
- **Exceção de path:** `/dashboard/settings` e `/dashboard/settings/…` liberam children **depois** do loading (allowlist `PROVIDER_KYC_ALLOWED_PATH_PREFIX`); chrome de nav **permanece oculto** se ainda não-`ACTIVE`.

## 3. Features do módulo

| Feature | Resumo | Documento |
|---------|--------|-----------|
| Gate de acesso operacional | Bloqueio de conteúdo + ocultação do chrome de nav; telas por status; allowlist conta; polling 5s/30s; retry e-mail 15s | [features/gate-e-acesso-operacional.md](./features/gate-e-acesso-operacional.md) |
| Wizard de formulário KYC (Fase 3) | Passos, banco FEBRABAN, uploads Option A, identidade na RPC, analytics | [features/formulario-credenciamento-wizard.md](./features/formulario-credenciamento-wizard.md) |
| Lembretes de credenciamento incompleto | Cron diário (11:00 UTC) + MMD push/e-mail para `PENDING_DOCUMENTS` / `REJECTED`; deep link SQL ainda `/dashboard/conta` (rota removida — gap) | [features/lembretes-credenciamento-incompleto.md](./features/lembretes-credenciamento-incompleto.md) |

## 4. Perfis envolvidos

| Papel | Comportamento |
|-------|---------------|
| Prestador | Gate + query NetCred; se loading ou não `ACTIVE`: menus ocultos + conteúdo operacional substituído por UIs de status/wizard |
| Cliente | Gate transparente (`children`); nav normal |
| Visitante | Sem dashboard (guards de `auth`) |

## 5. Principais fluxos

1. Prestador autenticado entra em `/dashboard/...`.
2. Layout calcula `getDashboardMenu(role)` e `useProviderKycBlocksNav`; `ProviderKycGate` consulta `provider_gateway_accounts` (`gateway_slug = netcred`).
3. Loading → spinner “Verificando credenciamento…” + menus já ocultos (sem flash).
4. Path Configurações (allowlist) → conteúdo da conta (chrome ainda oculto se bloqueado).
5. `ACTIVE` → slots + outlet + menus normais.
6. Caso contrário → tela de status ou wizard; deep links operacionais mostram KYC, não a feature alvo; sem chrome de nav.

## 6. Regras transversais do módulo

1. Liberação operacional = `onboarding_status === ACTIVE` (e conta carregada para o chrome).
2. Qualquer outro status (incl. `SUSPENDED`, `REJECTED`, `UNDER_NETCRED_REVIEW`, `DOCUMENTS_SUBMITTED`, …) ou conta null bloqueia o **conteúdo** do shell (salvo allowlist) e o **chrome de navegação**.
3. `DOCUMENTS_SUBMITTED` sem `email_dispatched_at` = UI “Enviando…” + retry Edge `dispatch-kyc-email` (`retry_only`).
4. `useProviderKycBlocksNav` inclui **loading** da conta (evita flash de menus).
5. FSM no banco permite reenvio `REJECTED` → `DOCUMENTS_SUBMITTED` (e related); `ACTIVE` é terminal para saída de status.
6. Detalhe de campos/validação do envio: feature wizard; regra de cobrança sem `ACTIVE`: módulo payments.

## 7. Entidades

| Entidade / campo | Uso |
|------------------|-----|
| `provider_gateway_accounts` | `onboarding_status`, `email_dispatched_at`, `onboarding_submitted_at`, `onboarding_reminder_count`, `last_onboarding_reminder_at` (gateway `netcred`) |
| Stub bootstrap | Trigger `trg_profiles_bootstrap_provider_gateway_account` cria linha `PENDING_DOCUMENTS` (`document=''`) quando `profiles.role` vira provider |
| `provider_profiles_private` | Prefill do wizard (não do gate); fonte da seção Configurações → Dados bancários (somente leitura) e → Documentos (paths dos anexos, somente leitura + download) |
| `provider_kyc_upload_sessions` + bucket `provider-kyc-documents` | Uploads Option A (wizard) |
| Cache React Query `["provider-payment-account", providerId]` | Leitura/polling do gate e do hook de nav |

## 8. Integrações

| Módulo / peça | Relação |
|---------------|---------|
| **dashboard-shell** | `DashboardLayout` hospeda `ProviderKycGate` e consome `useProviderKycBlocksNav` (`hideMenu`, DesktopNav, bottom nav, `pb-20`) |
| **settings** | Allowlist `/dashboard/settings*` — conteúdo liberado com KYC bloqueado (a rota `/dashboard/settings/kyc-documents` já entra no prefixo); após persistir no wizard, os dados bancários são **exibidos** (não editados) em Configurações → Dados bancários (`/dashboard/settings/payout-methods`) e os anexos são **consultados/baixados** em Configurações → Documentos (`/dashboard/settings/kyc-documents`); settings reutiliza `useBrazilianBanks` / `formatBankLabel`, `listKycOnboardingDocuments`, `getKycDocumentSignedUrl` e `PROVIDER_KYC_SUPPORT_URL` / `PROVIDER_KYC_HELP_MAILTO` |
| **payments** | Conta NetCred; RPCs `payment_*`; cron `detect-netcred-onboarding` (10:00 UTC); cobrança exige `ACTIVE` |
| **message-dispatcher** | Eventos `PROVIDER_KYC_SUBMITTED`, `PROVIDER_ONBOARDING_UNDER_REVIEW`, `PROVIDER_KYC_REJECTED`, `PROVIDER_ACTIVATED`, `PROVIDER_SUSPENDED`, `PROVIDER_ONBOARDING_INCOMPLETE_REMINDER` |
| Cron lembretes incompletos | `enqueue_provider_onboarding_incomplete_reminders` / `cron_enqueue_*` + pg_cron `0 11 * * *` (job `enqueue_provider_onboarding_incomplete_reminders`); telemetria `job_runs` |
| Edge `dispatch-kyc-email` | Envio pós-submit e retry do gate (Inbucket/Mailpit se `INBUCKET_SMTP_HOST`; senão Resend) |

## 9. Riscos e lacunas

- Falha na fetch da conta: hook lança erro; gate sem `data` trata como pendente → wizard (sem tela de erro dedicada) — ver gate §17–§20.
- Loading temporário: spinner no gate + menus ocultos; allowlist de conta só após loading.
- Deep link operacional mostra UI KYC em vez da feature — pode confundir QA.
- Wizard e gate são features distintas no mesmo módulo; não misturar escopos de documentação.

## 10. Evidências

- `src/features/provider-kyc/` (`ProviderKycGate`, `useProviderKycBlocksNav`, `status/*`, hooks de conta/retry/wizard, `api/kyc.api.ts` incl. `getKycDocumentSignedUrl`, `utils/kycOnboardingDocuments.ts`)
- `src/layouts/DashboardLayout/DashboardLayout.tsx`, `MobileTabHeader.tsx` (`hideMenu`), `dashboardMenu.ts`
- FSM + bootstrap + contadores de lembrete: `supabase/migrations/20260801060000_create_provider_gateway_accounts.sql`
- Lembretes: `supabase/migrations/20260810162641_provider_onboarding_incomplete_reminders.sql`
- RPCs/storage: `payment_submit_provider_kyc`, sessões `provider_kyc_upload_sessions`, janitor `payment_janitor_orphan_kyc_documents`, bucket `provider-kyc-documents`
- Features: [gate-e-acesso-operacional](./features/gate-e-acesso-operacional.md), [formulário-credenciamento-wizard](./features/formulario-credenciamento-wizard.md), [lembretes-credenciamento-incompleto](./features/lembretes-credenciamento-incompleto.md)
