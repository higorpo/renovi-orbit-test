# Perfis e permissões

Consolidação transversal a partir de `src/router.tsx`, `src/features/auth/` (`routeGuards`, `AuthProvider` / `getRedirectPathForProfile`, tipos), `src/layouts/DashboardLayout/dashboardMenu.ts`, `src/features/provider-kyc/` (gate + allowlist), `src/features/push-permission/`, `src/features/device-beacon/`, docs de [dashboard-shell](./modulos/dashboard-shell/), [chats](./modulos/chats/README.md), [service-reschedule](./modulos/service-reschedule/), [payments](./modulos/payments/), [service-completion](./modulos/service-completion/) e políticas resumidas nas migrações Supabase.

## Papéis (`profiles.role`)

Valores permitidos no modelo: **`client`**, **`provider`**, **`admin`** (CHECK em migrations de `profiles`).

Restrições de **atribuição de papel** (triggers / políticas):

- Signup pela aplicação aceita apenas **client** ou **provider** nos fluxos tipados.
- Promoção a **admin** ou mudança **client → provider** por update é **bloqueada** por triggers de segurança (migrations `restrict_role_admin_security`, `profiles_security_role_and_image_path`).

---

## Matriz: rotas do front-end

Evidência: `src/router.tsx` (árvore atual).

| Rota | Autenticação / guard | Papéis | Real / Fake | Observação |
|------|----------------------|--------|-------------|------------|
| `/` | Pública | — | Real (home) | |
| `/pedir-orcamento` | Pública (logado ou convidado) | — | Real | |
| `/perfil/:slug` | Pública | — | Real | Perfil público do prestador |
| `/login`, `/cadastro/cliente`, `/cadastro/profissional`, `/esqueceu-senha` | `GuestOnlyRoute` | Só convidado | Real | Logado com papel “permitido” → redirect |
| `/recuperar-senha` | Pública (sem GuestOnly) | — | Real | |
| `/dev/demo/form`, `/dev/demo/*-service-card-showcase` | DEV apenas | — | Demo | Paths sob `dev/demo/…` |
| `/dashboard` (layout) | `ProtectedRoute` | **`client`, `provider`** — **admin excluído** | Shell | + `DashboardLayout` |
| `/dashboard` (index) | Herdado | `client`, `provider` | **Fake** (“Visão geral”) | |
| `/dashboard/services` | Herdado | `client`, `provider` | Real (`my-services`) | Slot por papel no layout |
| `/dashboard/services/calendar` | Aninhado `provider` | **`provider` apenas** | Real (`provider-calendar`) | **Fora do menu**; entrada via banner em Meus Serviços |
| `/dashboard/services/:id` | Herdado | `client`, `provider` | Real (`view-services`) | Detalhe; sheet ou stack; **fora do menu** |
| `/dashboard/addresses` | Aninhado `client` | **`client` apenas** | **Fake** | Menu aponta aqui; gestão real em Minha conta |
| `/dashboard/conta` | Aninhado `client`+`provider` | `client`, `provider` | Real (`my-account`) | **Allowlist KYC** (prestador) |
| `/dashboard/settings` | Herdado | `client`, `provider` | **Fake** | Sem item de menu |
| `/dashboard/help` | Herdado | `client`, `provider` | **Fake** | No menu (overflow) |
| `/dashboard/jobs` | Aninhado `provider` | **`provider` apenas** | Real (`provider-jobs`) | |
| `/dashboard/earnings` | Aninhado `provider` | **`provider` apenas** | Real (`provider-earnings`) | Ganhos / liquidações |
| `/dashboard/chats` | Aninhado `client`+`provider` | `client`, `provider` | Real (`chats`) | Inbox CNS |
| `/dashboard/chats/:chatId` | Filho de chats | `client`, `provider` | Real (`chats`) | Thread; chrome mobile `custom` |
| `/example` | `ProtectedRoute` | **`client` apenas** | Demo | |
| `/admin/*` | **Não declarado** | — | — | Destino órfão — ver § Admin (P-02) |
| `/onboarding` | **Não declarado** | — | — | Fallback de papel desconhecido (P-03) |

### Redirecionamento pós-login (`getRedirectPathForProfile`)

| Papel | Destino | Situação |
|-------|---------|----------|
| `admin` | `/admin/dashboard` | **Rota inexistente** no `router.tsx` → **P-02** |
| `client` ou `provider` | `/dashboard` | OK |
| Desconhecido | `/onboarding` | Rota inexistente → **P-03**; log de aviso em DEV |

---

## Menu do dashboard (`getDashboardMenu`)

Evidência: `src/layouts/DashboardLayout/dashboardMenu.ts`. Bottom nav mobile = primeiros **5** itens (`CLIENT_MAIN_COUNT` / `PROVIDER_MAIN_COUNT`). Fallback de role no layout: `profile?.role ?? "client"`.

### Cliente (`role === "client"`)

| # | Label | Path | Bottom nav | Real / Fake |
|---|-------|------|------------|-------------|
| 1 | Visão geral | `/dashboard` | Sim | Fake |
| 2 | Meus Serviços | `/dashboard/services` | Sim | Real |
| 3 | Conversas | `/dashboard/chats` | Sim | Real |
| 4 | Endereços | `/dashboard/addresses` | Sim | Fake (reais em Minha conta) |
| 5 | Minha conta | `/dashboard/conta` | Sim | Real |
| 6 | Ajuda | `/dashboard/help` | Overflow | Fake |

### Prestador (qualquer role ≠ `client` no helper)

| # | Label | Path | Bottom nav | Real / Fake |
|---|-------|------|------------|-------------|
| 1 | Visão geral | `/dashboard` | Sim | Fake |
| 2 | Meus Serviços | `/dashboard/services` | Sim | Real |
| 3 | Trabalhos | `/dashboard/jobs` | Sim | Real |
| 4 | Conversas | `/dashboard/chats` | Sim | Real |
| 5 | Ganhos | `/dashboard/earnings` | Sim | Real |
| 6 | Minha conta | `/dashboard/conta` | Overflow | Real |
| 7 | Ajuda | `/dashboard/help` | Overflow | Fake |

**Não estão no menu:** `/dashboard/services/calendar`, `/dashboard/services/:id`, `/dashboard/settings`. Não há item “Orçamentos”.

**Menu do prestador (definição):** `getDashboardMenu(role)` sempre retorna o menu completo do papel — sem filtro por status KYC na definição dos itens.

**Chrome quando KYC bloqueia:** `useProviderKycBlocksNav` (provider + loading **ou** `shouldBlockProviderForKyc`) faz o `DashboardLayout` **ocultar** DesktopNav, bottom nav e hamburger (`MobileTabHeader` `hideMenu`); header/logo permanece; `pb-20` só com bottom nav visível. O `ProviderKycGate` substitui o **conteúdo** operacional quando `onboarding_status !== ACTIVE` (exceto allowlist `/dashboard/conta*`).

**Admin no helper:** ramificação só trata `client`; demais papéis recebem menu de prestador. Na prática o `ProtectedRoute` do dashboard **exclui** `admin`.

Detalhe: [placeholders-e-menu](./modulos/dashboard-shell/features/placeholders-e-menu.md).

---

## Gate de KYC no shell (`ProviderKycGate` + chrome)

Complementa (não substitui) os `ProtectedRoute`. Allowlist de conteúdo: `PROVIDER_KYC_ALLOWED_PATH_PREFIX = "/dashboard/conta"` (pathname igual ou `/dashboard/conta/…`).

| Situação | Efeito |
|----------|--------|
| `client` (ou `role !== "provider"`) | Gate transparente — renderiza children; nav normal |
| `provider` + `onboarding_status === ACTIVE` (conta carregada) | Conteúdo operacional liberado; chrome de nav visível |
| `provider` + loading da conta | Spinner “Verificando credenciamento…” (**antes** da allowlist); **menus ocultos** |
| `provider` + conta null ou status ≠ `ACTIVE`, path **fora** da allowlist | Slots + outlet → UIs KYC / wizard; **menus ocultos** |
| Path `/dashboard/conta` ou `/dashboard/conta/…` (após loading) | Children liberados (logout / conta) mesmo se ≠ `ACTIVE`; chrome **ainda oculto** se não-`ACTIVE` |

Guards de rota **não** impedem URL direta de `/dashboard/jobs`, `/dashboard/earnings`, `/dashboard/chats`, etc.: o papel `provider` passa; o **gate substitui** o conteúdo se não-`ACTIVE`; chrome permanece oculto.

Detalhe: [gate-e-acesso-operacional](./modulos/provider-kyc/features/gate-e-acesso-operacional.md).

---

## Soft prompt push e device-beacon (quem recebe geo)

Montados no `RootLayout` (todas as rotas sob o layout raiz) — fora do menu.

| Capacidade | Cliente | Prestador | Admin / role ausente | Visitante |
|------------|---------|-----------|----------------------|-----------|
| Soft prompt de push (`push-permission`) | Sim — copy de cliente; **sem** espera de localização | Sim — **depois** do fluxo de localização (quando iniciado); copy de prestador | Sim — copy genérica | Não |
| Cooldown dismiss soft prompt | 7 dias (Preferences) | Idem | Idem | — |
| Sync beacon / token FCM (`user_device_beacons`) | Sim (metadados / push; **sem** lat/lng operacionais) | Sim | Evidência: autenticados syncam beacon; campos de geo só se `role === 'provider'` | Não |
| Localização operacional (dialog + tracking → `provider_latest_locations`) | **Não** | **Sim** (exceto `operational_status = suspended`) | **Não** (gate `role === 'provider'`) | Não |
| Sequência `providerPermissionSequence` | N/A | Localização → depois push | N/A | — |

Evidências: [prompt-e-cooldown](./modulos/push-permission/features/prompt-e-cooldown.md), [rastreamento-dispositivo](./modulos/device-beacon/features/rastreamento-dispositivo.md).

---

## Ações por papel — CNS, propostas, reagendamento, pagamentos, conclusão

Admin **não** tem mutações de produto autenticadas documentadas nesses módulos; SELECT administrativo aparece em RLS/views pontuais. Resumo operacional:

### Conversas (CNS)

| Ação | Cliente | Prestador | Admin |
|------|---------|-----------|-------|
| Listar / abrir thread (participante) | Sim | Sim | — |
| Enviar TEXT / IMAGE / AUDIO (free messaging) | Sim | Sim | — |
| Iniciar conversa | — | Sim (entry em view-services) | — |
| Encerrar conversa | Sim | Sim | — |
| Banner enviar / revisar proposta | — | Sim | — |

Fonte: [conversas-e-negociacao](./modulos/chats/features/conversas-e-negociacao.md).

### Propostas de negociação

| Ação | Cliente | Prestador | Admin |
|------|---------|-----------|-------|
| Enviar / editar proposta | — | Sim | — |
| Aceitar (+ checkout) | Sim | — | — |
| Recusar / pedir revisão | Sim | — | — |
| Sheet comparar orçamentos | Sim | — | — |
| `decline_revision_request` | — | API sem UI | — |

Fonte: [propostas-negociacao](./modulos/chats/features/propostas-negociacao.md), [chats README](./modulos/chats/README.md).

### Reagendamento (pós-contrato)

| Ação | Cliente | Prestador | Sistema |
|------|---------|-----------|---------|
| Solicitar | Sim (janela ~48h antes da execução) | Sim (sem janela 48h; flag last-minute &lt;24h) | — |
| Propor slot | — | Sim | — |
| Pedir ajuste / aceitar proposta de data | Sim | — | — |
| Cancelar em `PROPOSED` | Sim | **Não** (`FORBIDDEN`) | — |
| Cancelar em `REQUESTED` / `ADJUSTMENT_REQUESTED` | Sim | Sim | — |
| Expirar / safety-net | — | — | Cron / `service_role` |

Fonte: [service-reschedule](./modulos/service-reschedule/README.md).

### Pagamentos

| Ação | Cliente | Prestador | Admin |
|------|---------|-----------|-------|
| Checkout no aceite / cartões / cobrança manual | Sim | — (precisa estar credentialed `ACTIVE` + company + bank no backend) | — |
| Histórico de pagamentos / recebimentos | Sim (captura) | Sim (recebíveis) | SELECT via `is_platform_admin()` em views |
| Cancelar serviço (ToS / refund path) | Sim (se elegível) | Sim (se elegível; estorno integral) | Sem UI dedicada no app |
| Ganhos / liquidações UI | — | `/dashboard/earnings` | — |
| Reset DEAD_LETTER / crons de cobrança | — | — | Ops `service_role` |

Fonte: [payments](./modulos/payments/README.md), [checkout-e-cobranca](./modulos/payments/features/checkout-e-cobranca.md), [historico-e-reembolso](./modulos/payments/features/historico-e-reembolso.md).

### Conclusão / enrichment (`service-completion`)

| Ação | Cliente (dono SR) | Prestador contratado | Prestador só-marketplace | Sistema |
|------|-------------------|----------------------|--------------------------|---------|
| `get_service_completion_context` (detalhe completo: checklist + ids) | Sim | Sim | **Não** — payload limitado (status/`ready`) | — |
| SELECT direto `service_request_enrichments` | **Não** (REVOKE authenticated) | **Não** | **Não** | `service_role` / workers |
| Ver banner enrichment “em processamento” | Sim (`PENDING`/`RUNNING`) | Sim (mesmo contexto no detalhe) | Status limitado se tiver acesso ao SR | Worker enrichment → READY |
| Draft checklist + marcar `EXECUTED` | — | Sim (`CONFIRMED`; CTA “Marcar serviço como concluído” → sheet/dialog; paths registrados) | — | — |
| Upload evidência (RPC create session → storage.upload autenticado → register) | — | Sim (sessão open, CS CONFIRMED, &lt; max_files, bucket `completion-evidence`; thumbnails+lightbox na UI; sem Edge de URL assinada) | — | Janitor SQL órfãos (`service_completion_janitor_orphan_uploads` / cron; sem Edge) |
| Confirmar + rating (scores obrigatórios) | Sim (`EXECUTED`; CTA “Avaliar serviço” → sheet 2 etapas) | — | — | — |
| Auto-complete ~24h após `EXECUTED` | — | — | — | Cron (`completed_by=system`; batch `auto_complete_batch_size`) |
| Stub disputa (URL ou “Em breve”) | Sim | — | — | — |
| Rating opcional pós auto-complete | Sim | — | — | — |

Admin de plataforma: contexto completo via RPC (mesmo sem ser participante); sem UI de mutação no app. Matching: create/republish **não** bootstrapa dispatch; só após enrichment READY; repair READY-sem-dispatch limitado a **7 dias**. Fonte: [service-completion](./modulos/service-completion/README.md).

---

## Admin sem área de produto (P-02)

| Fato | Evidência |
|------|-----------|
| Papel `admin` existe no banco / tipo `ProfileRole` | Migrations + `auth.types` |
| Dashboard do app **exclui** admin | `ProtectedRoute allowedRoles={['client','provider']}` em `/dashboard` |
| Pós-login / redirect de papel proibido aponta `/admin/dashboard` | `getRedirectPathForProfile` em `AuthProvider.tsx` |
| **Nenhuma** rota `/admin/*` em `router.tsx` | Inventário atual do router |
| Conclusão | Área admin **órfã**: usuário `admin` autenticado tende a **404** (ou error boundary) após redirect — pendência **[P-02](./pendencias-e-incertezas.md)** |

RLS/admin em tabelas de pagamento e catálogo **não** implica painel operacional no app.

---

## Ações permitidas no banco (visão de alto nível)

| Área | Cliente | Prestador | Admin |
|------|---------|-----------|-------|
| Ler/editar próprio perfil em `profiles` | Sim (dono) | Sim (dono) | Conforme RLS |
| `client_profiles_private` | Dono | — | Leitura administrativa (políticas) |
| `provider_profiles_private` / `public` | — | Dono (escrita pública condicionada a `provider`) | Conforme políticas |
| `service_requests` | CRUD sobre próprios pedidos onde aplicável | Leitura / fluxos de job conforme RPC e RLS | Muitas políticas incluem admin |
| `provider_proposals` / CNS | Ver/responder no fluxo de orçamento | Criar/atualizar próprias propostas; mutações CNS de participante | Sem mutação de produto autenticada documentada no app |
| `service_request_enrichments` | **Não** SELECT autenticado — RPC `get_service_completion_context` | Idem (detalhe completo só se prestador do CS) | Contexto completo via RPC; workers `service_role` |
| Helpers `platform_constant_*` | **Não** — EXECUTE revogado para `authenticated` / `anon` / `public` | Idem | `service_role` (e funções `SECURITY DEFINER` internas) |
| Catálogo (`platform_services`, `platform_forms`, cidades…) | Leitura conforme política | Leitura conforme política | Gestão onde política exige `admin` |

Para detalhes por tabela, ver arquivos em `supabase/migrations/` citados em [rastreabilidade](./rastreabilidade.md).

---

## Feature flags por papel

**Evidência parcial no código:** não foram encontradas flags de produto por role; apenas variáveis de ambiente de build/runtime (PWA, Sentry, cache React Query, etc.).

---

## Resumo executivo para operações

- O **painel** `/dashboard` é só para **`client` e `provider`**; cada área sensível reforça papel com `ProtectedRoute` aninhado (`addresses` → client; `jobs` / `earnings` / `services/calendar` → provider; `chats` / `conta` → ambos).
- Rotas reais fora do menu: **calendário** (`/dashboard/services/calendar`), **detalhe** (`/dashboard/services/:id`), **settings** (fake).
- **Prestador sem KYC `ACTIVE`:** conteúdo operacional bloqueado pelo gate; **menus ocultos** (desktop, bottom nav, hamburger); header/logo permanece; allowlist de conteúdo **`/dashboard/conta*`**.
- **Push:** soft prompt para autenticados (copy por papel); **geo operacional só prestador** (device-beacon).
- **CNS / propostas / reagendamento / pagamentos / conclusão:** matrizes acima; admin sem UI de mutação nesses fluxos.
- **Admin:** papel no banco + redirect para `/admin/dashboard` **sem rota** — **P-02**.
- Endereços no menu cliente: **placeholder**; gestão real em **Minha conta**.
