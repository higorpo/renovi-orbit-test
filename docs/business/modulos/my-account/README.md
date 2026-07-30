# Minha conta (`my-account`)

## 1. Leitura para negócio

- **Para que serve:** configuração central da conta (**cliente** e **prestador**): dados cadastrais, foto, privacidade/LGPD, sessão; no prestador, também identidade legal, **perfil público** (`/perfil/:slug`), **serviços ofertados**, **área de atuação** (bairros) e **portfólio** com imagens.
- **Quem usa:** usuários com `role` `client` ou `provider` autenticados.
- **Valor:** qualidade dos dados para matching, confiança na contratação e conformidade (LGPD).
- **Riscos:** dados sensíveis (CPF/CNPJ); exclusão de conta hoje é **processo via DPO por e-mail**, não botão que apaga dados na API.

## 2. Visão geral funcional

- **Entrada:** `MyAccountPage` → `MyAccountClientPage` | `MyAccountProviderPage`.
- **Persistência:** Supabase — `profiles`, `client_profiles_private`, `provider_profiles_private`, `provider_profiles_public`, `provider_offered_services`, `provider_service_area_neighborhoods`, `provider_portfolio_items`; storage `profile-images` e `provider-portfolio-images`.
- **Padrão de UX:** formulários com **salvamento automático** (debounce **1,5 s** cliente, **2 s** prestador), exceto portfólio e serviços ofertados (ações explícitas ao selecionar/remover).

## 3. Features

| Feature | Documento |
|---------|-----------|
| Minha conta (telas, campos, validações, mensagens, APIs) | [features/minha-conta.md](./features/minha-conta.md) |

## 4. Rota e guard

| Rota | Guard |
|------|--------|
| `/dashboard/conta` | `ProtectedRoute` com `allowedRoles={['client', 'provider']}` (`src/router.tsx`) |

**Prestador sem KYC `ACTIVE`:** esta rota (e paths aninhados sob `/dashboard/conta/`) permanece acessível pelo allowlist do `ProviderKycGate` — ponto de saída para logout e ajustes de conta enquanto o restante do painel operacional está bloqueado. Ver [provider-kyc](../provider-kyc/features/gate-e-acesso-operacional.md).

## 5. Mapa rápido de componentes

| Componente | Uso |
|------------|-----|
| `AccountSummaryCard` | Avatar, nome, e-mail, “cliente desde” / “no ar desde”, foto, link público (prestador) |
| `DadosPessoaisSection` | Nome completo + e-mail somente leitura |
| `ContatoIdentidadeSection` | Cliente: telefone + CPF |
| `EntityTypeSection` / `LegalIdentitySection` | Prestador: PF/PJ e documentos |
| `OfferedServicesSection` | Busca e chips de `platform_services` |
| `PublicProfileSettingsSection` + `ServiceAreaField` | Nome profissional, bio, visibilidade, bairros |
| `PortfolioManagementSection` | CRUD e ordenação de itens + imagens |
| `PrivacySection` / `DangerZoneSection` / `LogoutSection` | LGPD, exclusão orientada ao DPO, logout |
| `AddressesSection` | Apenas **cliente** (feature `@/features/addresses`) |
| `SavedCardsList` / `PaymentHistorySection` | Cliente: cartões salvos + histórico de pagamentos (com breakdown de reembolso). Prestador: histórico de recebimentos. Feature `@/features/payments` — ver [historico-e-reembolso](../payments/features/historico-e-reembolso.md). Erros de adicionar/remover cartão: mensagens amigáveis pt-BR ([checkout-e-cobranca](../payments/features/checkout-e-cobranca.md#mensagens-de-erro-na-ui-pt-br)). |

## 6. Hooks principais (orquestração)

`useAccountProfile`, `useClientPrivateProfile`, `useUpdateAccountProfile`, `useProviderProfile`, `useUpdateProviderProfile`, `useOfferedServices`, `usePortfolioItems`, `useProfilePhotoMutation`, `useProfileImageUrl`.

## 7. Constantes relevantes (`constants.ts`)

- `PROFILE_IMAGE_MAX_BYTES` = 2 MB; `PROVIDER_PORTFOLIO_IMAGE_MAX_BYTES` = 5 MB.
- `DPO_EMAIL` = `dpo@renovi.com.br`.
- `PRIVACY_POLICY_URL` depende de `VITE_MAIN_SITE_URL`.

## 8. Evidências

- Pasta: `src/features/my-account/`
- Documento detalhado: [features/minha-conta.md](./features/minha-conta.md)
- Migrações típicas: `20260318100000_*` … `20260318100010_*` (perfil cliente/prestador; ver repositório)
