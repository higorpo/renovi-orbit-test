# Configurações (`settings`)

## 1. Leitura para negócio

- **Para que serve:** hub responsivo de configurações da conta (**cliente** e **prestador**) sob `/dashboard/settings/*` (slugs em inglês): dados cadastrais, foto, privacidade/LGPD, documentos oficiais (seção **Jurídico**), exclusão de conta (seção Conta); no prestador, identidade legal (`legal-identity`, cadastro PF/PJ e documentos — CPF só aqui, não em Informações pessoais), perfil profissional (público `/perfil/:slug`, ofertados, área, portfólio), recebimentos na captura e hospedagem da UI de Ganhos. Logout fica no rodapé da navegação do hub (não é rota).
- **Quem usa:** `client` e `provider` autenticados (`ProtectedRoute` no dashboard).
- **Valor:** qualidade cadastral para matching/confiança; conformidade LGPD (exportação/exclusão via DPO); um único hub de conta no menu (sem itens separados Endereços / Ganhos).
- **Fase 1 (shell):** navegação por seções; formulários/UIs existentes reutilizados; auto-save inalterado. ADR: [`docs/adr/0002-account-settings-hub.md`](../../../adr/0002-account-settings-hub.md).
- **Embutidos (não documentar aqui em profundidade):** endereços (`addresses`) e histórico/cartões (`payments`) — apenas links. Ganhos: UI de `provider-earnings` hospedada em `/dashboard/settings/earnings`.
- **Riscos:** dados sensíveis (CPF/CNPJ); exclusão **não** apaga via API — fluxo por e-mail ao DPO.

## 2. Visão geral funcional

- **Entrada:** menu **Configurações** → `/dashboard/settings` (`ROUTE_SETTINGS`).
- **Mobile:** índice = lista de seções + `AccountSummaryCard` acima; cada seção é chrome **stack** com voltar para `/dashboard/settings`. Na lista: seções (cauda compartilhada **Privacidade** → **Jurídico** → **Conta**) e, abaixo do divisor, **Sair da conta** (abre diálogo; não navega).
- **Desktop:** sidebar + conteúdo (mesma ordem: Jurídico e Conta na lista principal; **Sair da conta** no rodapé); visitar `/dashboard/settings` redireciona para `/dashboard/settings/personal-info`; `AccountSummaryCard` só em personal-info (desktop).
- **Persistência:** `profiles`, `client_profiles_private`, `provider_profiles_private`, `provider_profiles_public`, `provider_offered_services`, `provider_service_area_neighborhoods`, `provider_portfolio_items`; buckets `profile-images` e `provider-portfolio-images`.
- **UX de edição:** auto-save (debounce **1,5 s** cliente, **2 s** prestador); portfólio e serviços ofertados com ações explícitas; texto “As alterações são salvas automaticamente.”

## 3. Features do módulo

| Feature | Documento |
|---------|-----------|
| Configurações (hub, seções, campos, validações por papel) | [features/configuracoes.md](./features/configuracoes.md) |

## 4. Perfis envolvidos

| Perfil | Hub `/dashboard/settings` | Seções |
|--------|--------------------------|--------|
| Cliente | Sim | personal-info, addresses, payments, privacy, legal, session |
| Prestador | Sim | personal-info, legal-identity, professional-profile, receivables, earnings, privacy, legal, session |
| Prestador sem KYC `ACTIVE` | Sim (allowlist `ProviderKycGate` = `/dashboard/settings`) | Logout/ajustes enquanto shell operacional bloqueado — ver [provider-kyc](../provider-kyc/features/gate-e-acesso-operacional.md) |

## 5. Principais fluxos

1. Abrir Configurações → mobile: índice; desktop: redirect para personal-info.
2. Abrir seção → carregar/editar (auto-save / ações explícitas conforme seção).
3. Foto → upload/remove storage + path em `profiles` (summary no índice mobile / personal-info desktop).
4. Cliente: endereços / pagamentos (Tabs **Formas de pagamento** + **Histórico** de captura).
5. Prestador: Informações pessoais (nome, e-mail, telefone — sem CPF); identidade legal (`/dashboard/settings/legal-identity`: escolha PF/PJ em tiles `radiogroup` — troca para o tipo **diferente** do atual abre `AlertDialog` de confirmação **antes** de `onChange`/auto-save; Cancelar fecha sem mudar; Trocar chama `onChange` e o auto-save segue; clicando no já selecionado ou com `disabled` não abre dialog; **não** limpa campos da outra entidade; **não** é o dialog antigo de ajuda; + painel de documentos; PF: grupo Documento/CPF; PJ: Empresa, Representante legal, Contato comercial; disclaimer jurídico abaixo das tiles; auto-save via `useProviderSettingsForm` inalterado); perfil profissional (`/dashboard/settings/professional-profile`: quatro cards — Serviços oferecidos, Perfil público, Área de atuação, Portfólio; skeleton `ProfessionalProfileFormSkeleton`; API inalterada); recebimentos (captura); ganhos (liquidação — feature `provider-earnings`).
6. Privacidade → exportação/mailto DPO (+ atalho da política); Jurídico (`/dashboard/settings/legal`) → hub de documentos oficiais (termos, política; prestador também contrato de uso); Conta (`/dashboard/settings/session`) → exclusão via `DangerZoneSection` (mailto DPO); **Sair da conta** (item de rodapé da nav, sem rota) → `LogoutConfirmDialog` → `signOut`.

## 6. Regras transversais

- E-mail Auth **somente leitura** na UI.
- Slug público: gerado na primeira definição “real” de `display_name` (quando slug ainda é null/`providerId`); depois de slug real, mudança de nome **não** regenera slug.
- Documentos jurídicos (seção Jurídico + atalho em Privacidade): URLs só se `VITE_MAIN_SITE_URL`; senão texto “em breve” por documento. Paths: `/juridico/termos-de-uso`, `/juridico/politica-de-privacidade`, `/juridico/adesao-prestador` (só UI prestador). Não inclui política de comissões nem adesão-cliente.
- Exclusão de conta: orientação mailto DPO em `DangerZoneSection` na seção Conta (sem delete imediato na API).
- **Jurídico** (`legal`) ≠ **Identidade legal** (`legal-identity`): o primeiro é hub de links externos; o segundo é cadastro PF/PJ do prestador (onde o prestador edita CPF/CNPJ). Em `personal-info`, o cliente vê CPF em Dados pessoais; o prestador **não** (`DadosPessoaisSection` com `showCpf={false}`).
- **Identidade legal (UI):** header “Identidade legal” / “Como você atua na Prestway e os documentos do cadastro”; `EntityTypeSection` (tiles PF/PJ em `radiogroup`; **sem** dialog “Preciso de ajuda para escolher”); ao escolher o tipo **diferente** do `entity_type` atual, abre `AlertDialog` (mesmo padrão de `LogoutConfirmDialog`, não bottom sheet) **antes** de `onChange` — títulos “Trocar para pessoa jurídica?” / “Trocar para pessoa física?”; botões **Cancelar** (fecha, seleção permanece) e **Trocar** (`onChange` + auto-save em `ProviderLegalIdentityPage` via `form.setValue(..., { shouldDirty: true })`); tipo já selecionado ou `disabled` não abre dialog; **não** limpa campos da outra entidade; `LegalIdentitySection` (um painel); loading com `LegalIdentityFormSkeleton` (não o skeleton monolítico do prestador). Sem mudança de persistência/API.
- **Perfil profissional (UI):** rota `/dashboard/settings/professional-profile` inalterada; header “Perfil profissional” / “Serviços, área de atuação, perfil público e portfólio”. Quatro capítulos (cards): (1) **Serviços oferecidos** — busca com ícone; chips pill; empty state se nenhum serviço; (2) **Perfil público** — nome, bio; visibilidade em tiles `radiogroup` (Público / Restrito, padrão visual de `EntityTypeSection`: check, ícones Globe/Lock; títulos sem prefixo “Público —”); barra “Ver como os clientes veem” com Visualizar perfil / Copiar link quando há slug; **não** embute área de atuação; (3) **Área de atuação** (`ServiceAreaSection`) — card próprio; cidades em artigos com MapPin; empty state; no mobile, editar bairros usa Drawer (vaul), desktop Popover; (4) **Portfólio** — lista em cards (capa + título); empty state ilustrado; DnD e dialog add/edit inalterados em contrato. Loading: `ProfessionalProfileFormSkeleton` (não o skeleton monolítico do prestador). Persistência/auto-save/API inalterados.
- Logout: item **Sair da conta** no rodapé de `SettingsNavList` (sidebar desktop + índice mobile); confirmação em `LogoutConfirmDialog` (`AlertDialog`); não é slug/rota.
- Rotas removidas (sem redirect): `/dashboard/conta`, `/dashboard/earnings`, `/dashboard/addresses`.

## 7. Entidades

| Tabela / bucket | Uso |
|-----------------|-----|
| `profiles` | Nome, telefone, foto, role |
| `client_profiles_private` | CPF cliente |
| `provider_profiles_private` | PF/PJ e documentos |
| `provider_profiles_public` | slug, display_name, bio, visibility |
| `provider_offered_services` | Catálogo escolhido |
| `provider_service_area_neighborhoods` | Bairros |
| `provider_portfolio_items` | Portfólio |
| Storage `profile-images` / `provider-portfolio-images` | Imagens |

## 8. Integrações

| Módulo | Uso neste hub |
|--------|----------------|
| `auth` | `useAuth`, `profileApi.updateProfile`, `signOut` |
| `addresses` | Seção `/dashboard/settings/addresses` (só cliente) — ver [addresses](../addresses/README.md) |
| `payments` | Seção payments (cliente: abas Formas de pagamento / Histórico) e receivables (prestador: histórico captura) — ver [historico-e-reembolso](../payments/features/historico-e-reembolso.md) |
| `request-quote` | Estilo de card em ofertados (`getServiceCardStyle`) |
| `provider-profile` | Página pública `/perfil/:slug` (destino do link) |
| `provider-kyc` | Allowlist prefix `/dashboard/settings` |
| `provider-earnings` | UI Ganhos hospedada em `/dashboard/settings/earnings` (`ProviderEarningsSectionPage` → `EarningsPage`); ownership da feature permanece em `provider-earnings` |

## 9. Riscos e lacunas

| Item | Status |
|------|--------|
| Exclusão de conta | Só orientação DPO via `DangerZoneSection` (sem delete imediato) |
| Limite máx. imagens por item de portfólio | Não explícito no front (só 5 MB/arquivo) |
| Erro de validação de foto no seletor | Retorno silencioso sem toast em `AccountSummaryCard` |

## 10. Evidências

- `src/features/settings/` — `SettingsLayout`, `SettingsIndexPage`, `SettingsNavList`, `LogoutConfirmDialog`, `constants/routes.ts`, `constants/settingsNav.ts`, `components/sections/*` (Jurídico = `AccountLegalPage` + `LegalDocumentsSection`; Conta = `AccountSessionPage` + `DangerZoneSection`; Identidade legal = `ProviderLegalIdentityPage` + `EntityTypeSection` + `LegalIdentitySection` + `LegalIdentityFormSkeleton`; Perfil profissional = `ProviderProfessionalProfilePage` + `OfferedServicesSection` + `PublicProfileSettingsSection` + `ServiceAreaSection`/`ServiceAreaField` + `PortfolioManagementSection` + `ProfessionalProfileFormSkeleton`)
- `src/router.tsx` — `path: 'settings'` + children
- `src/layouts/DashboardLayout/dashboardMenu.ts` — Configurações → `ROUTE_SETTINGS`
- `src/layouts/DashboardLayout/mobileNavigation.config.ts` — índice tab-root; seções stack → `/dashboard/settings`
- Detalhe: [features/configuracoes.md](./features/configuracoes.md)
- Constantes: `constants.ts` (2 MB foto, 5 MB portfólio, `dpo@prestway.com`)
- ADR: `docs/adr/0002-account-settings-hub.md`
