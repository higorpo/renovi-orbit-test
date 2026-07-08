-- pgTAP: WORKFLOW_ACTION payload projection for list_chat_messages.

begin;

select plan(2);

select is(
  public.cns_project_message_payload_for_list(
    'WORKFLOW_ACTION'::public.cns_message_type,
    jsonb_build_object(
      'text', 'Nova data proposta: 15/08/2026 (manhã)',
      'action_key', 'service_reschedule_proposed',
      'slot', jsonb_build_object(
        'start_date', '2026-08-15',
        'end_date', null,
        'shift', 'morning'
      ),
      'extra_field', 'should be omitted'
    )
  ),
  jsonb_build_object(
    'text', 'Nova data proposta: 15/08/2026 (manhã)',
    'action_key', 'service_reschedule_proposed',
    'slot', jsonb_build_object(
      'start_date', '2026-08-15',
      'shift', 'morning'
    )
  ),
  'WORKFLOW_ACTION list projection keeps action_key and slot'
);

select is(
  public.cns_project_message_payload_for_list(
    'WORKFLOW_ACTION'::public.cns_message_type,
    jsonb_build_object(
      'text', 'Ação pendente',
      'action_key', '',
      'slot', null
    )
  ),
  jsonb_build_object(
    'text', 'Ação pendente'
  ),
  'WORKFLOW_ACTION list projection omits empty action_key and null slot'
);

select * from finish();

rollback;
