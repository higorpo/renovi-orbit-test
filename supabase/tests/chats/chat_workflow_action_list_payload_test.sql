-- pgTAP: WORKFLOW_ACTION payload projection for list_chat_messages.

begin;

select plan(5);

select is(
  public.cns_project_message_payload_for_list(
    'WORKFLOW_ACTION'::public.cns_message_type,
    jsonb_build_object(
      'text', 'Nova data proposta: 15/08/2026 (manhã)',
      'action_key', 'service_reschedule_proposed',
      'slot', jsonb_build_object(
        'start_date', '2026-08-15',
        'end_date', null,
        'shift', 'morning',
        'timezone', 'America/Sao_Paulo'
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

select is(
  public.cns_project_message_payload_for_list(
    'WORKFLOW_ACTION'::public.cns_message_type,
    jsonb_build_object(
      'text', 'Ação pendente',
      'action_key', 'service_reschedule_proposed',
      'slot', jsonb_build_array('not', 'an', 'object')
    )
  ),
  jsonb_build_object(
    'text', 'Ação pendente',
    'action_key', 'service_reschedule_proposed'
  ),
  'WORKFLOW_ACTION list projection omits non-object slot'
);

select is(
  public.cns_project_message_payload_for_list(
    'WORKFLOW_ACTION'::public.cns_message_type,
    jsonb_build_object(
      'text', repeat('x', 1100),
      'action_key', '  service_reschedule_proposed  ',
      'slot', jsonb_build_object(
        'start_date', '2026-08-15',
        'end_date', '2026-08-16',
        'shift', 'full_day',
        'ignored', 'value'
      )
    )
  ),
  jsonb_build_object(
    'text', repeat('x', 1000),
    'action_key', 'service_reschedule_proposed',
    'slot', jsonb_build_object(
      'start_date', '2026-08-15',
      'end_date', '2026-08-16',
      'shift', 'full_day'
    )
  ),
  'WORKFLOW_ACTION list projection trims action_key, truncates text, and allowlists slot fields'
);

select is(
  public.cns_project_message_payload_for_list(
    'WORKFLOW_ACTION'::public.cns_message_type,
    jsonb_build_object(
      'text', 'Sem slot',
      'action_key', 'service_reschedule_proposed',
      'slot', jsonb_build_object(
        'timezone', 'America/Sao_Paulo'
      )
    )
  ),
  jsonb_build_object(
    'text', 'Sem slot',
    'action_key', 'service_reschedule_proposed',
    'slot', jsonb_build_object()
  ),
  'WORKFLOW_ACTION list projection keeps empty object when slot object has no allowed fields'
);

select * from finish();

rollback;
