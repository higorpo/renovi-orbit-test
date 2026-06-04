# Glossário de negócio — Renovi

Termos extraídos ou inferidos a partir de nomes de entidades, rotas e interface. Quando o significado operacional não está explícito no código, está sinalizado.

| Termo | Significado na Renovi | Onde aparece (exemplos) |
|-------|------------------------|-------------------------|
| **Pedido / solicitação de serviço** | Registro de pedido de orçamento do cliente, com serviço, dados do formulário, fotos e localização. | Tabela `service_requests`; rota “Meus Serviços” no menu cliente (`dashboardMenu.ts`). |
| **Service request** | Nome técnico em inglês do mesmo conceito. | Código, APIs, migrations. |
| **Orçamento (UI cliente)** | Propostas recebidas por pedido: sheet **Comparar orçamentos** / **Histórico de orçamentos** em Meus Serviços; negociação ativa em Conversas. | `client-my-services` + `negotiation-proposals`; `/dashboard/requests`; `/dashboard/chats`. |
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
| **Status da proposta** | `PENDING`, `ACCEPTED`, `REJECTED`, `REVISION_REQUESTED`, `REVISED`, `EXPIRED`, `REJECTED_AUTOMATICALLY`. | `provider_proposals.status` (enum CNS). |
| **Unidade de duração da proposta** | `hours` ou `days`. | `provider_proposals.proposal_duration_unit`. |
| **Taxa Renovi** | Constante de plataforma (ex.: chave `renovi_tax_provider` seed 0,15 nas migrations). | `platform_constants`. |
| **Assinatura de precificação** | Mecanismo HMAC para integridade dos valores calculados no servidor ao criar proposta. | RPCs `generate_provider_pricing_signature`, `create_provider_proposal`. |
| **reCAPTCHA** | Validação anti-abuso em cadastro e envio de pedido. | `verify-recaptcha`, `src/lib/recaptcha.ts`. |
| **Rate limit** | Controle por chave na tabela `platform_rate_limits` (usado nas Edge Functions). | `_shared/rateLimiter.ts`. |
| **Manter conectado** | Preferência do usuário no login: quando ativa, a sessão Supabase persiste em **Capacitor Preferences**; quando inativa, fica só em memória até o app encerrar. | `orbit_persist_session`, `LoginForm`, `createSupabaseAuthStorage`. |
| **Capacitor Preferences** | API de armazenamento chave-valor do app (nativo ou fallback web); substitui o uso direto de `localStorage` do browser nos fluxos mapeados. | `@capacitor/preferences`, `preferencesStorage.ts`. |
| **Message Dispatcher** | Subsistema backend de envio de notificações multicanal (e-mail via Resend, push via FCM). Opera no schema `message_dispatcher` com máquina de estados (FSM), controle de quota e horário silencioso. | Schema `message_dispatcher`, Edge Functions `message-dispatcher-worker`, `message-dispatcher-webhook-resend`. |
| **Dispatch** | Registro individual de intenção de envio no Message Dispatcher. Cada dispatch possui canal, template, perfil destinatário e status na FSM. | Tabela `message_dispatcher.message_dispatches`. |
| **Horário silencioso (Quiet Hours)** | Janela das 22:00 às 06:00 (America/Sao_Paulo) na qual o Message Dispatcher não envia mensagens. Dispatches nessa janela são reagendados para 06:00 BRT. | Funções `message_dispatcher_is_quiet_hours`, `message_dispatcher_next_send_window`. |
| **bypass_limits** | Flag no dispatch que indica que verificações de quota/cooldown devem ser puladas e que o envio **não conta** no total diário (5 e-mail / 20 push em 24h). Ativada automaticamente quando uma mensagem é reagendada por horário silencioso; mensagens de chat usam `true` na ingestão. | Campo `message_dispatches.bypass_limits`. |
| **CNS (Conversas e Negociação)** | Subsistema de conversas in-app por pedido, com propostas versionadas, slots de conversa ativa e integração ao Message Dispatcher. | `src/features/chats/`, `negotiation-proposals/`, migrations `202607*`, rotas `/chats`. |
| **Conversa / chat** | Thread bilateral cliente–prestador ligada a um `service_request`; status `ACTIVE`, `INACTIVE` ou `CLOSED`. | Tabela `chats`, RPCs `list_conversations`, `cns_send_message`. |
| **Slot de conversa ativa** | Vaga de negociação simultânea por pedido (padrão **4**); contador em `service_request_negotiation_stats`. INACTIVE libera slot; reativação não consome de novo. | Constante `chats.max_active_slots_per_service_request`; design §3.3.1. |
| **Mensagem livre** | Texto ou mídia fora do card de proposta; **bloqueada** enquanto há proposta `PENDING`. | RPC `cns_send_message`, regra Req. 34. |
| **Proposta (CNS)** | Oferta com FSM: `PENDING`, `REVISION_REQUESTED`, `ACCEPTED`, `REJECTED`, `EXPIRED`, etc. Criação canônica por `create_provider_proposal(service_request_id)`; espelho opcional na timeline. | `provider_proposals`, RPCs `create_provider_proposal`, `accept_proposal`. |
| **Reciprocidade** | Regra que inativa conversa sem resposta bilateral no prazo; pode reativar com nova mensagem válida. | Cron `cron_chat_evaluate_reciprocity`, status `INACTIVE`. |
| **domain_events** | Fila de eventos de domínio processada assincronamente para notificações e efeitos colaterais. | Tabela `domain_events`, Edge `cns_process_domain_events`. |

## Siglas

| Sigla | Significado |
|-------|-------------|
| **RLS** | Row Level Security — políticas de acesso por linha no Postgres (Supabase). |
| **RPC** | Função exposta no Postgres chamada pelo cliente ou Edge Function. |
| **FSM** | Finite State Machine — máquina de estados finita; usada no Message Dispatcher para gerenciar ciclo de vida dos dispatches. |
| **FCM** | Firebase Cloud Messaging — serviço do Google para envio de notificações push. |
| **BRT** | Horário de Brasília (America/Sao_Paulo); referência para janela de horário silencioso. |
| **JWT** | Token de sessão Supabase (uso em funções com `verify_jwt` ou validação manual). |
| **CEP** | Código de endereçamento postal — usado em fluxos de endereço. |
| **IA / LLM** | Modelos OpenAI ou Google Gemini conforme configuração da função de descrição inteligente. |

## Nomenclaturas que podem confundir

| UI (menu) | Código / conceito |
|-----------|-------------------|
| “Meus Serviços” (cliente) | Lista de **pedidos** (`service_requests`), não serviços ofertados. |
| “Solicitações” (prestador) | Também pedidos, vistos como oportunidades de trabalho. |
| “Orçamentos” | **Prestador:** propostas enviadas (`/dashboard/budgets`). **Cliente:** não há item de menu homônimo; comparar/histórico de propostas no card em **Meus Serviços**; negociação em **Conversas**. |
