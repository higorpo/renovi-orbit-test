# Configurações (`settings`)

## 1. Leitura para negócio

- **Para que serve:** hub responsivo de configurações da conta (**cliente** e **prestador**) sob `/dashboard/settings/*` (slugs em inglês): dados cadastrais, foto, privacidade/LGPD, documentos oficiais (seção **Jurídico**), exclusão de conta (seção Conta); no prestador, identidade legal (`legal-identity`, cadastro PF/PJ **editável** — CPF só aqui, não em Informações pessoais; **não** é download de arquivos), **Documentos** (`kyc-documents` — anexos do onboarding/KYC, somente leitura + download; alterações só pelo suporte), perfil profissional (público `/perfil/:slug`, ofertados, área, portfólio), **Dados bancários** (`payout-methods` — consulta somente leitura da conta de depósito já persistida no KYC/onboarding) e **Ganhos** (página unificada: captura/valor combinado + liquidações bancárias). Logout fica no rodapé da navegação do hub (não é rota).
- **Quem usa:** `client` e `provider` autenticados (`ProtectedRoute` no dashboard).
- **Valor:** qualidade cadastral para matching/confiança; conformidade LGPD (exportação/exclusão via DPO); um único hub de conta no menu (sem itens separados Endereços / Ganhos).
- **Fase 1 (shell):** navegação por seções; formulários/UIs existentes reutilizados; auto-save inalterado. ADR: [`docs/adr/0002-account-settings-hub.md`](../../../adr/0002-account-settings-hub.md).
- **Embutidos (não documentar aqui em profundidade):** endereços (`addresses`) e histórico/cartões do **cliente** (`payments`) — apenas links. Prestador: página **Ganhos** em `/dashboard/settings/earnings` — settings **compõe** Public API de `provider-earnings` (período + ledger + depósitos) e `payments` (lista de captura na aba Cobranças), no mesmo padrão de Pagamentos do cliente. **Dados bancários** também **compõe**: lê `provider_profiles_private` (já persistido no KYC) e reutiliza catálogo/URLs de suporte de `provider-kyc`; **não** edita banco/PIX. **Documentos** (`kyc-documents`) **compõe** Public API de `provider-kyc` (`listKycOnboardingDocuments`, `getKycDocumentSignedUrl`, URLs de suporte); lê os paths em `provider_profiles_private`; **não** reenvia arquivos.
- **Riscos:** dados sensíveis (CPF/CNPJ); exclusão **não** apaga via API — fluxo por e-mail ao DPO.

## 2. Visão geral funcional

- **Entrada:** menu **Configurações** → `/dashboard/settings` (`ROUTE_SETTINGS`).
- **Mobile:** índice = lista de seções + `AccountSummaryCard` acima; cada seção é chrome **stack** com voltar para `/dashboard/settings`. Na lista: seções (cauda compartilhada **Privacidade** → **Jurídico** → **Conta**) e, abaixo do divisor, **Sair da conta** (abre diálogo; não navega).
- **Desktop:** sidebar + conteúdo (mesma ordem: Jurídico e Conta na lista principal; **Sair da conta** no rodapé); visitar `/dashboard/settings` redireciona para `/dashboard/settings/personal-info`; `AccountSummaryCard` só em personal-info (desktop).
- **Persistência:** `profiles`, `client_profiles_private`, `provider_profiles_private`, `provider_profiles_public`, `provider_offered_services`, `provider_service_area_neighborhoods`, `provider_portfolio_items`; buckets `profile-images` e `provider-portfolio-images`.
- **UX de edição:** auto-save (debounce **1,5 s** cliente, **2 s** prestador); portfólio e serviços ofertados com ações explícitas; texto “As alterações são salvas automaticamente.” **Exceções:** Dados bancários e Documentos são somente leitura (sem auto-save; Documentos também sem re-upload).

## 3. Features do módulo

| Feature | Documento |
|---------|-----------|
| Configurações (hub, seções, campos, validações por papel) | [features/configuracoes.md](./features/configuracoes.md) |

## 4. Perfis envolvidos

| Perfil | Hub `/dashboard/settings` | Seções |
|--------|--------------------------|--------|
| Cliente | Sim | personal-info, addresses, payments, privacy, legal, session |
| Prestador | Sim | Nav: personal-info, legal-identity, **kyc-documents** (Documentos, ícone FileText — depois de Identidade legal e antes de Perfil profissional), professional-profile, **payout-methods** (Dados bancários, ícone Landmark), **earnings** (Ganhos), privacy, legal, session. Cliente **não** vê Documentos nem Dados bancários. Slug/rota legado `receivables` permanece (`PROVIDER_ONLY_SETTINGS_SECTIONS`; stack title “Ganhos”) e redireciona para Ganhos → Cobranças |
| Prestador sem KYC `ACTIVE` | Sim (allowlist `ProviderKycGate` = `/dashboard/settings`) | Logout/ajustes enquanto shell operacional bloqueado — ver [provider-kyc](../provider-kyc/features/gate-e-acesso-operacional.md) |

## 5. Principais fluxos

1. Abrir Configurações → mobile: índice; desktop: redirect para personal-info.
2. Abrir seção → carregar/editar (auto-save / ações explícitas conforme seção).
3. Foto → upload/remove storage + path em `profiles` (summary no índice mobile / personal-info desktop).
4. Cliente: endereços / pagamentos (Tabs **Formas de pagamento** + **Histórico** de captura).
5. Prestador: Informações pessoais (nome, e-mail, telefone — sem CPF); identidade legal (`/dashboard/settings/legal-identity`: escolha PF/PJ em tiles `radiogroup` — troca para o tipo **diferente** do atual abre `AlertDialog` de confirmação **antes** de `onChange`/auto-save; Cancelar fecha sem mudar; Trocar chama `onChange` e o auto-save segue; clicando no já selecionado ou com `disabled` não abre dialog; **não** limpa campos da outra entidade; **não** é o dialog antigo de ajuda; + painel de **campos** cadastrais PF/PJ — **não** é download de arquivos; PF: grupo Documento/CPF; PJ: Empresa, Representante legal, Contato comercial; disclaimer jurídico abaixo das tiles; auto-save via `useProviderSettingsForm` inalterado); **Documentos** (`/dashboard/settings/kyc-documents`: anexos do onboarding; somente leitura + **Baixar**; CTA **Falar com o suporte**; sem auto-save e sem re-upload); perfil profissional (`/dashboard/settings/professional-profile`: Tabs **Pedidos** (default) / **Vitrine**, padrão Pagamentos/`ClientPaymentsPage`; aba Pedidos: Serviços oferecidos + Área de atuação + hint auto-save; aba Vitrine: Perfil público + hint auto-save + Portfólio; skeleton `ProfessionalProfileFormSkeleton`; API inalterada); **Dados bancários** (`/dashboard/settings/payout-methods`: somente leitura; card “Conta para depósito”; CTA **Falar com o suporte**; sem auto-save e sem `BankPicker`); **Ganhos** (`/dashboard/settings/earnings`: período Este mês / 3 meses / 6 meses no mesmo poço das abas; ledger Cobranças / Depósitos, **sem** seta; captions **Valor combinado** / **Na sua conta**; conceitos distintos, números não misturados; `?view=` e `?period=` convivem; feature `provider-earnings` + lista de captura de `payments`). Rota legado `/dashboard/settings/receivables` faz `Navigate replace` para `/dashboard/settings/earnings?view=charges`.
6. Privacidade → exportação/mailto DPO (+ atalho da política); Jurídico (`/dashboard/settings/legal`) → hub de documentos oficiais (termos, política; prestador também contrato de uso); Conta (`/dashboard/settings/session`) → exclusão via `DangerZoneSection` (mailto DPO); **Sair da conta** (item de rodapé da nav, sem rota) → `LogoutConfirmDialog` → `signOut`.

## 6. Regras transversais

- E-mail Auth **somente leitura** na UI.
- Slug público: gerado na primeira definição “real” de `display_name` (quando slug ainda é null/`providerId`); depois de slug real, mudança de nome **não** regenera slug.
- Documentos jurídicos (seção Jurídico + atalho em Privacidade): URLs só se `VITE_MAIN_SITE_URL`; senão texto “em breve” por documento. Paths: `/juridico/termos-de-uso`, `/juridico/politica-de-privacidade`, `/juridico/adesao-prestador` (só UI prestador). Não inclui política de comissões nem adesão-cliente.
- Exclusão de conta: orientação mailto DPO em `DangerZoneSection` na seção Conta (sem delete imediato na API).
- **Jurídico** (`legal`) ≠ **Identidade legal** (`legal-identity`) ≠ **Documentos** (`kyc-documents`): Jurídico é hub de links oficiais da plataforma (termos etc.); Identidade legal é cadastro PF/PJ **editável** (CPF/CNPJ — auto-save; **não** baixa arquivos); Documentos são os **anexos** do onboarding/KYC (somente leitura + download; alterações só pelo suporte). **Dados bancários** (`payout-methods`) tem UX semelhante (somente leitura + CTA suporte), mas é conta/PIX, não arquivos. Em `personal-info`, o cliente vê CPF em Dados pessoais; o prestador **não** (`DadosPessoaisSection` com `showCpf={false}`).
- **Identidade legal (UI):** header “Identidade legal” / “Como você atua na Prestway e os documentos do cadastro”; `EntityTypeSection` (tiles PF/PJ em `radiogroup`; **sem** dialog “Preciso de ajuda para escolher”); ao escolher o tipo **diferente** do `entity_type` atual, abre `AlertDialog` (mesmo padrão de `LogoutConfirmDialog`, não bottom sheet) **antes** de `onChange` — títulos “Trocar para pessoa jurídica?” / “Trocar para pessoa física?”; botões **Cancelar** (fecha, seleção permanece) e **Trocar** (`onChange` + auto-save em `ProviderLegalIdentityPage` via `form.setValue(..., { shouldDirty: true })`); tipo já selecionado ou `disabled` não abre dialog; **não** limpa campos da outra entidade; `LegalIdentitySection` (um painel de **campos** PF/PJ — **não** baixa arquivos); loading com `LegalIdentityFormSkeleton` (não o skeleton monolítico do prestador). Sem mudança de persistência/API.
- **Perfil profissional (UI):** rota `/dashboard/settings/professional-profile` inalterada; nav e stack mobile continuam “Perfil profissional”. Header desktop (`SettingsSectionHeader`): “Perfil profissional” / “Pedidos que você recebe e como os clientes te veem”. Layout em **Tabs** (`aria-label="Seções do perfil profissional"`), padrão Pagamentos (`ClientPaymentsPage`: `TabsList` grid 2 colunas, `rounded-xl bg-canvas-soft`): aba **Pedidos** (ícone Briefcase, value `orders`, default) — `OfferedServicesSection` (**Serviços oferecidos**: “Tipos de pedido que entram no seu feed”; busca com ícone; chips pill; empty “Nenhum serviço selecionado ainda. Busque acima para receber pedidos desses tipos.”) + `ServiceAreaSection` (**Área de atuação**: “Cidades e bairros em que você atende”; cidades em artigos com MapPin; empty “Nenhuma cidade adicionada. Inclua onde você atende para receber pedidos da região.”; mobile Drawer vaul para editar bairros, desktop Popover) + `SettingsAutosaveHint`; aba **Vitrine** (ícone Eye, value `showcase`) — `PublicProfileSettingsSection` (**Perfil público**: “Nome, bio e visibilidade do perfil”; visibilidade em tiles `radiogroup` Público/Restrito, padrão `EntityTypeSection`; barra “Ver como os clientes veem” com Visualizar perfil / Copiar link quando há slug; **não** embute área de atuação), `SettingsAutosaveHint`, **Portfólio** (`PortfolioManagementSection`: “Trabalhos exibidos no perfil público”; cards capa + título; empty ilustrado; DnD inalterado; overlay add/edit no padrão Endereços/`AddCardSheetDialog` (`desktopPresentation="sheet"`): desktop (`useBreakpointMd`) **Sheet** `side="right"` (título Manrope; footer **Cancelar** / **Adicionar**|**Salvar**; close nativo sr-only “Fechar”); mobile **Drawer** (vaul, `shouldScaleBackground={false}`, `handleOnly`, `dismissible={!isWorking}`) com handle, botão “Fechar” e footer acima do teclado (`safe-area-inset-bottom`, blur); enquanto `isWorking` (criar/atualizar/submit), Cancelar disabled e overlay não fecha; contrato do formulário inalterado — título, descrição, imagens, create/update, `visibility: "public"` na página). Cards empilhados com `space-y-5`. `SettingsConsequenceGroup` **removido** (sem capítulos editoriais “Como você atua” / “Como os clientes te veem”). Loading: `ProfessionalProfileFormSkeleton` (barra de abas + cards da aba Pedidos: ofertados + área + hint). Persistência/auto-save/API inalterados. Sem rota nova e sem item novo na nav.
- **Documentos (UI):** rota `/dashboard/settings/kyc-documents` (`ROUTE_SETTINGS_KYC_DOCUMENTS`, slug `SETTINGS_SECTION.kycDocuments`); nav prestador **Documentos** (ícone `FileText`) **depois** de Identidade legal e **antes** de Perfil profissional; cliente **não** vê o item; `PROVIDER_ONLY_SETTINGS_SECTIONS` inclui `kycDocuments`; stack mobile title “Documentos”; `backFallback` `/dashboard/settings`. `SettingsRoleGate allow={["provider"]}` — cliente na URL é redirecionado para personal-info. Allowlist KYC já é prefixo `/dashboard/settings*` — a rota entra sem mudança de gate. Header “Documentos” / “Arquivos enviados na verificação da conta”. Card `KycDocumentsSection` “Documentos do cadastro” / “Enviados no cadastro. Alterações só pelo suporte.” Copy: “Estes documentos não podem ser alterados por aqui. Se precisar atualizar algum arquivo, fale com o suporte.” CTA **Falar com o suporte** (`<a target="_blank" rel="noopener noreferrer">`): `PROVIDER_KYC_SUPPORT_URL` ?? `PROVIDER_KYC_HELP_MAILTO`. Loading: `KycDocumentsFormSkeleton` (3 campos). Erro: `AccountErrorState` + retry. Sem auto-save, sem re-upload, sem edição. Slot com arquivo: filename + botão **Baixar** (`aria-label` “Baixar {label}”); slot vazio: “Não enviado”, sem Baixar. Download: `useProviderKycDocuments` chama `getKycDocumentSignedUrl` e `window.open(url, "_blank", "noopener,noreferrer")`; toast de erro “Não foi possível baixar o documento. Tente novamente.” Fonte: `getProviderPrivateProfile` (`select *`) via `useProviderProfile`; slots via `listKycOnboardingDocuments` (domínio `provider-kyc`). Sem RPC/migration nova (Storage SELECT do dono já existe). **≠** Identidade legal (campos) **≠** Jurídico (termos da plataforma).
- **Dados bancários (UI):** rota `/dashboard/settings/payout-methods` (`ROUTE_SETTINGS_PAYOUT_METHODS`); nav prestador **Dados bancários** (ícone Landmark) **depois** de Perfil profissional e **antes** de Ganhos; cliente **não** vê o item; `PROVIDER_ONLY_SETTINGS_SECTIONS` inclui `payoutMethods`; stack mobile title “Dados bancários”; `backFallback` `/dashboard/settings`. Header “Dados bancários” / “Conta onde a Prestway deposita os seus ganhos”. Card “Conta para depósito”: Banco, Agência, Conta com dígito e Chave PIX em inputs **read-only + disabled**. Sem auto-save, sem `BankPicker` editável; `updateProviderPrivateProfile` continua só com params de identidade legal (não envia `bank_*` / `pix_key`). Fonte: `getProviderPrivateProfile` (`select *`) via `useProviderProfile` / `useProviderPayoutMethods`. Sem RPC/migration nova. **≠** Ganhos (liquidação/movements). **≠** Documentos (anexos KYC).
- Logout: item **Sair da conta** no rodapé de `SettingsNavList` (sidebar desktop + índice mobile); confirmação em `LogoutConfirmDialog` (`AlertDialog`); não é slug/rota.
- Rotas removidas (sem redirect): `/dashboard/conta`, `/dashboard/earnings`, `/dashboard/addresses`.

## 7. Entidades

| Tabela / bucket | Uso |
|-----------------|-----|
| `profiles` | Nome, telefone, foto, role |
| `client_profiles_private` | CPF cliente |
| `provider_profiles_private` | PF/PJ, campos cadastrais, paths dos anexos KYC (`identity_doc_storage_path`, `address_proof_storage_path`, `corporate_charter_storage_path`, `legal_rep_doc_storage_path`) e dados bancários (`bank_institution_code`, `bank_branch`, `bank_account`, `pix_key`) — Dados bancários e Documentos **só lêem** esses campos |
| `provider_profiles_public` | slug, display_name, bio, visibility |
| `provider_offered_services` | Catálogo escolhido |
| `provider_service_area_neighborhoods` | Bairros |
| `provider_portfolio_items` | Portfólio |
| Storage `profile-images` / `provider-portfolio-images` | Imagens |
| Storage `provider-kyc-documents` | Anexos do onboarding (consulta/download em Documentos; ownership em `provider-kyc`) |

## 8. Integrações

| Módulo | Uso neste hub |
|--------|----------------|
| `auth` | `useAuth`, `profileApi.updateProfile`, `signOut` |
| `addresses` | Seção `/dashboard/settings/addresses` (só cliente) — ver [addresses](../addresses/README.md) |
| `payments` | Seção payments (cliente: abas Formas de pagamento / Histórico); prestador: lista de captura na aba **Cobranças** de Ganhos (`PaymentHistorySection role="provider"`) — ver [historico-e-reembolso](../payments/features/historico-e-reembolso.md) |
| `request-quote` | Estilo de card em ofertados (`getServiceCardStyle`) |
| `provider-profile` | Página pública `/perfil/:slug` (destino do link) |
| `provider-kyc` | Allowlist prefix `/dashboard/settings`; Dados bancários: catálogo FEBRABAN (`useBrazilianBanks`, `formatBankLabel`, `findBrazilianBankByCode`) e CTA suporte; Documentos: `listKycOnboardingDocuments`, `getKycDocumentSignedUrl` (bucket `provider-kyc-documents`, expiry `KYC_DOCUMENT_SIGNED_URL_EXPIRY_SEC` = 7 dias) e as mesmas URLs de suporte (`PROVIDER_KYC_SUPPORT_URL` = `VITE_MAIN_SITE_URL/suporte`, fallback `PROVIDER_KYC_HELP_MAILTO`) |
| `provider-earnings` | Página unificada Ganhos em `/dashboard/settings/earnings` (`ProviderEarningsSectionPage`: header + período + `EarningsLedgerSwitch` + `EarningsPage` / `PaymentHistorySection`); ownership da liquidação permanece em `provider-earnings`; captura em `payments` |

## 9. Riscos e lacunas

| Item | Status |
|------|--------|
| Exclusão de conta | Só orientação DPO via `DangerZoneSection` (sem delete imediato) |
| Limite máx. imagens por item de portfólio | Não explícito no front (só 5 MB/arquivo) |
| Erro de validação de foto no seletor | Retorno silencioso sem toast em `AccountSummaryCard` |

## 10. Evidências

- `src/features/settings/` — `SettingsLayout`, `SettingsIndexPage`, `SettingsNavList`, `LogoutConfirmDialog`, `constants/routes.ts` (`ROUTE_SETTINGS_KYC_DOCUMENTS`), `constants/settingsNav.ts`, `hooks/useEarningsLedgerSummary.ts`, `hooks/useProviderPayoutMethods.ts`, `hooks/useProviderKycDocuments.ts`, `components/sections/*` (Jurídico = `AccountLegalPage` + `LegalDocumentsSection`; Conta = `AccountSessionPage` + `DangerZoneSection`; Identidade legal = `ProviderLegalIdentityPage` + `EntityTypeSection` + `LegalIdentitySection` + `LegalIdentityFormSkeleton`; Documentos = `ProviderKycDocumentsPage` + `KycDocumentsSection` + `KycDocumentsFormSkeleton`; Perfil profissional = `ProviderProfessionalProfilePage` + Tabs Pedidos/Vitrine + `OfferedServicesSection` + `PublicProfileSettingsSection` + `ServiceAreaSection`/`ServiceAreaField` + `PortfolioManagementSection` + `SettingsAutosaveHint` + `ProfessionalProfileFormSkeleton`; Dados bancários = `ProviderPayoutMethodsPage` + `PayoutMethodsSection` + `PayoutMethodsFormSkeleton`; Ganhos = `ProviderEarningsSectionPage`; legado = `ProviderReceivablesPage` redirect)
- `src/router.tsx` — `path: 'settings'` + children
- `src/layouts/DashboardLayout/dashboardMenu.ts` — Configurações → `ROUTE_SETTINGS`
- `src/layouts/DashboardLayout/mobileNavigation.config.ts` — índice tab-root; seções stack → `/dashboard/settings`
- Detalhe: [features/configuracoes.md](./features/configuracoes.md)
- Constantes: `constants.ts` (2 MB foto, 5 MB portfólio, `dpo@prestway.com`)
- ADR: `docs/adr/0002-account-settings-hub.md`
