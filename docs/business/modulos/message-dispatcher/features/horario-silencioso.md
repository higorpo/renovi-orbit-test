# Horário silencioso (Quiet Hours)

## 1. Resumo

O Message Dispatcher impõe uma **janela de silêncio** das **22:00 às 06:00** no fuso horário **America/Sao_Paulo** (BRT/BRST). Mensagens cuja entrega cairia nessa janela são automaticamente reagendadas para **06:00 BRT** do próximo dia útil de envio, garantindo que os usuários não recebam notificações durante a madrugada.

## 2. Regra de negócio

| Aspecto | Detalhe |
|---------|---------|
| Janela | **22:00–06:00** America/Sao_Paulo |
| Comportamento | Mensagens agendadas para dentro da janela são reagendadas para o próximo **06:00 BRT** |
| `bypass_limits` | Mensagens reagendadas por horário silencioso recebem `bypass_limits = true`, para que ao serem ativadas não sofram nova avaliação de quota (já foram aprovadas na ingestão original) |
| Abrangência | Aplica-se a **todos os canais** (e-mail e push) |
| Configurabilidade | A janela está **hardcoded** nas funções SQL; não há constante em `platform_constants` para alterar sem deploy |

## 3. Pontos de aplicação

A regra é aplicada em **dois pontos** da pipeline, garantindo cobertura mesmo em cenários de corrida ou reprocessamento:

### 3.1. Ingestão (`message_dispatcher_ingest`)

Após aprovação de quota e cálculo do horário de envio, a função verifica se o `scheduled_for` calculado cai na janela de silêncio:

- **Se sim:** `scheduled_for` é movido para `06:00 BRT` do dia seguinte (ou mesmo dia, se o horário atual < 06:00), o status é `SCHEDULED` e `bypass_limits` é marcado como `true`.
- **Se não:** fluxo normal (status `QUEUED` se imediato, `SCHEDULED` se futuro).

Adicionalmente, quando um push é reagendado por **cooldown** e o horário resultante do cooldown cai na janela de silêncio, a mesma lógica é aplicada: o `scheduled_for` é movido para 06:00 BRT e `bypass_limits` é definido como `true`.

### 3.2. Avaliação de pendentes (`message_dispatcher_evaluate_pending`)

Funciona como **rede de segurança** para dispatches que chegaram ao estado `PENDING_EVALUATION` (via cron `activate_scheduled`) durante horário silencioso:

- Se `now()` está na janela de silêncio, todos os dispatches restantes em `PENDING_EVALUATION` (após aplicação de quotas e cooldown) são reagendados para `06:00 BRT` com `bypass_limits = true`, em vez de serem movidos para `QUEUED`.
- Fora da janela, o fluxo normal move para `QUEUED`.

Também afeta a lógica de cooldown de push dentro do `evaluate_pending`: se o horário de cooldown resultante cai na janela silenciosa, o dispatch é reagendado para 06:00 BRT.

## 4. Funções auxiliares

| Função | Assinatura | Comportamento |
|--------|-----------|---------------|
| `message_dispatcher_is_quiet_hours` | `(p_ts timestamptz) → boolean` | Retorna `true` quando a hora em `America/Sao_Paulo` é ≥ 22 ou < 6. |
| `message_dispatcher_next_send_window` | `(p_ts timestamptz) → timestamptz` | Retorna o próximo `06:00 America/Sao_Paulo`. Se a hora atual < 6, retorna 06:00 do mesmo dia; caso contrário, 06:00 do dia seguinte. |

Ambas são `STABLE`, `PARALLEL SAFE` e acessíveis apenas via `service_role`.

## 5. Impacto no `bypass_limits`

Mensagens reagendadas por horário silencioso recebem `bypass_limits = true`. Isso tem duas consequências:

1. **Na reativação pelo cron:** quando o cron `activate_scheduled` move a mensagem para `PENDING_EVALUATION` e `evaluate_pending` reavalia, a flag `bypass_limits` faz com que as verificações de quota (diária e cooldown) sejam puladas — a mensagem já foi aprovada na ingestão.
2. **Composição com cooldown de push:** se o cooldown resulta em horário dentro da janela silenciosa, o `bypass_limits` é habilitado para a mesma razão.

## 6. Cenários de exemplo

| Cenário | Horário de ingestão | scheduled_for original | Resultado |
|---------|---------------------|----------------------|-----------|
| Push imediato às 23h | 23:00 BRT | now() (23:00) | Reagendado para 06:00 BRT do dia seguinte, `SCHEDULED`, `bypass_limits = true` |
| E-mail agendado para 03h | qualquer | 03:00 BRT | Reagendado para 06:00 BRT do mesmo dia |
| Push com cooldown até 22:30 | 22:20 BRT | cooldown_until = 22:30 | cooldown_until cai na janela → reagendado para 06:00 BRT do dia seguinte |
| Push imediato às 10h | 10:00 BRT | now() (10:00) | Fluxo normal: `QUEUED` |
| Cron ativa scheduled às 01h | — | `PENDING_EVALUATION` | `evaluate_pending` detecta janela → reagenda para 06:00 BRT |

## 7. Testes (evidência)

| Arquivo de teste | Cobertura |
|------------------|-----------|
| `supabase/tests/message_dispatcher/quiet_hours_helpers_test.sql` | Funções auxiliares `is_quiet_hours` e `next_send_window` com valores-limite (21:59, 22:00, 05:59, 06:00, 12:00) |
| `supabase/tests/message_dispatcher/quiet_hours_ingest_reschedule_test.sql` | Reagendamento no `ingest` para mensagens cuja entrega cairia na janela silenciosa |
| `supabase/tests/message_dispatcher/quiet_hours_evaluate_pending_test.sql` | Rede de segurança no `evaluate_pending` durante horário silencioso |

## 8. Persistência e campos afetados

| Campo (`message_dispatches`) | Impacto |
|------------------------------|---------|
| `scheduled_for` | Movido para próximo 06:00 BRT quando na janela silenciosa |
| `status` | Definido como `SCHEDULED` (em vez de `QUEUED`) |
| `bypass_limits` | Marcado como `true` para pular reavaliação de quota |

## 9. Limitações e pendências

- A janela 22:00–06:00 está **hardcoded** em SQL; para ajustar é necessário alterar a migration e refazer deploy. Uma evolução possível seria parametrizar via `platform_constants`.
- Não há suporte a **fusos horários por usuário** — a janela é fixa em `America/Sao_Paulo` para todos os perfis.
- Não há **notificação ao usuário** de que sua mensagem foi reagendada por horário silencioso (o dispatch simplesmente aparece como `SCHEDULED`).

## 10. Evidências

| Artefato | Seções relevantes |
|----------|-------------------|
| `supabase/migrations/20260621100100_create_message_dispatcher_fsm_functions.sql` | Funções `message_dispatcher_is_quiet_hours`, `message_dispatcher_next_send_window`, blocos de quiet hours em `ingest` e `evaluate_pending` |
| `supabase/tests/message_dispatcher/quiet_hours_helpers_test.sql` | Testes dos helpers |
| `supabase/tests/message_dispatcher/quiet_hours_ingest_reschedule_test.sql` | Testes do ingest |
| `supabase/tests/message_dispatcher/quiet_hours_evaluate_pending_test.sql` | Testes do evaluate_pending |
