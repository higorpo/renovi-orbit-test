-- Send one PUSH
select message_dispatcher.message_dispatcher_ingest(
  gen_random_uuid(),  -- idempotency_key (nova a cada teste)
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'push'::message_dispatcher.message_channel,
  'engagement_push',
  jsonb_build_object(
    'name', 'X',
    'headline', 'Teste Orbit',
    'body', 'MMD push local'
  ),
  now(),              -- scheduled_for (agora → tende a QUEUED)
  'orbit',
  '{}'::jsonb,
  true
) as ingest_result;


-- Send one PUSH
select message_dispatcher.message_dispatcher_ingest(
  gen_random_uuid(),  -- idempotency_key (nova a cada teste)
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  'push'::message_dispatcher.message_channel,
  'engagement_push',
  jsonb_build_object(
    'name', 'X',
    'headline', 'Teste Orbit',
    'body', 'MMD push local'
  ),
  now(),              -- scheduled_for (agora → tende a QUEUED)
  'orbit',
  '{}'::jsonb,
  true
) as ingest_result;


-- Send one email
select message_dispatcher.message_dispatcher_ingest(
  gen_random_uuid(),
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  jsonb_build_object(
    'name', 'oisd',
    'coupon', 'ORBIT10'
  ),
  now(),
  'orbit',
  '{}'::jsonb
) as ingest_result;

-- Schedule send one PUSH
select message_dispatcher.message_dispatcher_ingest(
  gen_random_uuid(),  -- idempotency_key (nova a cada teste)
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'push'::message_dispatcher.message_channel,
  'engagement_push',
  jsonb_build_object(
    'name', 'Higor',
    'headline', 'Mensagem agendada',
    'body', 'MMD push local'
  ),
  '2026-05-24 14:20:00',              -- scheduled_for (agora → tende a QUEUED)
  'orbit',
  '{}'::jsonb
) as ingest_result;

-- Send multiple pushs
DO $$
BEGIN
  FOR i IN 1..5 LOOP
    PERFORM message_dispatcher.message_dispatcher_ingest(
      gen_random_uuid(), -- idempotency_key
      '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
      'push'::message_dispatcher.message_channel,
      'engagement_push',
      jsonb_build_object(
        'name', 'Higor',
        'headline', format('Push #%s', i),
        'body', format('Mensagem de teste número %s', i)
      ),
      now(),
      'orbit',
      '{}'::jsonb
    );
  END LOOP;
END $$;

-- Check status
select id, status, scheduled_for, failure_code, metadata, bypass_limits
from message_dispatcher.message_dispatches
where profile_id = '5d09e025-20a2-4842-aeef-324d42a431e1'
order by created_at desc;

-- Check status (email)
select id, status, failure_code, vendor_message_id, updated_at
from message_dispatcher.message_dispatches
where profile_id = '93d14fb7-b054-4bd1-83fc-9269c3abe697'
  and channel = 'email'
order by created_at desc
limit 3;


select message_dispatcher.message_dispatcher_activate_scheduled() as ativados;

select message_dispatcher.message_dispatcher_invoke_worker();