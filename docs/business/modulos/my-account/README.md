# Minha conta (`my-account`)

## 1. Leitura para negócio

- **Para que serve:** hub responsivo de configurações da conta (**cliente** e **prestador**) sob `/dashboard/account/*` (slugs em inglês): dados cadastrais, foto, privacidade/LGPD, sessão; no prestador, identidade legal, perfil profissional (público `/perfil/:slug`, ofertados, área, portfólio), recebimentos na captura e hospedagem da UI de Ganhos.
- **Quem usa:** `client` e `provider` autenticados (`ProtectedRoute` no dashboard).
- **Valor:** qualidade cadastral para matching/confiança; conformidade LGPD (exportação/exclusão via DPO); um único hub de conta no menu (sem itens separados Endereços / Ganhos).
- **Fase 1 (shell):** navegação por seções; formulários/UIs existentes reutilizados; auto-save inalterado. ADR: [`docs/adr/0002-account-settings-hub.md`](../../../adr/0002-account-settings-hub.md).
- **Embutidos (não documentar aqui em profundidade):** endereços (`addresses`) e histórico/cartões (`payments`) — apenas links. Ganhos: UI de `provider-earnings` hospedada em `/dashboard/account/earnings`.
- **Riscos:** dados sensíveis (CPF/CNPJ); exclusão **não** apaga via API — fluxo por e-mail ao DPO.

## 2. Visão geral funcional

- **Entrada:** menu **Minha conta** → `/dashboard/account` (`ROUTE_ACCOUNT`).
- **Mobile:** índice = lista de seções + `AccountSummaryCard` acima; cada seção é chrome **stack** com voltar para `/dashboard/account`.
- **Desktop:** sidebar + conteúdo; visitar `/dashboard/account` redireciona para `/dashboard/account/personal-info`; `AccountSummaryCard` só em personal-info (desktop).
- **Persistência:** `profiles`, `client_profiles_private`, `provider_profiles_private`, `provider_profiles_public`, `provider_offered_services`, `provider_service_area_neighborhoods`, `provider_portfolio_items`; buckets `profile-images` e `provider-portfolio-images`.
- **UX de edição:** auto-save (debounce **1,5 s** cliente, **2 s** prestador); portfólio e serviços ofertados com ações explícitas; texto “As alterações são salvas automaticamente.”

## 3. Features do módulo

| Feature | Documento |
|---------|-----------|
| Minha conta (hub, seções, campos, validações por papel) | [features/minha-conta.md](./features/minha-conta.md) |

## 4. Perfis envolvidos

| Perfil | Hub `/dashboard/account` | Seções |
|--------|--------------------------|--------|
| Cliente | Sim | personal-info, addresses, payments, privacy, session |
| Prestador | Sim | personal-info, legal-identity, professional-profile, receivables, earnings, privacy, session |
| Prestador sem KYC `ACTIVE` | Sim (allowlist `ProviderKycGate` = `/dashboard/account`) | Logout/ajustes enquanto shell operacional bloqueado — ver [provider-kyc](../provider-kyc/features/gate-e-acesso-operacional.md) |

## 5. Principais fluxos

1. Abrir Minha conta → mobile: índice; desktop: redirect para personal-info.
2. Abrir seção → carregar/editar (auto-save / ações explícitas conforme seção).
3. Foto → upload/remove storage + path em `profiles` (summary no índice mobile / personal-info desktop).
4. Cliente: endereços / pagamentos (cartões + histórico captura).
5. Prestador: identidade legal, perfil profissional, recebimentos (captura), ganhos (liquidação — feature `provider-earnings`).
6. Privacidade / exclusão → mailto DPO; sessão → logout → `signOut`.

## 6. Regras transversais

- E-mail Auth **somente leitura** na UI.
- Slug público: gerado na primeira definição “real” de `display_name` (quando slug ainda é null/`providerId`); depois de slug real, mudança de nome **não** regenera slug.
- Política de privacidade: link só se `VITE_MAIN_SITE_URL`; senão “Política de privacidade em breve.”
- `DeleteAccountDialog` (digitar EXCLUIR) existe no código mas **não** é usado por `DangerZoneSection`.
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
| `addresses` | Seção `/dashboard/account/addresses` (só cliente) — ver [addresses](../addresses/README.md) |
| `payments` | Seção payments (cliente: cartões + histórico) e receivables (prestador: histórico captura) — ver [historico-e-reembolso](../payments/features/historico-e-reembolso.md) |
| `request-quote` | Estilo de card em ofertados (`getServiceCardStyle`) |
| `provider-profile` | Página pública `/perfil/:slug` (destino do link) |
| `provider-kyc` | Allowlist prefix `/dashboard/account` |
| `provider-earnings` | UI Ganhos hospedada em `/dashboard/account/earnings` (`ProviderEarningsSectionPage` → `EarningsPage`); ownership da feature permanece em `provider-earnings` |

## 9. Riscos e lacunas

| Item | Status |
|------|--------|
| Exclusão de conta | Só orientação DPO; `DeleteAccountDialog` morto/reservado |
| Limite máx. imagens por item de portfólio | Não explícito no front (só 5 MB/arquivo) |
| Erro de validação de foto no seletor | Retorno silencioso sem toast em `AccountSummaryCard` |
| Páginas monolito `MyAccount{Client,Provider}Page` | Ainda no código/testes; **não** montadas no `router.tsx` (hub por seções é o canônico) |

## 10. Evidências

- `src/features/my-account/` — `MyAccountLayout`, `MyAccountIndexPage`, `constants/routes.ts`, `constants/accountNav.ts`, `components/sections/*`
- `src/router.tsx` — `path: 'account'` + children
- `src/layouts/DashboardLayout/dashboardMenu.ts` — Minha conta → `ROUTE_ACCOUNT`
- `src/layouts/DashboardLayout/mobileNavigation.config.ts` — índice tab-root; seções stack → `/dashboard/account`
- Detalhe: [features/minha-conta.md](./features/minha-conta.md)
- Constantes: `constants.ts` (2 MB foto, 5 MB portfólio, `dpo@prestway.com`)
- ADR: `docs/adr/0002-account-settings-hub.md`
