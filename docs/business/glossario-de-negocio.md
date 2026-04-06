# Glossário de negócio — Renovi

Termos extraídos ou inferidos a partir de nomes de entidades, rotas e interface. Quando o significado operacional não está explícito no código, está sinalizado.

| Termo | Significado na Renovi | Onde aparece (exemplos) |
|-------|------------------------|-------------------------|
| **Pedido / solicitação de serviço** | Registro de pedido de orçamento do cliente, com serviço, dados do formulário, fotos e localização. | Tabela `service_requests`; rota “Meus Serviços” no menu cliente (`dashboardMenu.ts`). |
| **Service request** | Nome técnico em inglês do mesmo conceito. | Código, APIs, migrations. |
| **Orçamento (UI cliente)** | Conjunto de propostas recebidas e interações (perguntas) ligadas aos pedidos. | `/dashboard/orcamentos`, módulo `client-budgets`. |
| **Orçamento (UI prestador)** | Propostas que o prestador enviou e suas perguntas. | `/dashboard/budgets`, módulo `provider-budgets`. |
| **Proposta** | Oferta formal do prestador para um pedido: valores, impostos/taxa da plataforma, prazo, janelas sugeridas, status. | `provider_proposals`, RPCs `create_provider_proposal`, etc. |
| **Trabalho / Job** | Na UI do prestador, oportunidade derivada de um pedido compatível com perfil e área. | `provider-jobs`, RPC `match_provider_jobs`, função Edge `match-provider-jobs`. |
| **Cliente** | Papel `client` em `profiles.role`. | Auth, RLS, rotas. |
| **Prestador / Profissional** | Papel `provider`. Cadastro em `/cadastro/profissional`. | Auth, perfil público, jobs, budgets. |
| **Administrador** | Papel `admin` no banco; políticas e RPCs podem tratar admin de forma diferente. | Migrations, `database.types.ts`. **Painel admin não roteado no front analisado.** |
| **Slug** | Identificador amigável na URL do perfil público do prestador. | `provider_profiles_public.slug`, rota `/perfil/:slug`. |
| **Formulário dinâmico** | Formulário definido por schema JSON versionado na plataforma. | `platform_forms`, componentes `dynamic-form`. |
| **Serviço de plataforma** | Item do catálogo (`platform_services`) associado a um formulário e opcionalmente a prompt de IA. | `request-quote`, migrations de serviços. |
| **Descrição inteligente** | Geração assistida de texto (e metadados) via modelo de IA a partir do formulário e notas. | Edge `generate-smart-description`. |
| **Área de atuação** | Bairros em que o prestador declara atuar (`provider_service_area_neighborhoods`). | `my-account` (ex.: `ServiceAreaField.tsx`). |
| **Portfólio** | Imagens/itens exibidos no perfil público. | `provider_portfolio_items`, storage `provider-portfolio-images`. |
| **Urgência** | Campo opcional do pedido com valores `low` / `medium` / `high`. | `service_requests.urgency` (CHECK na migration). |
| **Complexidade do escopo** | Campo opcional `simple` / `medium` / `complex`. | `service_requests.scope_complexity`. |
| **Duração estimada (hint)** | Chaves como `under_1h`, `1_to_2h`, … definidas em CHECK. | `service_requests.estimated_duration_hint`. |
| **Status do pedido** | `open`, `in_progress`, `closed`, `cancelled`. | `service_requests.status`. |
| **Status da proposta** | `submitted`, `accepted`, `rejected`, `withdrawn`. | `provider_proposals.status`. |
| **Unidade de duração da proposta** | `hours` ou `days`. | `provider_proposals.proposal_duration_unit`. |
| **Taxa Renovi** | Constante de plataforma (ex.: chave `renovi_tax_provider` seed 0,15 nas migrations). | `platform_constants`. |
| **Assinatura de precificação** | Mecanismo HMAC para integridade dos valores calculados no servidor ao criar proposta. | RPCs `generate_provider_pricing_signature`, `create_provider_proposal`. |
| **reCAPTCHA** | Validação anti-abuso em cadastro e envio de pedido. | `verify-recaptcha`, `src/lib/recaptcha.ts`. |
| **Rate limit** | Controle por chave na tabela `platform_rate_limits` (usado nas Edge Functions). | `_shared/rateLimiter.ts`. |

## Siglas

| Sigla | Significado |
|-------|-------------|
| **RLS** | Row Level Security — políticas de acesso por linha no Postgres (Supabase). |
| **RPC** | Função exposta no Postgres chamada pelo cliente ou Edge Function. |
| **JWT** | Token de sessão Supabase (uso em funções com `verify_jwt` ou validação manual). |
| **CEP** | Código de endereçamento postal — usado em fluxos de endereço. |
| **IA / LLM** | Modelos OpenAI ou Google Gemini conforme configuração da função de descrição inteligente. |

## Nomenclaturas que podem confundir

| UI (menu) | Código / conceito |
|-----------|-------------------|
| “Meus Serviços” (cliente) | Lista de **pedidos** (`service_requests`), não serviços ofertados. |
| “Solicitações” (prestador) | Também pedidos, vistos como oportunidades de trabalho. |
| “Orçamentos” | Contexto distinto: cliente vê **recebidos**; prestador vê **enviados**. |
