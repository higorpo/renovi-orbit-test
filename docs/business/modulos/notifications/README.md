# Notifications (cliente — engagement de push)

## 1. Leitura para negócio

- **Para que serve:** registrar no backend quando o usuário **toca** (clique/ação) em uma **notificação push** entregue pelo Message Dispatcher, permitindo medir engajamento (`clicked`) por dispatch.
- **Quem usa:** qualquer usuário autenticado que receba push no **app nativo** (Capacitor) e toque na notificação — cliente ou prestador; o módulo em si não distingue papel.
- **Processo suportado:** tracking de engajamento pós-entrega; **não** envia, agenda nem exibe notificações.
- **Valor:** alimenta `message_dispatch_engagements` com evidência de interação real no dispositivo.
- **Riscos operacionais:** falha de tracking é **silenciosa para o usuário** (só log); clique em push na **web (Service Worker)** hoje **não** passa por este módulo.

## 2. Visão geral funcional

- **Objetivo:** expor a API client-side `recordPushClick`, que chama a RPC `message_dispatcher.message_dispatcher_record_push_click`.
- **Escopo:** pasta `src/features/notifications/` — apenas camada `api/` + Public API (`index.ts`). Sem telas, hooks, componentes ou rotas.
- **Limites:** não cobre ingestão, quotas, horário silencioso, entrega FCM/Resend nem abertura de e-mail (`opened` via webhook). Esses comportamentos pertencem ao [Message Dispatcher](../message-dispatcher/README.md).
- **Relação:** consumido por `src/lib/push.ts` nos listeners nativos de ação em push/local notification.

## 3. Features do módulo

| Feature | Resumo | Documento |
|---------|--------|-----------|
| Engagement push (clique) | Contrato mínimo cliente → RPC de clique em push; deduplicação e ownership no banco | [features/engagement-push.md](./features/engagement-push.md) |

## 4. Perfis envolvidos

- **Cliente / Prestador (authenticated):** podem registrar clique apenas em dispatches cujo `profile_id` = `auth.uid()`.
- **Visitante / anon:** sem grant na RPC (`authenticated` + `service_role` apenas).
- **Admin:** sem tratamento especial neste módulo; aplica-se a mesma regra de ownership por `profile_id`.

## 5. Principais fluxos

1. Push (ou local notification derivada) chega no app nativo com `data.dispatch_id`.
2. Usuário toca a notificação → listeners em `src/lib/push.ts` (`pushNotificationActionPerformed` / `localNotificationActionPerformed`).
3. Se houver `dispatch_id`, `trackPushClick` chama `recordPushClick({ dispatchId })`.
4. RPC valida ownership e canal `push`, faz upsert do engagement `clicked` com `source = client_app`.
5. Em erro, a API lança; o caller engole e registra `logger.warn` — navegação da notificação **não** depende do tracking.

## 6. Regras transversais

- Engagement é **ortogonal** ao FSM de status do dispatch (não altera `DELIVERED` / falhas).
- Deduplicação por `(dispatch_id, engagement_type)`: primeiro insert (`first_engagement`); repetições incrementam `seen_count` e atualizam `last_seen_at`.
- Sem `dispatch_id` no payload → **nenhuma** chamada a `recordPushClick`.
- Metadata é opcional na API; o caller atual **não** envia metadata (default `{}`).

## 7. Entidades

| Entidade / contrato | Papel neste módulo |
|---------------------|--------------------|
| `message_dispatcher.message_dispatch_engagements` | Persistência do clique (`engagement_type = clicked`). |
| `message_dispatcher.message_dispatches` | Lookup de ownership e canal na RPC. |
| `RecordPushClickParams` / `RecordPushClickResult` | Contrato TypeScript da Public API. |

## 8. Integrações

| Integração | Direção | Observação |
|------------|---------|------------|
| Message Dispatcher (RPC) | Cliente → banco | `message_dispatcher_record_push_click` → interno `message_dispatcher_record_engagement` |
| `src/lib/push.ts` | Caller → este módulo | Único consumidor de produção encontrado |
| Capacitor Push / Local Notifications | Upstream do caller | Fornecem o `dispatch_id` no `data` / `extra` |
| Logger / Sentry | Observabilidade | Erro da RPC: `logger.error` na API; falha engolida: `logger.warn` no caller |

## 9. Riscos e lacunas

- **Web / PWA:** `src/sw.ts` trata `notificationclick` só para navegação; **não** chama `recordPushClick` — gap de cobertura de engagement na web.
- **Foreground web (`onMessage`):** não dispara tracking de clique neste módulo.
- Nome da feature/pasta sugere “notifications” amplas, mas o código cobre **somente** registro de clique push.
- Documentação do Message Dispatcher descreve engagement de forma geral; este módulo documenta o **lado cliente** — overlap intencional, sem editar o README do MMD neste entregável.

## 10. Evidências

| Artefato | Relevância |
|----------|------------|
| `src/features/notifications/api/engagementTracking.api.ts` | Implementação de `recordPushClick` |
| `src/features/notifications/index.ts` | Public API |
| `src/features/notifications/api/__tests__/engagementTracking.api.test.ts` | Contrato RPC, defaults, erro |
| `src/lib/push.ts` | Caller nativo (`trackPushClick`) |
| `src/lib/__tests__/push.test.ts` | Cenários de tap + falha de tracking |
| `src/sw.ts` | Clique web **sem** engagement |
| `supabase/migrations/20260621100100_create_message_dispatcher_fsm_functions.sql` | RPCs `record_push_click` / `record_engagement` |
| `supabase/migrations/20260621100000_create_message_dispatcher_schema_enums_tables.sql` | Tabela e enum de engagement |
| `supabase/tests/message_dispatcher/record_push_click_*.sql` | Ownership e canal |
| `supabase/functions/message-dispatcher-worker/fcm.ts` | Payload FCM inclui `dispatch_id` |
