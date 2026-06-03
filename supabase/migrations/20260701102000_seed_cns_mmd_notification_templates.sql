-- CNS Wave A — task 21: register MMD notification templates for CNS events (design §4.10, §5.5).
-- Templates MUST exist before Wave F domain_events consumer calls cns_mmd_ingest.

-- Shared variable schema (design §5.5 normative minimum + proposal_id for lifecycle events).
-- deep_link_path example: /dashboard/chats/{chat_id}

insert into message_dispatcher.message_templates (
  template_key,
  channel,
  subject_template,
  body_template,
  variable_schema,
  active
)
values
  (
    'chat.new_message',
    'push',
    '{{sender_display_name}} enviou uma mensagem',
    '{{message_preview}}',
    '{
      "type": "object",
      "properties": {
        "chat_id": { "type": "string", "format": "uuid" },
        "service_request_id": { "type": "string", "format": "uuid" },
        "service_request_title": { "type": "string" },
        "sender_display_name": { "type": "string" },
        "message_preview": { "type": "string" },
        "deep_link_path": { "type": "string" }
      },
      "required": ["chat_id", "service_request_id", "sender_display_name", "message_preview", "deep_link_path"],
      "additionalProperties": false
    }'::jsonb,
    true
  ),
  (
    'proposal.submitted',
    'push',
    'Nova proposta',
    'Você recebeu uma proposta para {{service_request_title}}.',
    '{
      "type": "object",
      "properties": {
        "chat_id": { "type": "string", "format": "uuid" },
        "service_request_id": { "type": "string", "format": "uuid" },
        "service_request_title": { "type": "string" },
        "sender_display_name": { "type": "string" },
        "message_preview": { "type": "string" },
        "deep_link_path": { "type": "string" },
        "proposal_id": { "type": "string", "format": "uuid" }
      },
      "required": ["chat_id", "service_request_id", "service_request_title", "proposal_id", "deep_link_path"],
      "additionalProperties": false
    }'::jsonb,
    true
  ),
  (
    'proposal.submitted',
    'email',
    'Nova proposta — {{service_request_title}}',
    '<p>Você recebeu uma proposta para <strong>{{service_request_title}}</strong>.</p><p><a href="{{deep_link_path}}">Ver conversa</a></p>',
    '{
      "type": "object",
      "properties": {
        "chat_id": { "type": "string", "format": "uuid" },
        "service_request_id": { "type": "string", "format": "uuid" },
        "service_request_title": { "type": "string" },
        "sender_display_name": { "type": "string" },
        "message_preview": { "type": "string" },
        "deep_link_path": { "type": "string" },
        "proposal_id": { "type": "string", "format": "uuid" }
      },
      "required": ["chat_id", "service_request_id", "service_request_title", "proposal_id", "deep_link_path"],
      "additionalProperties": false
    }'::jsonb,
    true
  ),
  (
    'proposal.revision_requested',
    'push',
    'Revisão solicitada',
    'O cliente pediu ajustes na proposta de {{service_request_title}}.',
    '{
      "type": "object",
      "properties": {
        "chat_id": { "type": "string", "format": "uuid" },
        "service_request_id": { "type": "string", "format": "uuid" },
        "service_request_title": { "type": "string" },
        "sender_display_name": { "type": "string" },
        "message_preview": { "type": "string" },
        "deep_link_path": { "type": "string" },
        "proposal_id": { "type": "string", "format": "uuid" }
      },
      "required": ["chat_id", "service_request_id", "service_request_title", "proposal_id", "deep_link_path"],
      "additionalProperties": false
    }'::jsonb,
    true
  ),
  (
    'proposal.revision_requested',
    'email',
    'Revisão solicitada — {{service_request_title}}',
    '<p>O cliente pediu ajustes na proposta de <strong>{{service_request_title}}</strong>.</p><p><a href="{{deep_link_path}}">Responder na conversa</a></p>',
    '{
      "type": "object",
      "properties": {
        "chat_id": { "type": "string", "format": "uuid" },
        "service_request_id": { "type": "string", "format": "uuid" },
        "service_request_title": { "type": "string" },
        "sender_display_name": { "type": "string" },
        "message_preview": { "type": "string" },
        "deep_link_path": { "type": "string" },
        "proposal_id": { "type": "string", "format": "uuid" }
      },
      "required": ["chat_id", "service_request_id", "service_request_title", "proposal_id", "deep_link_path"],
      "additionalProperties": false
    }'::jsonb,
    true
  ),
  (
    'proposal.accepted',
    'push',
    'Proposta aceita',
    'Sua proposta para {{service_request_title}} foi aceita!',
    '{
      "type": "object",
      "properties": {
        "chat_id": { "type": "string", "format": "uuid" },
        "service_request_id": { "type": "string", "format": "uuid" },
        "service_request_title": { "type": "string" },
        "sender_display_name": { "type": "string" },
        "message_preview": { "type": "string" },
        "deep_link_path": { "type": "string" },
        "proposal_id": { "type": "string", "format": "uuid" }
      },
      "required": ["chat_id", "service_request_id", "service_request_title", "proposal_id", "deep_link_path"],
      "additionalProperties": false
    }'::jsonb,
    true
  ),
  (
    'proposal.accepted',
    'email',
    'Proposta aceita — {{service_request_title}}',
    '<p>Sua proposta para <strong>{{service_request_title}}</strong> foi aceita.</p><p><a href="{{deep_link_path}}">Ver detalhes</a></p>',
    '{
      "type": "object",
      "properties": {
        "chat_id": { "type": "string", "format": "uuid" },
        "service_request_id": { "type": "string", "format": "uuid" },
        "service_request_title": { "type": "string" },
        "sender_display_name": { "type": "string" },
        "message_preview": { "type": "string" },
        "deep_link_path": { "type": "string" },
        "proposal_id": { "type": "string", "format": "uuid" }
      },
      "required": ["chat_id", "service_request_id", "service_request_title", "proposal_id", "deep_link_path"],
      "additionalProperties": false
    }'::jsonb,
    true
  ),
  (
    'proposal.rejected',
    'push',
    'Proposta recusada',
    'A proposta para {{service_request_title}} foi recusada.',
    '{
      "type": "object",
      "properties": {
        "chat_id": { "type": "string", "format": "uuid" },
        "service_request_id": { "type": "string", "format": "uuid" },
        "service_request_title": { "type": "string" },
        "sender_display_name": { "type": "string" },
        "message_preview": { "type": "string" },
        "deep_link_path": { "type": "string" },
        "proposal_id": { "type": "string", "format": "uuid" }
      },
      "required": ["chat_id", "service_request_id", "service_request_title", "proposal_id", "deep_link_path"],
      "additionalProperties": false
    }'::jsonb,
    true
  ),
  (
    'proposal.rejected',
    'email',
    'Proposta recusada — {{service_request_title}}',
    '<p>A proposta para <strong>{{service_request_title}}</strong> foi recusada.</p><p><a href="{{deep_link_path}}">Ver conversa</a></p>',
    '{
      "type": "object",
      "properties": {
        "chat_id": { "type": "string", "format": "uuid" },
        "service_request_id": { "type": "string", "format": "uuid" },
        "service_request_title": { "type": "string" },
        "sender_display_name": { "type": "string" },
        "message_preview": { "type": "string" },
        "deep_link_path": { "type": "string" },
        "proposal_id": { "type": "string", "format": "uuid" }
      },
      "required": ["chat_id", "service_request_id", "service_request_title", "proposal_id", "deep_link_path"],
      "additionalProperties": false
    }'::jsonb,
    true
  ),
  (
    'proposal.expired',
    'push',
    'Proposta expirada',
    'A proposta para {{service_request_title}} expirou sem resposta.',
    '{
      "type": "object",
      "properties": {
        "chat_id": { "type": "string", "format": "uuid" },
        "service_request_id": { "type": "string", "format": "uuid" },
        "service_request_title": { "type": "string" },
        "sender_display_name": { "type": "string" },
        "message_preview": { "type": "string" },
        "deep_link_path": { "type": "string" },
        "proposal_id": { "type": "string", "format": "uuid" }
      },
      "required": ["chat_id", "service_request_id", "service_request_title", "proposal_id", "deep_link_path"],
      "additionalProperties": false
    }'::jsonb,
    true
  ),
  (
    'proposal.expired',
    'email',
    'Proposta expirada — {{service_request_title}}',
    '<p>A proposta para <strong>{{service_request_title}}</strong> expirou sem resposta do cliente.</p><p><a href="{{deep_link_path}}">Ver conversa</a></p>',
    '{
      "type": "object",
      "properties": {
        "chat_id": { "type": "string", "format": "uuid" },
        "service_request_id": { "type": "string", "format": "uuid" },
        "service_request_title": { "type": "string" },
        "sender_display_name": { "type": "string" },
        "message_preview": { "type": "string" },
        "deep_link_path": { "type": "string" },
        "proposal_id": { "type": "string", "format": "uuid" }
      },
      "required": ["chat_id", "service_request_id", "service_request_title", "proposal_id", "deep_link_path"],
      "additionalProperties": false
    }'::jsonb,
    true
  ),
  (
    'proposal.expiring_soon',
    'push',
    'Proposta expira em breve',
    'Faltam poucas horas para responder à proposta de {{service_request_title}}.',
    '{
      "type": "object",
      "properties": {
        "chat_id": { "type": "string", "format": "uuid" },
        "service_request_id": { "type": "string", "format": "uuid" },
        "service_request_title": { "type": "string" },
        "sender_display_name": { "type": "string" },
        "message_preview": { "type": "string" },
        "deep_link_path": { "type": "string" },
        "proposal_id": { "type": "string", "format": "uuid" }
      },
      "required": ["chat_id", "service_request_id", "service_request_title", "proposal_id", "deep_link_path"],
      "additionalProperties": false
    }'::jsonb,
    true
  ),
  (
    'proposal.expiring_soon',
    'email',
    'Proposta expira em breve — {{service_request_title}}',
    '<p>Faltam poucas horas para responder à proposta de <strong>{{service_request_title}}</strong>.</p><p><a href="{{deep_link_path}}">Responder agora</a></p>',
    '{
      "type": "object",
      "properties": {
        "chat_id": { "type": "string", "format": "uuid" },
        "service_request_id": { "type": "string", "format": "uuid" },
        "service_request_title": { "type": "string" },
        "sender_display_name": { "type": "string" },
        "message_preview": { "type": "string" },
        "deep_link_path": { "type": "string" },
        "proposal_id": { "type": "string", "format": "uuid" }
      },
      "required": ["chat_id", "service_request_id", "service_request_title", "proposal_id", "deep_link_path"],
      "additionalProperties": false
    }'::jsonb,
    true
  ),
  (
    'chat.closed',
    'push',
    'Conversa encerrada',
    'A conversa sobre {{service_request_title}} foi encerrada.',
    '{
      "type": "object",
      "properties": {
        "chat_id": { "type": "string", "format": "uuid" },
        "service_request_id": { "type": "string", "format": "uuid" },
        "service_request_title": { "type": "string" },
        "sender_display_name": { "type": "string" },
        "message_preview": { "type": "string" },
        "deep_link_path": { "type": "string" }
      },
      "required": ["chat_id", "service_request_id", "service_request_title", "deep_link_path"],
      "additionalProperties": false
    }'::jsonb,
    true
  ),
  (
    'chat.closed',
    'email',
    'Conversa encerrada — {{service_request_title}}',
    '<p>A conversa sobre <strong>{{service_request_title}}</strong> foi encerrada.</p><p><a href="{{deep_link_path}}">Ver histórico</a></p>',
    '{
      "type": "object",
      "properties": {
        "chat_id": { "type": "string", "format": "uuid" },
        "service_request_id": { "type": "string", "format": "uuid" },
        "service_request_title": { "type": "string" },
        "sender_display_name": { "type": "string" },
        "message_preview": { "type": "string" },
        "deep_link_path": { "type": "string" }
      },
      "required": ["chat_id", "service_request_id", "service_request_title", "deep_link_path"],
      "additionalProperties": false
    }'::jsonb,
    true
  )
on conflict (template_key, channel) do update set
  subject_template = excluded.subject_template,
  body_template = excluded.body_template,
  variable_schema = excluded.variable_schema,
  active = excluded.active;

do $obs$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from message_dispatcher.message_templates mt
  where mt.template_key in (
    'chat.new_message',
    'chat.closed',
    'proposal.submitted',
    'proposal.revision_requested',
    'proposal.accepted',
    'proposal.rejected',
    'proposal.expired',
    'proposal.expiring_soon'
  );

  raise notice 'CNS MMD templates registered: % rows (chat.new_message, proposal.*, proposal.expiring_soon, chat.closed)',
    v_count;
end;
$obs$;
