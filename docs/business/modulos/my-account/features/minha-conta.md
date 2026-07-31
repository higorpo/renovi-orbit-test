# Minha conta (cliente e prestador)

Documentação alinhada ao código em `src/features/my-account/`, guards em `src/router.tsx` e APIs Supabase indicadas nas seções abaixo.

---

## 1. Visão geral

| Item | Descrição |
|------|-----------|
| **Objetivo do módulo** | Tela única `/dashboard/conta` para o usuário autenticado manter dados pessoais, foto de perfil, privacidade/LGPD, sessão e (prestador) identidade legal, perfil público, serviços ofertados, área de atuação e portfólio. |
| **Contexto de negócio** | Dados alimentam `profiles`, perfis privados/públicos do prestador, matching geográfico (`provider_service_area_neighborhoods`) e página pública `/perfil/:slug`. |
| **Perfis envolvidos** | `client` e `provider` (`MyAccountPage.tsx` ramifica por `profile.role`). |
| **Dependências** | `@/features/auth` (`useAuth`, `profileApi.updateProfile`), `@/features/addresses` (`AddressesSection`, `ServiceAreaField`: `searchCities`, `listNeighborhoodsByCity`, `getNeighborhoodsByIds`), `@/features/request-quote` (`getServiceCardStyle` em oferta de serviços), `@/features/payments` (`SavedCardsList`, `PaymentHistorySection`). |

---

## 2. Telas e rotas

| Tela | Rota | Objetivo | Perfis com acesso |
|------|------|----------|-------------------|
| Minha conta | `/dashboard/conta` | Configurações da conta | `client`, `provider` (`ProtectedRoute` em `router.tsx`) |

**Prestador sem KYC `ACTIVE`:** `/dashboard/conta` (e paths aninhados) permanece acessível pelo allowlist do `ProviderKycGate` — logout e ajustes de conta enquanto o shell operacional está bloqueado. Ver [gate-e-acesso-operacional](../../provider-kyc/features/gate-e-acesso-operacional.md).

**Composição da página**

- **Cliente:** `MyAccountClientPage.tsx` — resumo lateral + formulário (auto-save 1500 ms) + `AddressesSection` + `SavedCardsList` + `PaymentHistorySection` (histórico com breakdown de reembolso) + privacidade + logout + zona de perigo.
- **Prestador:** `MyAccountProviderPage.tsx` — resumo (com link público) + formulário (auto-save 2000 ms) + cartão Contato (telefone) + tipo entidade + dados legais + serviços + perfil público + texto auto-save + **portfólio** (fora do `Form`) + `PaymentHistorySection` (recebimentos) + privacidade + logout + zona de perigo.

Detalhe do histórico/reembolso: [historico-e-reembolso](../../payments/features/historico-e-reembolso.md).

---

## 3. Ações disponíveis

| Ação | Onde aparece | Quem | Regras / pré-condições | Efeitos |
|------|--------------|------|------------------------|---------|
| Auto-save perfil cliente | Após editar nome/telefone/CPF | Cliente | `accountFormSchema.safeParse`; debounce **1500 ms** | `updateProfileAsync` (`profiles`) + `updateCpfAsync` (`client_profiles_private`) |
| Auto-save prestador | Após editar campos do form | Prestador | `providerAccountFormSchema.safeParse`; debounce **2000 ms**; grupos dirty | Atualiza `profiles` e/ou `provider_profiles_private` e/ou `provider_profiles_public` + possível sync de bairros |
| Upload foto de perfil | `AccountSummaryCard` | Ambos | Arquivo validado (`validateProfileImageFile`) | Storage `profile-images` + `profiles.profile_image_path` |
| Remover foto de perfil | `AccountSummaryCard` | Ambos | Existe `profile_image_path` | Remove objeto no storage + limpa path |
| CRUD endereços | `AddressesSection` (só cliente) | Cliente | Feature `addresses` | Tabela `client_addresses` |
| Ver / gerenciar cartões salvos | `SavedCardsList` | Cliente | Feature `payments` | Tokenizar / remover cartão; erros amigáveis pt-BR (sem texto bruto do backend) — ver [checkout-e-cobranca](../../payments/features/checkout-e-cobranca.md#mensagens-de-erro-na-ui-pt-br) |
| Ver histórico de pagamentos | `PaymentHistorySection` | Cliente | Feature `payments` | View `client_payment_transactions_v` (breakdown se `refunded_amount`) |
| Ver recebimentos (captura) | `PaymentHistorySection` | Prestador | Feature `payments` | View `provider_payment_receivables_v` (`net_amount_received` após `refunded_at`); disclosure de depósito via `provider-earnings` |
| Ver liquidações bancárias | Menu **Ganhos** | Prestador | Feature `provider-earnings` | `/dashboard/earnings` — ver [ganhos-e-liquidacoes](../../provider-earnings/features/ganhos-e-liquidacoes.md) |
| Adicionar/remover serviços ofertados | `OfferedServicesSection` | Prestador | Busca em `platform_services` | `provider_offered_services` (delete all + insert) |
| Visualizar / copiar link do perfil | Card resumo e/ou `PublicProfileSettingsSection` | Prestador | Existe `slug` | `navigator.clipboard` + `toast` |
| Portfólio: criar/editar/reordenar/excluir | `PortfolioManagementSection` | Prestador | Título obrigatório (trim) no dialog | `provider_portfolio_items` + bucket `provider-portfolio-images` |
| Exportar dados / falar DPO | `PrivacySection` | Ambos | — | `mailto:dpo@renovi.com.br` + diálogos informativos |
| Excluir conta (fluxo atual) | `DangerZoneSection` | Ambos | — | Abre diálogo orientando e-mail ao DPO (**não** chama API de exclusão) |
| Sair | `LogoutSection` | Ambos | Confirmação no `AlertDialog` | `signOut()` do `useAuth` |

**Evidência:** arquivos citados em `src/features/my-account/components/`.

---

## 4. Campos por tela

### 4.1 Cliente — schema `accountFormSchema` (`types/accountForm.validation.ts`)

| Campo (técnico) | Label na UI | Tipo | Obrigatório | Validação / máscara | Persistência |
|-----------------|-------------|------|-------------|---------------------|--------------|
| `full_name` | Nome completo | text | Sim | `min(1)` + `validateFullName` (nome e sobrenovo) — mensagem: *"Informe seu nome completo com nome e sobrenome"* | `profiles.full_name` via `useUpdateAccountProfile` |
| `phone` | Telefone / WhatsApp | tel | Não | Vazio OK; se preenchido `validateBrazilPhone` — *"Telefone inválido"*; máscara `maskPhone` | `profiles.phone` |
| `cpf` | CPF | text | Não | Vazio OK; se preenchido `validateCPF` — *"CPF inválido"*; máscara `maskCPF` | `client_profiles_private.cpf` via `useClientPrivateProfile` |

**E-mail**

- Label *"E-mail"*; campo **somente leitura** (`disabled`); descrição: alteração apenas via suporte (`DadosPessoaisSection.tsx`).
- Valor: `user.email` do Supabase Auth (não persiste pelo form).

### 4.2 Prestador — schema `providerAccountFormSchema` (`types/providerAccountForm.validation.ts`)

| Campo | Label / UI | Obrigatório | Validação | Persistência |
|-------|------------|-------------|-----------|--------------|
| `full_name` | Nome completo (mesma seção que cliente) | Sim | Igual ao cliente | `profiles` |
| `phone` | Telefone / WhatsApp (card **Contato** separado) | Não | `validateBrazilPhone` se não vazio | `profiles` |
| `entity_type` | Pessoa física / Pessoa jurídica (botões) | Sim | `enum ["pf","pj"]` | `provider_profiles_private.entity_type` |
| `cpf` | CPF | Condicional | Obrigatório só no sentido “se preenchido deve validar”; visível se PF | `provider_profiles_private` |
| `cnpj`, `razao_social` | CNPJ, Razão social | **PJ:** implícito | `validateCNPJ` (numérico ou alfanumérico RFB, 14 posições, DV módulo 11); máscara `XX.XXX.XXX/XXXX-XX`; `.refine`: se `pj`, CNPJ e razão social não podem ser vazios — *"Preencha CNPJ e Razão social para PJ"* | `provider_profiles_private` |
| `nome_fantasia` | Nome fantasia | Não | — | privado |
| `legal_representative_name` | Representante legal | Não | — | privado |
| `legal_representative_cpf` | CPF do representante legal | Não | `validateCPF` se não vazio | privado |
| `commercial_contact` | Contato comercial | Não | `max(120)` | privado |
| `display_name` | Nome profissional (exibido no perfil) | Não | `max(120)` | `provider_profiles_public.display_name`; **primeira definição** pode gerar `slug` (ver regra abaixo) |
| `bio` | Biografia | Não | `max(2000)` | `provider_profiles_public.bio` |
| `service_area_neighborhood_ids` | Área de atuação (`ServiceAreaField`) | Não | Array de UUIDs quando preenchido | `provider_service_area_neighborhoods` (replace no update) |
| `profile_visibility` | Visibilidade do perfil | Sim | `public` \| `restricted` | `provider_profiles_public.profile_visibility` |
| `service_area_city` | (derivado/exibição) | Não | Opcional no schema; preenchido a partir dos bairros na leitura | Apoio de UI |

**Slug público**

- Não é campo editável direto no form.
- Em `updateProviderPublicProfile` (`providerPublicProfile.api.ts`): se `display_name` é atualizado e o `slug` atual ainda é igual ao `providerId` (ou null), gera novo slug com `resolveUniqueSlug` (base slugificada + sufixo único). **Após slug “real”, alterações posteriores de `display_name` não mudam o slug** no código analisado.

---

## 5. Botões e comportamentos (destaques)

| Botão / controle | Tela / seção | Comportamento |
|------------------|--------------|----------------|
| Alterar foto / Remover foto | `AccountSummaryCard` | Input `accept` JPEG, PNG, WebP, HEIC, HEIF; validação 2 MB; erro de validação **não exibe toast** (`if (err) return` no `handleFileChange`) |
| Preciso de ajuda para escolher | `EntityTypeSection` | Abre `Dialog` com texto PF vs PJ |
| Buscar serviços… | `OfferedServicesSection` | Dropdown com até 20 resultados (com query) ou 10 (sem query); clique adiciona e persiste via `setOfferedServices` |
| Remover (badge serviço) | Ofertados | Remove ID e persiste |
| Visualizar perfil / Copiar link | Perfil público + card | Mesmas ações possíveis em dois pontos no prestador |
| Adicionar trabalho / Editar / Excluir / arrastar ordem | Portfólio | Dialog full-screen mobile (`useMobileDialogViewport`); DnD com `@dnd-kit` |
| Falar com o DPO / Exportar meus dados | Privacidade | `mailto` ou alerta com instruções LGPD (15 dias úteis) |
| Excluir minha conta | Zona de perigo | Alerta → e-mail DPO (mesmo padrão exportação) |
| Sair da plataforma | Sessão | Confirma → `signOut` |

---

## 6. Regras de negócio (verificáveis no código)

1. **Auto-save cliente:** só dispara com `formState.isDirty`; valida com Zod; em sucesso parcial (perfil OK e CPF falhou ou o inverso) → `toast.error("Não foi possível salvar todas as alterações. Tente novamente.")` (`MyAccountClientPage.tsx`).
2. **Auto-save prestador:** limpa erro do campo alterado antes de revalidar; se schema inválido → `toast.error("Não foi possível salvar os campos automaticamente porque há um campo inválido.")`; sucesso completo → `toast.success("Dados atualizados com sucesso.")`.
3. **Grupos de persistência prestador:** `full_name`/`phone` → `profiles`; bloco privado → `provider_profiles_private`; bloco público → `provider_profiles_public`; `service_area_neighborhood_ids` só enviado ao público quando o array dirty (`MyAccountProviderPage.tsx`).
4. **PJ:** schema exige CNPJ e razão social preenchidos quando `entity_type === "pj"`.
5. **Portfólio na página:** `MyAccountProviderPage` força `visibility: "public"` em create/update via props — itens criados pela UI são públicos no sentido enviado ao hook.
6. **Imagens portfólio:** até **5 MB** por arquivo; tipos em `PROVIDER_PORTFOLIO_IMAGE_ALLOWED_TYPES` (`constants.ts`); múltiplos arquivos permitidos no input (acumula em array); sem limite máximo explícito de quantidade por item no front analisado.
7. **Política de privacidade:** link só renderiza se `VITE_MAIN_SITE_URL` definido; senão texto *"Política de privacidade em breve."* (`PrivacySection.tsx` + `constants.ts`).
8. **DPO:** e-mail fixo `dpo@renovi.com.br` (`constants.ts`).

---

## 7. Perfis e permissões

| Perfil | Acessa `/dashboard/conta` | Seções exclusivas |
|--------|---------------------------|-------------------|
| Cliente | Sim | `AddressesSection`, CPF em `client_profiles_private` |
| Prestador | Sim | Tipo entidade, dados legais, serviços, perfil público, área, portfólio |

Admin: **não** há rota dedicada no `router.tsx` para esta tela com papel `admin` (fluxo padrão do dashboard é `client` | `provider`).

---

## 8. Tabelas, entidades e storage

| Tabela / bucket | Finalidade |
|-----------------|------------|
| `profiles` | `full_name`, `phone`, `profile_image_path`, `role`, etc. |
| `client_profiles_private` | CPF do cliente |
| `provider_profiles_private` | PF/PJ, documentos, representante, contato comercial |
| `provider_profiles_public` | `slug`, `display_name`, `bio`, `profile_visibility`, … |
| `provider_offered_services` | Serviços selecionados do catálogo |
| `provider_service_area_neighborhoods` | Bairros de atuação |
| `provider_portfolio_items` | Itens de portfólio + `image_paths` |
| `platform_services` | Busca/oferta de serviços |
| `platform_neighborhoods` (+ joins) | Área de atuação e labels derivados |
| **Storage** `profile-images` | Fotos de perfil (path em `profiles`) |
| **Storage** `provider-portfolio-images` | Imagens do portfólio |

---

## 9. APIs, hooks e arquivos

| Camada | Arquivo | Responsabilidade |
|--------|---------|------------------|
| API | `api/clientProfilePrivate.api.ts` | GET/UPSERT `client_profiles_private` |
| API | `api/providerPrivateProfile.api.ts` | Perfil privado prestador |
| API | `api/providerPublicProfile.api.ts` | Leitura/UPDATE público, slug, área (delete+insert bairros) |
| API | `api/offeredServices.api.ts` | `searchServices`, `getServicesByIds`, `listOfferedServices`, `setOfferedServices` |
| API | `api/portfolio.api.ts` | CRUD + reorder + signed URL imagens portfólio |
| API | `api/profileImageStorage.api.ts` | Upload/remove perfil; `validateProfileImageFile` |
| API | `api/portfolioImageStorage.api.ts` | Upload/remove portfólio; `validatePortfolioImageFile` |
| API | `api/providerProfile.api.ts` | Barrel reexport |
| Hook | `useAccountProfile.ts` | Perfil base cliente |
| Hook | `useClientPrivateProfile.ts` | CPF cliente |
| Hook | `useUpdateAccountProfile.ts` | Atualiza `profiles` (toasts silenciáveis no prestador) |
| Hook | `useProviderProfile.ts` | Agrega profile + private + public |
| Hook | `useUpdateProviderProfile.ts` | Mutações privado/público + cache TanStack Query |
| Hook | `useOfferedServices.ts` | Lista e persistência de ofertas |
| Hook | `usePortfolioItems.ts` | Lista, criar com upload, atualizar, excluir (limpa storage), reorder |
| Hook | `useProfilePhotoMutation.ts` | Upload/remove foto + invalidação query |
| Hook | `useProfileImageUrl.ts` | Signed URL da foto de perfil |

**Integração auth:** `profileApi.updateProfile` (`@/features/auth`) para nome, telefone e path da imagem.

---

## 10. Fluxos operacionais

### Cliente — fluxo feliz

1. Entra em Minha conta → carrega `useAccountProfile` + CPF privado.
2. Edita nome/telefone/CPF → após 1,5 s valida e persiste.
3. Gerencia endereços na seção embutida.
4. Opcional: exportação/DPO, logout.

### Prestador — fluxo feliz

1. Carrega dados públicos/privados + ofertas + portfólio.
2. Preenche identidade e perfil público → auto-save por grupos após 2 s.
3. Ajusta serviços e área (bairros por cidade via `ServiceAreaField`).
4. Mantém portfólio em dialogs separados do `Form`.

### Erro de carga

- `AccountErrorState`: título *"Não foi possível carregar sua conta"* + botão retry (`refetch`).

---

## 11. Mensagens do sistema (toasts e textos fixos)

| Tipo | Mensagem | Origem |
|------|----------|--------|
| Erro | Não foi possível salvar todas as alterações. Tente novamente. | Cliente auto-save parcial |
| Erro | Não foi possível atualizar seus dados. Tente novamente. | Cliente catch |
| Erro | Não foi possível salvar os campos automaticamente porque há um campo inválido. | Prestador validação Zod |
| Erro | Não foi possível salvar todas as alterações. Tente novamente. | Prestador auto-save parcial |
| Erro | Não foi possível atualizar seus dados. Tente novamente. | Prestador catch |
| Sucesso | Dados atualizados com sucesso. | Prestador auto-save OK |
| Sucesso | Foto atualizada com sucesso. | `useUploadProfilePhoto` |
| Sucesso | Foto removida. | `useRemoveProfilePhoto` |
| Erro | (mensagem do upload / genérico) | `useUploadProfilePhoto` / `useRemoveProfilePhoto` |
| Sucesso | Link copiado. | Card prestador (`MyAccountProviderPage`) |
| Erro | Não foi possível copiar. | Idem |
| Sucesso | Link copiado para a área de transferência. | `PublicProfileSettingsSection` |
| Erro | Não foi possível copiar o link. | Idem |
| Erro | Não foi possível atualizar. Tente novamente. | `useUpdateProviderProfile` private |
| Erro | Não foi possível atualizar o perfil. Tente novamente. | `useUpdateProviderProfile` public |
| Confirmação logout | Você será desconectado… | `LogoutSection` |

**Privacidade / DPO (corpo de diálogo):** instruções de e-mail ao DPO e prazo de 15 dias úteis (`PrivacySection`, `DangerZoneSection`).

---

## 12. Evidências no código

- Páginas: `components/MyAccountPage.tsx`, `MyAccountClientPage.tsx`, `MyAccountProviderPage.tsx`
- Validação: `types/accountForm.validation.ts`, `types/providerAccountForm.validation.ts`
- UI: `DadosPessoaisSection.tsx`, `ContatoIdentidadeSection.tsx`, `EntityTypeSection.tsx`, `LegalIdentitySection.tsx`, `OfferedServicesSection.tsx`, `PublicProfileSettingsSection.tsx`, `ServiceAreaField.tsx`, `PortfolioManagementSection.tsx`, `PrivacySection.tsx`, `DangerZoneSection.tsx`, `LogoutSection.tsx`, `AccountSummaryCard.tsx`, `AccountErrorState.tsx`
- Constantes: `constants.ts` (buckets, tamanhos, DPO, URL privacidade)
- Router: `src/router.tsx` — `path: 'conta'`, `allowedRoles={['client','provider']}`

---

## 13. Lacunas ou pontos não confirmados

| Item | Status |
|------|--------|
| `DeleteAccountDialog.tsx` implementa confirmação digitando **EXCLUIR**, mas **não é importado** em `DangerZoneSection` (fluxo real = apenas e-mail ao DPO). | Comportamento atual documentado; diálogo é código morto ou reservado. |
| Limite máximo de imagens **por item** de portfólio | Não localizado explicitamente no código analisado (apenas validação por arquivo). |
| Toasts para erros de validação da **foto de perfil** no seletor de arquivo | Não disparados em `AccountSummaryCard` (`validateProfileImageFile` retorna e encerra). |

---

## 14. Diagrama resumido

```mermaid
flowchart TD
  A[/dashboard/conta] --> B{profile.role}
  B -->|client| C[MyAccountClientPage]
  B -->|provider| D[MyAccountProviderPage]
  C --> E[profiles + client_profiles_private]
  C --> F[AddressesSection]
  D --> G[profiles + provider private/public]
  D --> H[offered_services + portfolio + storage]
```

## 15. Atualização de auditoria (2026-04-27)

- **Auto-save com debounces diferentes por perfil:** cliente (1500 ms) e prestador (2000 ms).
- **Geração de slug público é conservadora:** `display_name` gera slug automaticamente apenas quando o slug anterior é vazio ou igual ao `providerId`.
- **Validação de imagem de perfil no upload:** limite de 2 MB e tipos permitidos (`jpeg/png/webp/heic/heif`) antes de enviar ao storage.
- **Zona de perigo no estado atual:** ação de exclusão não executa delete técnico; orienta contato via `dpo@renovi.com.br`.
