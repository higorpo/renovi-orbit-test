# Minha conta (cliente e prestador)

## 1. Resumo executivo

- **O que é:** página unificada **`/dashboard/conta`** que renderiza **`MyAccountClientPage`** ou **`MyAccountProviderPage`** conforme `profile.role`.
- **Problema que resolve:** configuração de dados cadastrais, privacidade, e no prestador **perfil público**, **serviços**, **área de atuação** e **portfólio**.
- **Quem usa:** cliente e prestador autenticados.
- **Resultado esperado:** dados consistentes em `profiles` e tabelas satélite.

## 2. Objetivo de negócio

- **Finalidade:** habilitar matching (área + serviços) e conversão (perfil público).
- **Valor:** reduz fraude e dados incompletos.
- **Impacto:** altera o que aparece em `/perfil/:slug` e em `match_provider_jobs`.
- **Contexto:** pós-cadastro contínuo.

## 3. Localização na plataforma

| Aspecto | Detalhe |
|---------|---------|
| Rota | `/dashboard/conta` |
| Entrada | Menu “Minha conta” |
| Arquivos | `MyAccountPage.tsx`, `MyAccountClientPage.tsx`, `MyAccountProviderPage.tsx`, `ServiceAreaField.tsx`, etc. |

## 4. Perfis envolvidos

| Papel | Áreas principais |
|-------|------------------|
| Cliente | Dados pessoais, privacidade, exclusão de conta, **AddressesSection** |
| Prestador | Acima (adaptado) + dados legais PF/PJ, slug, visibilidade, serviços ofertados, área por bairros, portfólio, foto |

## 5. Fluxo funcional principal

1. Usuário abre Minha conta.
2. Navega entre seções/tabs.
3. Edita campos e salva.
4. Uploads de imagem vão para storage com políticas RLS.

```mermaid
flowchart TD
  A[/dashboard/conta] --> B{role?}
  B -->|client| C[MyAccountClientPage]
  B -->|provider| D[MyAccountProviderPage]
  C --> E[Endereços + privacidade]
  D --> F[Perfil público + portfólio + área + legal]
```

## 6. Fluxos alternativos e exceções

- **Danger zone:** exclusão de conta — fluxo sensível (confirmar passos nos componentes).
- **Erro de upload:** tratamento por `profileImageStorage` / `portfolioImageStorage`.

## 7. Regras de negócio

1. Apenas **provider** grava em `provider_profiles_public` / serviços ofertados / portfólio (RLS).
2. `entity_type` em dados legais: `pf` ou `pj` (CHECK).
3. `profile_visibility` e visibilidade de itens de portfólio (`public` / `private`).
4. Área de atuação: associação a bairros (`provider_service_area_neighborhoods`).

## 8. Campos e dados

**Nota:** lista completa campo a campo exigiria extrair cada formulário. Abaixo, entidades principais.

| Entidade | Campos de negócio (amostra) |
|----------|----------------------------|
| `profiles` | full_name, phone, profile_image_path, role |
| `client_profiles_private` | CPF e demais sensíveis |
| `provider_profiles_private` | CNPJ, razão social, tipo PF/PJ |
| `provider_profiles_public` | slug, display_name, bio, visibility |
| `provider_offered_services` | serviços selecionados do catálogo |
| `provider_portfolio_items` | imagem, serviço opcional, ordem, visibility |
| `provider_service_area_neighborhoods` | bairros por prestador |

## 9. Validações de front-end

- Schemas por seção (Zod/React Hook Form — arquivos em `components/` e `hooks/`).
- `ServiceAreaField` depende de busca de cidades/bairros (`addresses`).

## 10. Validações de back-end

- Triggers de segurança em `profiles` (imagem, papel).
- RLS por tabela satélite.
- Slug único gerado via RPC (`slugify`, `generate_unique_provider_slug`).

## 11. Status, estados e transições

- **Visibilidade do perfil:** `public` vs `restricted`.
- **Itens de portfólio:** `public` vs `private`.

## 12. Persistência

- Tabelas listadas na seção 8.
- Buckets: `profile-images`, `provider-portfolio-images`.

## 13. Integrações

- RPCs de perfil público e storage Supabase.
- Sem Edge Function exclusiva do módulo.

## 14. Listagens, buscas e filtros

- Busca de cidades/bairros na área de atuação.
- Listas de serviços do catálogo para oferta.

## 15. Ações disponíveis

| Ação | Quem | Efeito |
|------|------|--------|
| Atualizar dados | Dono | Persistência |
| Upload/remover foto | Dono | Storage + path em `profiles` |
| CRUD portfólio | Prestador | Itens + imagens |
| Salvar área | Prestador | Matching geográfico |

## 16. Dependências

- `addresses` (geografia), catálogo `platform_services`, `platform_neighborhoods`.

## 17. Regras implícitas

- Hooks `usePortfolioItems`, `useOfferedServices` encapsulam política de refetch e optimistic UI (detalhe em código).

## 18. Riscos

- Dados legais incorretos afetam compliance.
- Slug alterável impacta links públicos salvos.

## 19. Evidências

- `src/features/my-account/components/MyAccountPage.tsx`
- `src/features/my-account/api/*.api.ts`
- `src/features/my-account/components/ServiceAreaField.tsx`
- `supabase/migrations/20260318100000_create_client_profiles_private.sql`
- `supabase/migrations/20260318100002_create_provider_profiles_private.sql`
- `supabase/migrations/20260318100003_create_provider_profiles_public.sql`

## 20. Pendências

- Inventário campo-label-obrigatoriedade **por seção** para QA treinamento.
- Política de negócio para **slug** imutável vs editável.
