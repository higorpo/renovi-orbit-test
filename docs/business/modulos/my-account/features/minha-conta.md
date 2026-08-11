# Minha conta (cliente e prestador)

Documentação alinhada a `src/features/my-account/`, guard em `src/router.tsx` e APIs/hooks da feature. Endereços e histórico de pagamentos são **embutidos** — detalhe canônico nos módulos `addresses` e `payments` (links apenas).

---

## 1. Resumo executivo

Tela única `/dashboard/conta` onde cliente e prestador mantêm cadastro, foto, privacidade/LGPD e sessão. O prestador gerencia ainda identidade legal, perfil público, serviços ofertados, área de atuação e portfólio. Auto-save com debounce diferente por papel. Exclusão de conta e exportação LGPD hoje são fluxos manuais via e-mail ao DPO (`dpo@prestway.com`).

## 2. Objetivo de negócio

- Manter dados cadastrais confiáveis para contratação, matching geográfico e página pública do prestador.
- Oferecer ponto de saída (logout / conta) mesmo com KYC prestador incompleto.
- Centralizar preferências de privacidade e pedidos LGPD sem self-service destrutivo na API.

## 3. Localização na plataforma

| Tela | Rota | Guard |
|------|------|-------|
| Minha conta | `/dashboard/conta` | `ProtectedRoute` `allowedRoles={['client','provider']}` |

- **Ramificação:** `MyAccountPage` → `MyAccountClientPage` \| `MyAccountProviderPage` por `profile.role`.
- **Loading sem perfil:** skeleton pulse no container.
- **KYC:** `/dashboard/conta` (e paths aninhados) na allowlist do `ProviderKycGate` — ver [gate-e-acesso-operacional](../../provider-kyc/features/gate-e-acesso-operacional.md).
- **Sem deep link / query** de negócio nesta feature (evidência: páginas sem `useSearchParams` de foco).
- **Menu:** item de conta no dashboard (layout); não confundir com `/dashboard/addresses` (fake).

## 4. Perfis envolvidos

| Perfil | Acesso | Não acessa nesta rota |
|--------|--------|------------------------|
| `client` | Página cliente completa | Seções de prestador |
| `provider` | Página prestador completa | `AddressesSection`, `SavedCardsList` |
| Visitante | Não | Guard |
| `admin` | Sem superfície nesta rota | — |

## 5. Fluxo funcional principal

```mermaid
flowchart TD
  A[/dashboard/conta] --> B{profile.role}
  B -->|client| C[MyAccountClientPage]
  B -->|provider| D[MyAccountProviderPage]
  C --> E[Form auto-save 1.5s]
  C --> F[AddressesSection]
  C --> G[SavedCardsList]
  C --> H[PaymentHistorySection client]
  D --> I[Form auto-save 2s por grupos]
  D --> J[Offered + Public + Portfolio]
  D --> K[PaymentHistorySection provider]
  C --> L[Privacy + Logout + DangerZone]
  D --> L
```

### Cliente — feliz

1. Carrega `useAccountProfile` + CPF (`useClientPrivateProfile`).
2. Edita nome/telefone/CPF → após 1500 ms valida Zod e persiste `profiles` + `client_profiles_private`.
3. Gerencia endereços / cartões / vê histórico (módulos externos).
4. Privacidade, logout ou zona de perigo (DPO).

### Prestador — feliz

1. Carrega agregado `useProviderProfile` + ofertados + portfólio.
2. Edita campos → 2000 ms → validação → mutações só dos **grupos dirty** (profile / private / public).
3. Serviços e área; portfólio fora do `Form` com CRUD explícito.
4. Histórico de recebimentos embutido; privacidade / logout / DPO.

## 6. Fluxos alternativos e exceções

| Caso | Comportamento |
|------|---------------|
| Erro de carga do perfil | `AccountErrorState` — “Não foi possível carregar sua conta” + retry |
| Auto-save parcial (cliente/prestador) | Toast “Não foi possível salvar todas as alterações…” |
| Schema inválido (cliente) | Seta erro no primeiro campo; **sem** toast de inválido |
| Schema inválido (prestador) | Erro no campo + toast “Não foi possível salvar… campo inválido.” |
| Catch genérico auto-save | Toast “Não foi possível atualizar seus dados…” |
| Sucesso prestador | Toast “Dados atualizados com sucesso.” |
| Sem `VITE_MAIN_SITE_URL` | Texto “Política de privacidade em breve.” |
| Copiar link falha | Toasts distintos no card vs seção pública |
| Foto inválida no seletor | Validação retorna e **encerra sem toast** (`AccountSummaryCard`) |
| Exclusão | Dialog informa mailto DPO — **não** chama delete API |
| `DeleteAccountDialog` | Implementado (digitar EXCLUIR) mas **não importado** em `DangerZoneSection` |

## 7. Regras de negócio (numeradas)

1. Auto-save cliente só com `formState.isDirty`; debounce **1500 ms**.
2. Auto-save prestador debounce **2000 ms**; limpa erros dos campos alterados antes de revalidar.
3. Grupos prestador: `full_name`/`phone` → `profiles`; bloco privado → `provider_profiles_private`; bloco público → `provider_profiles_public`.
4. `service_area_neighborhood_ids` só enviado no update público quando o campo está dirty (evita delete+insert desnecessário).
5. PJ: schema exige CNPJ e razão social preenchidos (`entity_type === "pj"`).
6. Portfólio criado/atualizado pela página força `visibility: "public"`.
7. Imagem de perfil: máx. **2 MB**; tipos JPEG/PNG/WebP/HEIC/HEIF.
8. Imagem de portfólio: máx. **5 MB**; mesmos tipos; input pode acumular múltiplos arquivos; sem teto explícito de quantidade por item no front.
9. DPO: `dpo@prestway.com`; prazo informado na UI: **15 dias úteis**.
10. E-mail do usuário não é editável no formulário.
11. Slug: em `updateProviderPublicProfile`, se `display_name` atualiza e slug atual é null ou igual a `providerId`, gera slug único; após slug “real”, alterações de nome não mudam o slug (código analisado).
12. Prestador: `useUpdateAccountProfile({ silent: true })` — toasts de profile base silenciados no fluxo de grupos.
13. Cliente: `SavedCardsList` com `tokenizeContext="profile"` e `phone` do perfil.
14. Histórico: `PaymentHistorySection role="client"|"provider"` — contratos/views no módulo payments.
15. Logout: confirmação em `AlertDialog` → `signOut()` (`useAuth`).

## 8. Campos e dados

### 8.1 Cliente — `accountFormSchema`

| Campo | Label | Obrigatório | Validação | Persistência |
|-------|-------|-------------|-----------|--------------|
| `full_name` | Nome completo | Sim | `min(1)` + `validateFullName` | `profiles.full_name` |
| `phone` | Telefone / WhatsApp | Não | Vazio OK; senão `validateBrazilPhone` | `profiles.phone` |
| `cpf` | CPF | Não | Vazio OK; senão `validateCPF` | `client_profiles_private.cpf` |
| E-mail | E-mail | — | Disabled | Auth (`user.email`) |

### 8.2 Prestador — `providerAccountFormSchema`

| Campo | UI | Obrigatório | Validação | Persistência |
|-------|-----|-------------|-----------|--------------|
| `full_name` | Nome completo | Sim | Igual cliente | `profiles` |
| `phone` | Contato (card separado) | Não | Telefone BR | `profiles` |
| `entity_type` | PF / PJ | Sim | enum | privado |
| `cpf` | CPF (PF) | Se preenchido válido | CPF | privado |
| `cnpj`, `razao_social` | PJ | Refine PJ | CNPJ + não vazios | privado |
| `nome_fantasia`, representantes, `commercial_contact` | Legal | Não | CPF rep. se preenchido; contact max 120 | privado |
| `display_name`, `bio` | Perfil público | Não | max 120 / 2000 | público |
| `profile_visibility` | Visibilidade | Sim | `public` \| `restricted` | público |
| `service_area_neighborhood_ids` | Área | Não | UUIDs | `provider_service_area_neighborhoods` |
| `service_area_city` | Apoio UI | Não | — | derivado |

## 9. Validações de front-end

- Zod: `types/accountForm.validation.ts`, `types/providerAccountForm.validation.ts` (reexports em `schemas/` também existem).
- Máscaras: `maskPhone`, `maskCPF`, CNPJ via validadores compartilhados.
- Upload: `validateProfileImageFile` / `validatePortfolioImageFile`.
- Portfólio: título obrigatório (trim) no dialog da seção (evidência em `PortfolioManagementSection` / hooks).

## 10. Validações de back-end

- UPSERTs/tabelas privados com RLS por usuário (migrations `20260318100000_*` tipicamente — evidência parcial: paths de API; regras SQL finas no módulo Supabase).
- Storage buckets privados com signed URLs (expiry 3600 s nas constantes).
- **Evidência parcial:** constraints exatas de unique slug / RLS não reauditadas neste ciclo além do comportamento do client `resolveUniqueSlug`.

## 11. Status, estados e transições

| Estado UI | Quando |
|-----------|--------|
| Loading skeleton | `profileLoading` / sem perfil inicial |
| Error state | `profileError && !profile` |
| Salvando… | Mutação em andamento (`Loader2`) |
| Idle auto-save | Texto “As alterações são salvas automaticamente.” |
| Dialogs | Exportar dados, excluir conta (orientação), logout |

Não há FSM de domínio próprio além de `entity_type` PF/PJ e `profile_visibility`.

## 12. Persistência

| Destino | Conteúdo |
|---------|----------|
| Supabase tables | Ver README §7 / seção 8 |
| Storage | `profile-images`, `provider-portfolio-images` |
| Cliente | React Hook Form + TanStack Query caches dos hooks |
| Sem Preferences/draft local de conta | Evidência: sem keys de Preferences nesta feature |

## 13. Integrações

| Destino | Como |
|---------|------|
| `auth` | Perfil base, update, signOut |
| `addresses` | Embutido só cliente — [gestão de endereços](../../addresses/features/gestao-de-enderecos.md) |
| `payments` | Cartões + histórico — [histórico e reembolso](../../payments/features/historico-e-reembolso.md); erros de cartão em [checkout](../../payments/features/checkout-e-cobranca.md) |
| `provider-earnings` | **Não** embutido; liquidações em `/dashboard/earnings` |
| `provider-profile` | Link `/perfil/{slug}` |
| Site jurídico | `PRIVACY_POLICY_URL` = `{VITE_MAIN_SITE_URL}/juridico/politica-de-privacidade` |

## 14. Listagens, buscas, filtros, paginação

- **Ofertados:** busca em `platform_services` — até 20 resultados com query / 10 sem query (`OfferedServicesSection`).
- **Portfólio:** lista do prestador + reorder DnD (`@dnd-kit`); sem paginação server-side evidenciada no hook de conta.
- **Histórico de pagamentos:** listagem/paginação no módulo `payments` (não duplicar aqui).
- **Endereços:** CRUD no módulo `addresses`.

## 15. Ações disponíveis

| Ação | Quem | Pré-condição | Resultado |
|------|------|--------------|-----------|
| Auto-save campos | Ambos | Dirty + Zod OK | Persistência |
| Upload / remover foto | Ambos | Arquivo válido / path existe | Storage + profile path |
| CRUD endereços | Cliente | — | Feature addresses |
| Cartões salvos | Cliente | — | Feature payments |
| Ver histórico captura | Cliente / Prestador | — | `PaymentHistorySection` |
| Add/remove serviços | Prestador | Seleção | `setOfferedServices` |
| Copiar / abrir perfil | Prestador | slug | Clipboard / nova URL |
| CRUD portfólio | Prestador | Título | Items + imagens |
| Falar DPO / Exportar | Ambos | — | mailto / dialog |
| Excluir conta (UI) | Ambos | — | Orientação DPO |
| Sair | Ambos | Confirma | `signOut` |

## 16. Dependências

- Internas: hooks/api listados na seção 19.
- Externas de feature: `auth`, `addresses`, `payments`, `request-quote` (estilo), UI shadcn.
- Downstream: matching/área usa bairros; público usa slug.

## 17. Regras implícitas

- Hidratação do form: `hydratedProfileIdRef` evita reset contínuo após primeiro load do `profile.id`.
- Prestador: telefone fora de `DadosPessoaisSection` (card Contato dedicado); adapter de tipos para reutilizar a seção de nome.
- Cliente não vê `PaymentHistorySection` com role provider e vice-versa.
- Zona de perigo copy fala em remoção irreversível, mas ação real é pedido por e-mail.
- Toasts de sucesso de foto: “Foto atualizada com sucesso.” / “Foto removida.” (`useProfilePhotoMutation`).

## 18. Riscos

- Usuário pode interpretar “Excluir minha conta” como delete imediato.
- Validação de foto silenciosa na UI.
- Dados sensíveis (CPF/CNPJ) na mesma superfície do auto-save.
- Dependência de env para política de privacidade.

## 19. Evidências

- Páginas: `components/MyAccountPage.tsx`, `MyAccountClientPage.tsx`, `MyAccountProviderPage.tsx`
- Seções: `DadosPessoaisSection`, `ContatoIdentidadeSection`, `EntityTypeSection`, `LegalIdentitySection`, `OfferedServicesSection`, `PublicProfileSettingsSection`, `ServiceAreaField`, `PortfolioManagementSection`, `PrivacySection`, `DangerZoneSection`, `LogoutSection`, `AccountSummaryCard`, `AccountErrorState`, `DeleteAccountDialog` (não ligado)
- APIs: `api/clientProfilePrivate.api.ts`, `providerPrivateProfile.api.ts`, `providerPublicProfile.api.ts`, `offeredServices.api.ts`, `portfolio.api.ts`, `profileImageStorage.api.ts`, `portfolioImageStorage.api.ts`, `providerProfile.api.ts`
- Hooks: `useAccountProfile`, `useClientPrivateProfile`, `useUpdateAccountProfile`, `useProviderProfile`, `useUpdateProviderProfile`, `useOfferedServices`, `usePortfolioItems`, `useProfilePhotoMutation`, `useProfileImageUrl`
- Validação: `types/accountForm.validation.ts`, `types/providerAccountForm.validation.ts`
- Constantes: `constants.ts`
- Router: `src/router.tsx` path `conta`

## 20. Pendências

| Item | Status |
|------|--------|
| Wire de `DeleteAccountDialog` ou remoção do código morto | Pendente de produto |
| Limite de imagens por item de portfólio | Não encontrado no front |
| Toast de erro de validação de foto | Ausente no seletor |
| Detalhe RLS/migrations | Evidência parcial — aprofundar em auditoria backend se necessário |

---

## Anexo A — Composição por papel

### Cliente (`MyAccountClientPage`)

1. Header “Minha conta” / subtítulo dados, endereços e privacidade  
2. `AccountSummaryCard` (cliente desde)  
3. `DadosPessoaisSection` + `ContatoIdentidadeSection` + hint auto-save  
4. **`AddressesSection`** (addresses)  
5. **`SavedCardsList`** (payments)  
6. **`PaymentHistorySection role="client"`** (payments)  
7. `PrivacySection` → `LogoutSection` → `DangerZoneSection`

### Prestador (`MyAccountProviderPage`)

1. Header / subtítulo identidade e perfil público  
2. `AccountSummaryCard` (“No ar desde” + link/copiar perfil)  
3. Dados pessoais + Contato + `EntityTypeSection` + `LegalIdentitySection`  
4. `OfferedServicesSection` + `PublicProfileSettingsSection` (+ área) + hint auto-save  
5. `PortfolioManagementSection` (fora do Form)  
6. **`PaymentHistorySection role="provider"`** (payments) — recebimentos na captura, não liquidação bancária  
7. Privacidade → Logout → Zona de perigo  

## Anexo B — Mensagens (toasts / diálogos)

| Mensagem | Origem |
|----------|--------|
| Não foi possível salvar todas as alterações. Tente novamente. | Auto-save parcial |
| Não foi possível atualizar seus dados. Tente novamente. | Catch |
| Não foi possível salvar os campos automaticamente porque há um campo inválido. | Prestador Zod |
| Dados atualizados com sucesso. | Prestador OK |
| Foto atualizada com sucesso. / Foto removida. | Foto |
| Link copiado. / Não foi possível copiar. | Card prestador |
| Link copiado para a área de transferência. / Não foi possível copiar o link. | Seção pública |
| Não foi possível atualizar. / o perfil. | Hooks update provider |
| Textos DPO / 15 dias úteis | Privacy + DangerZone |
| Confirmação logout | `LogoutSection` |

## Anexo C — Checklist QA

- [ ] Cliente e prestador abrem a mesma rota com UIs distintas  
- [ ] Auto-save 1,5 s / 2 s; inválido bloqueia persistência  
- [ ] E-mail disabled; CPF/CNPJ máscaras  
- [ ] PJ sem CNPJ/razão → toast inválido  
- [ ] Endereços só cliente; cartões só cliente  
- [ ] Histórico client vs provider  
- [ ] Foto >2 MB silenciosa; portfólio >5 MB rejeitado na validação de arquivo  
- [ ] Copiar slug; política com/sem env  
- [ ] Excluir conta → só mailto; logout confirma  
- [ ] Prestador sem KYC ACTIVE ainda acessa `/dashboard/conta`

## 21. Atualização de auditoria (2026-08-02)

- Seções canônicas 1–20 + anexos por papel.
- Confirmado embutimento de addresses/payments (links apenas).
- Confirmado `DeleteAccountDialog` não ligado; DangerZone = DPO.
- Debounces, grupos dirty e slug conservador revalidados no código atual.
