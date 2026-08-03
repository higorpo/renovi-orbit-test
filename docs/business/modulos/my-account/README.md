# Minha conta (`my-account`)

## 1. Leitura para negócio

- **Para que serve:** configuração central da conta (**cliente** e **prestador**) em `/dashboard/conta`: dados cadastrais, foto, privacidade/LGPD, sessão; no prestador, identidade legal, perfil público (`/perfil/:slug`), serviços ofertados, área de atuação e portfólio.
- **Quem usa:** `client` e `provider` autenticados (`ProtectedRoute`).
- **Valor:** qualidade cadastral para matching/confiança; conformidade LGPD (exportação/exclusão via DPO).
- **Embutidos (não documentar aqui em profundidade):** endereços (`addresses`) e histórico/cartões (`payments`) — apenas links.
- **Riscos:** dados sensíveis (CPF/CNPJ); exclusão **não** apaga via API — fluxo por e-mail ao DPO.

## 2. Visão geral funcional

- **Entrada:** `MyAccountPage` → `MyAccountClientPage` \| `MyAccountProviderPage` conforme `profile.role`.
- **Persistência:** `profiles`, `client_profiles_private`, `provider_profiles_private`, `provider_profiles_public`, `provider_offered_services`, `provider_service_area_neighborhoods`, `provider_portfolio_items`; buckets `profile-images` e `provider-portfolio-images`.
- **UX:** auto-save (debounce **1,5 s** cliente, **2 s** prestador); portfólio e serviços ofertados com ações explícitas; texto “As alterações são salvas automaticamente.”

## 3. Features do módulo

| Feature | Documento |
|---------|-----------|
| Minha conta (telas, campos, validações, seções por papel) | [features/minha-conta.md](./features/minha-conta.md) |

## 4. Perfis envolvidos

| Perfil | `/dashboard/conta` | Seções exclusivas |
|--------|--------------------|-------------------|
| Cliente | Sim | Endereços embutidos, CPF privado, cartões salvos, histórico pagamentos (`role="client"`) |
| Prestador | Sim | PF/PJ, legal, ofertados, perfil público, área, portfólio, histórico recebimentos (`role="provider"`) |
| Prestador sem KYC `ACTIVE` | Sim (allowlist `ProviderKycGate`) | Logout/ajustes enquanto shell operacional bloqueado — ver [provider-kyc](../provider-kyc/features/gate-e-acesso-operacional.md) |

## 5. Principais fluxos

1. Abrir conta → carregar perfil (+ privado/público no prestador).
2. Editar campos → debounce → Zod → persistência por grupos.
3. Foto → upload/remove storage + path em `profiles`.
4. Cliente: gerenciar endereços / cartões / ver histórico (features externas embutidas).
5. Prestador: ofertados, área, portfólio, link público; histórico de recebimentos embutido.
6. Privacidade / exclusão → mailto DPO; logout → `signOut`.

## 6. Regras transversais

- E-mail Auth **somente leitura** na UI.
- Slug público: gerado na primeira definição “real” de `display_name` (quando slug ainda é null/`providerId`); depois de slug real, mudança de nome **não** regenera slug.
- Política de privacidade: link só se `VITE_MAIN_SITE_URL`; senão “Política de privacidade em breve.”
- `DeleteAccountDialog` (digitar EXCLUIR) existe no código mas **não** é usado por `DangerZoneSection`.

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

| Módulo | Uso nesta tela |
|--------|----------------|
| `auth` | `useAuth`, `profileApi.updateProfile`, `signOut` |
| `addresses` | `AddressesSection` (só cliente) — ver [addresses](../addresses/README.md) |
| `payments` | `SavedCardsList` (cliente) + `PaymentHistorySection` (ambos) — ver [historico-e-reembolso](../payments/features/historico-e-reembolso.md) |
| `request-quote` | Estilo de card em ofertados (`getServiceCardStyle`) |
| `provider-profile` | Página pública `/perfil/:slug` (destino do link) |
| `provider-kyc` | Allowlist da rota conta |
| `provider-earnings` | Liquidações **não** nesta tela — menu Ganhos |

## 9. Riscos e lacunas

| Item | Status |
|------|--------|
| Exclusão de conta | Só orientação DPO; `DeleteAccountDialog` morto/reservado |
| Limite máx. imagens por item de portfólio | Não explícito no front (só 5 MB/arquivo) |
| Erro de validação de foto no seletor | Retorno silencioso sem toast em `AccountSummaryCard` |
| Rota `/dashboard/addresses` | Fake page — gestão real só em Minha conta |

## 10. Evidências

- `src/features/my-account/`
- `src/router.tsx` — `path: 'conta'`
- Detalhe: [features/minha-conta.md](./features/minha-conta.md)
- Constantes: `constants.ts` (2 MB foto, 5 MB portfólio, `dpo@renovi.com.br`)
