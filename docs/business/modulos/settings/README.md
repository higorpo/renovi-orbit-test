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
5. Prestador: Informações pessoais (nome, e-mail, telefone — sem CPF); identidade legal (`/dashboard/settings/legal-identity`: escolha PF/PJ em tiles `radiogroup` — troca para o tipo **diferente** do atual abre `AlertDialog` de confirmação **antes** de `onChange`/auto-save; Cancelar fecha sem mudar; Trocar chama `onChange` e o auto-save segue; clicando no já selecionado ou com `disabled` não abre dialog; **não** limpa campos da outra entidade; **não** é o dialog antigo de ajuda; + painel de documentos; PF: grupo Documento/CPF; PJ: Empresa, Representante legal, Contato comercial; disclaimer jurídico abaixo das tiles; auto-save via `useProviderSettingsForm` inalterado); perfil profissional (`/dashboard/settings/professional-profile`: Tabs **Pedidos** (default) / **Vitrine**, padrão Pagamentos/`ClientPaymentsPage`; aba Pedidos: Serviços oferecidos + Área de atuação + hint auto-save; aba Vitrine: Perfil público + hint auto-save + Portfólio; skeleton `ProfessionalProfileFormSkeleton`; API inalterada); recebimentos (captura); ganhos (liquidação — feature `provider-earnings`).
6. Privacidade → exportação/mailto DPO (+ atalho da política); Jurídico (`/dashboard/settings/legal`) → hub de documentos oficiais (termos, política; prestador também contrato de uso); Conta (`/dashboard/settings/session`) → exclusão via `DangerZoneSection` (mailto DPO); **Sair da conta** (item de rodapé da nav, sem rota) → `LogoutConfirmDialog` → `signOut`.

## 6. Regras transversais

- E-mail Auth **somente leitura** na UI.
- Slug público: gerado na primeira definição “real” de `display_name` (quando slug ainda é null/`providerId`); depois de slug real, mudança de nome **não** regenera slug.
- Documentos jurídicos (seção Jurídico + atalho em Privacidade): URLs só se `VITE_MAIN_SITE_URL`; senão texto “em breve” por documento. Paths: `/juridico/termos-de-uso`, `/juridico/politica-de-privacidade`, `/juridico/adesao-prestador` (só UI prestador). Não inclui política de comissões nem adesão-cliente.
- Exclusão de conta: orientação mailto DPO em `DangerZoneSection` na seção Conta (sem delete imediato na API).
- **Jurídico** (`legal`) ≠ **Identidade legal** (`legal-identity`): o primeiro é hub de links externos; o segundo é cadastro PF/PJ do prestador (onde o prestador edita CPF/CNPJ). Em `personal-info`, o cliente vê CPF em Dados pessoais; o prestador **não** (`DadosPessoaisSection` com `showCpf={false}`).
- **Identidade legal (UI):** header “Identidade legal” / “Como você atua na Prestway e os documentos do cadastro”; `EntityTypeSection` (tiles PF/PJ em `radiogroup`; **sem** dialog “Preciso de ajuda para escolher”); ao escolher o tipo **diferente** do `entity_type` atual, abre `AlertDialog` (mesmo padrão de `LogoutConfirmDialog`, não bottom sheet) **antes** de `onChange` — títulos “Trocar para pessoa jurídica?” / “Trocar para pessoa física?”; botões **Cancelar** (fecha, seleção permanece) e **Trocar** (`onChange` + auto-save em `ProviderLegalIdentityPage` via `form.setValue(..., { shouldDirty: true })`); tipo já selecionado ou `disabled` não abre dialog; **não** limpa campos da outra entidade; `LegalIdentitySection` (um painel); loading com `LegalIdentityFormSkeleton` (não o skeleton monolítico do prestador). Sem mudança de persistência/API.
- **Perfil profissional (UI):** rota `/dashboard/settings/professional-profile` inalterada; nav e stack mobile continuam “Perfil profissional”. Header desktop (`SettingsSectionHeader`): “Perfil profissional” / “Pedidos que você recebe e como os clientes te veem”. Layout em **Tabs** (`aria-label="Seções do perfil profissional"`), padrão Pagamentos (`ClientPaymentsPage`: `TabsList` grid 2 colunas, `rounded-xl bg-canvas-soft`): aba **Pedidos** (ícone Briefcase, value `orders`, default) — `OfferedServicesSection` (**Serviços oferecidos**: “Tipos de pedido que entram no seu feed”; busca com ícone; chips pill; empty “Nenhum serviço selecionado ainda. Busque acima para receber pedidos desses tipos.”) + `ServiceAreaSection` (**Área de atuação**: “Cidades e bairros em que você atende”; cidades em artigos com MapPin; empty “Nenhuma cidade adicionada. Inclua onde você atende para receber pedidos da região.”; mobile Drawer vaul para editar bairros, desktop Popover) + `SettingsAutosaveHint`; aba **Vitrine** (ícone Eye, value `showcase`) — `PublicProfileSettingsSection` (**Perfil público**: “Nome, bio e visibilidade do perfil”; visibilidade em tiles `radiogroup` Público/Restrito, padrão `EntityTypeSection`; barra “Ver como os clientes veem” com Visualizar perfil / Copiar link quando há slug; **não** embute área de atuação), `SettingsAutosaveHint`, **Portfólio** (`PortfolioManagementSection`: “Trabalhos exibidos no perfil público”; cards capa + título; empty ilustrado; DnD e dialog add/edit inalterados em contrato). Cards empilhados com `space-y-5`. `SettingsConsequenceGroup` **removido** (sem capítulos editoriais “Como você atua” / “Como os clientes te veem”). Loading: `ProfessionalProfileFormSkeleton` (barra de abas + cards da aba Pedidos: ofertados + área + hint). Persistência/auto-save/API inalterados. Sem rota nova e sem item novo na nav.
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

- `src/features/settings/` — `SettingsLayout`, `SettingsIndexPage`, `SettingsNavList`, `LogoutConfirmDialog`, `constants/routes.ts`, `constants/settingsNav.ts`, `components/sections/*` (Jurídico = `AccountLegalPage` + `LegalDocumentsSection`; Conta = `AccountSessionPage` + `DangerZoneSection`; Identidade legal = `ProviderLegalIdentityPage` + `EntityTypeSection` + `LegalIdentitySection` + `LegalIdentityFormSkeleton`; Perfil profissional = `ProviderProfessionalProfilePage` + Tabs Pedidos/Vitrine + `OfferedServicesSection` + `PublicProfileSettingsSection` + `ServiceAreaSection`/`ServiceAreaField` + `PortfolioManagementSection` + `SettingsAutosaveHint` + `ProfessionalProfileFormSkeleton`)
- `src/router.tsx` — `path: 'settings'` + children
- `src/layouts/DashboardLayout/dashboardMenu.ts` — Configurações → `ROUTE_SETTINGS`
- `src/layouts/DashboardLayout/mobileNavigation.config.ts` — índice tab-root; seções stack → `/dashboard/settings`
- Detalhe: [features/configuracoes.md](./features/configuracoes.md)
- Constantes: `constants.ts` (2 MB foto, 5 MB portfólio, `dpo@prestway.com`)
- ADR: `docs/adr/0002-account-settings-hub.md`
