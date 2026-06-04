# Perfis e permissões

Consolidação a partir de `src/router.tsx`, `src/features/auth/components/routeGuards.tsx`, `src/features/auth/types/auth.types.ts`, `src/features/auth/hooks/useAuth.tsx`, `src/layouts/DashboardLayout/dashboardMenu.ts` e políticas nas migrações Supabase (visão resumida).

## Papéis (`profiles.role`)

Valores permitidos no modelo: **`client`**, **`provider`**, **`admin`** (CHECK em migrations de `profiles`).

Restrições de **atribuição de papel** (triggers / políticas):

- Signup pela aplicação aceita apenas **client** ou **provider** nos fluxos tipados.
- Promoção a **admin** ou mudança **client → provider** por update é **bloqueada** por triggers de segurança (migrations `restrict_role_admin_security`, `profiles_security_role_and_image_path`).

## Matriz: rotas do front-end

| Rota | Autenticação | Papéis permitidos |
|------|--------------|-------------------|
| `/` | Pública | — |
| `/pedir-orcamento` | Pública (fluxo suporta logado e convidado) | — |
| `/perfil/:slug` | Pública | — |
| `/login`, `/cadastro/cliente`, `/cadastro/profissional`, `/esqueceu-senha` | `GuestOnlyRoute` | Só convidado: se já logado com papel “permitido”, redireciona |
| `/recuperar-senha` | Pública (sem GuestOnly no router) | — |
| `/demo/form` | DEV apenas | — |
| `/dashboard` (layout) | `ProtectedRoute` | `client`, `provider` (**admin excluído**) |
| `/dashboard/requests`, `/dashboard/services/:id` | Herdado | `client`, `provider` no layout — **comportamento de negócio**: tela é de cliente; prestador pode ser redirecionido em fluxos específicos conforme implementação da página |
| `/dashboard/addresses` | `ProtectedRoute` aninhado | **`client` apenas** |
| `/dashboard/conta` | Aninhado | `client`, `provider` |
| `/dashboard/jobs`, `/dashboard/jobs/:jobId` | Aninhado | **`provider` apenas** |
| `/dashboard/budgets`, `/dashboard/budgets/pedido/:id` | Aninhado | **`provider` apenas** |
| `/dashboard/chats`, `/dashboard/chats/:chatId` | Aninhado | `client`, `provider` |
| `/dashboard/earnings` | Aninhado | **`provider` apenas** |
| `/example` | `ProtectedRoute` | **`client` apenas** |

### Redirecionamento pós-login (`getRedirectPathForProfile`)

| Papel | Destino |
|-------|---------|
| `admin` | `/admin/dashboard` |
| `client` ou `provider` | `/dashboard` |
| Desconhecido | `/onboarding` (com log de aviso em DEV) |

**Necessita validação com produto:** não há rotas `/admin/*` nem `/onboarding` declaradas em `router.tsx` — risco de 404 para admin ou papel inválido.

## Menu do dashboard (`getDashboardMenu`)

- Se `role === "client"` → itens de cliente (Visão geral, Meus Serviços, Conversas, Endereços, Minha conta, Ajuda).
- Caso contrário → menu de prestador (Visão geral, Solicitações, Trabalhos, Orçamentos, Ganhos, Minha conta, Ajuda).

**Comportamento inferido:** um usuário `admin` que de alguma forma renderizasse o layout com esse helper veria o **menu de prestador**, pois só há ramificação explícita para `client`. Na prática, `admin` não passa pelo `ProtectedRoute` do dashboard com as roles atuais.

## Ações permitidas no banco (visão de alto nível)

| Área | Cliente | Prestador | Admin |
|------|---------|-----------|-------|
| Ler/editar próprio perfil em `profiles` | Sim (dono) | Sim (dono) | Conforme RLS |
| `client_profiles_private` | Dono | — | Leitura administrativa (políticas) |
| `provider_profiles_private` / `public` | — | Dono (escrita pública condicionada a `provider`) | Conforme políticas |
| `service_requests` | CRUD sobre próprios pedidos onde aplicável | Leitura / fluxos de job conforme RPC e RLS | Muitas políticas incluem admin |
| `provider_proposals` | Ver/responder no fluxo de orçamento | Criar/atualizar próprias propostas | Conforme RPC (ex.: assinatura/preço) |
| Catálogo (`platform_services`, `platform_forms`, cidades…) | Leitura conforme política | Leitura conforme política | Gestão onde política exige `admin` |

Para detalhes por tabela, ver arquivos em `supabase/migrations/` citados em [rastreabilidade](./rastreabilidade.md).

## Feature flags por papel

**Evidência parcial no código:** não foram encontradas flags de produto por role; apenas variáveis de ambiente de build/runtime (PWA, Sentry, cache React Query, etc.).

## Resumo executivo para operações

- O **painel principal** (`/dashboard`) é compartilhado por cliente e prestador, mas **cada área sensível** reforça o papel com `ProtectedRoute` aninhado.
- **Admin** existe no banco mas **não** está integrado ao conjunto de rotas analisado do app.
- Endereços: rota dedicada no menu é **placeholder**; gestão real ocorre em **Minha conta** e no **Pedir orçamento**.
