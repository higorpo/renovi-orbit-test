# Pendências e incertezas

Itens que exigem validação humana, evidência parcial ou conflito entre trechos do código.

## Conflitos ou riscos técnicos com impacto de negócio

| ID | Tema | Descrição | Severidade sugerida |
|----|------|-----------|---------------------|
| P-01 | Redirecionamento pós-pedido | `useRequestQuoteSubmit` navega para `/dashboard/client` após sucesso; **não existe** essa rota em `router.tsx` (apenas `/dashboard/...`). **Comportamento provável:** 404 ou fallback do router. | Alta — fluxo cliente após pedido |
| P-02 | Destino do admin | `getRedirectPathForProfile` envia `admin` para `/admin/dashboard`; **rotas `/admin` não constam** do `router.tsx`. | Alta — se existirem usuários admin reais |
| P-03 | Onboarding | Papéis desconhecidos redirecionam para `/onboarding`; rota **não listada** no router analisado. | Média |
| P-04 | Menu vs rota “Endereços” | Menu do cliente aponta `/dashboard/addresses`, mas a rota renderiza `DashboardFakePage` (“Endereços” placeholder). Gestão real em `MyAccountClientPage` (`AddressesSection`). | Média — UX/ops |
| P-05 | `/dashboard/services/:id` | Rota existe com `ClientMyServicesDetailPlaceholder`; nome sugere detalhe de pedido — **confirmar** se é placeholder permanente ou feature incompleta. | Média |
| P-06 | Default do provedor de IA | Comentários em tipos vs `handlerHelpers` do Edge Function: default efetivo do campo `provider` pode ser **Gemini**; documentação interna pode divergir. | Baixa — transparência operacional |
| P-07 | `/dashboard/requests` sem guard só de cliente | O layout de `/dashboard` permite `client` e `provider`, mas **não há** `ProtectedRoute` aninhado com `allowedRoles={['client']}` em `/dashboard/requests` (diferente de `addresses` e `orcamentos`). **Comportamento:** um prestador autenticado pode acessar a URL; a página pode falhar em RPCs ou mostrar estado vazio — precisa validação. | Média — segurança de UX/permissão |

## Evidência parcial

- **Políticas RLS linha a linha:** resumidas por módulo; revisão jurídica/compliance exige leitura integral de cada migration.
- **Mensagens de erro do servidor:** RPCs retornam JSON estruturado; nem todas as chaves foram catalogadas nas features.
- **Testes E2E:** não foram executados nesta documentação; apenas leitura estática. Sessão mockada/seed usa chaves com prefixo **`CapacitorStorage.`** no `localStorage` do browser (alinhado ao fallback web do plugin Preferences).
- **device-beacon** e **push-permission:** persistência local documentada na [rastreabilidade](./rastreabilidade.md); **não** há README em `docs/business/modulos/` para essas pastas em `src/features/`.

## Comportamento inferido

- Prestador e cliente compartilham o layout `/dashboard`; a **especialização** ocorre por submenu + guards aninhados.
- “Ganhos”, “Configurações”, “Ajuda”, “Visão geral” no menu são **placeholders** até nova implementação.

## Necessita validação com negócio/produto

- Regras exatas de **matching** geográfico (raio, ordenação) e pesos de negócio além do que está em SQL/RPC.
- Política de **expiração** de propostas (`expire_stale_provider_proposals`) — frequência de execução (cron) não verificada neste escopo.
- **Pagamentos e contratos** — apenas planos em `docs/payment-system-*.md`, sem implementação mapeada nas Edge Functions deste tree.

## Inferências explicitamente não comprovadas

- Uso de **Realtime** Supabase para notificações push ao usuário (config habilitado no `config.toml`, uso no `src` não mapeado de forma exaustiva).
- ~~**Envio de e-mail** em produção: Resend aparece em comentários de config; ambiente local usa Inbucket.~~ **Resolvido:** o Message Dispatcher utiliza Resend como vendor de e-mail e FCM para push, com integração completa (ingest → checkout → worker → report → webhook reconcile). Evidência: `supabase/functions/message-dispatcher-worker/`, `supabase/functions/message-dispatcher-webhook-resend/`, migration FSM.

## Observações do Message Dispatcher

| ID | Tema | Descrição | Severidade sugerida |
|----|------|-----------|---------------------|
| P-08 | Janela de horário silencioso hardcoded | A janela 22:00–06:00 America/Sao_Paulo está fixa nas funções SQL `message_dispatcher_is_quiet_hours` e `message_dispatcher_next_send_window`. Para alterar é necessário modificar a migration. Sugestão: parametrizar via `platform_constants`. | Baixa — operacional |
| P-09 | Fuso horário único | O horário silencioso não considera o fuso horário do perfil do usuário; todos são tratados em BRT. Para operação futura em outros fusos, será necessário adaptar. | Baixa — evolução futura |
| P-10 | Cobertura documental parcial do Message Dispatcher | Apenas a feature de horário silencioso possui documento dedicado. As demais capacidades (quotas, checkout, reconciliação, engagement) estão descritas no README do módulo mas sem feature doc individual. | Baixa — documentação |
