-- pgTAP: sensitive RPCs EXECUTE limited to service_role (design §11.1, task 96).

begin;

select plan(4);

select ok(
  has_function_privilege('service_role', 'message_dispatcher.message_dispatcher_ingest(uuid,uuid,message_dispatcher.message_channel,text,jsonb,timestamptz,text,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'message_dispatcher.message_dispatcher_ingest(uuid,uuid,message_dispatcher.message_channel,text,jsonb,timestamptz,text,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'message_dispatcher.message_dispatcher_ingest(uuid,uuid,message_dispatcher.message_channel,text,jsonb,timestamptz,text,jsonb)', 'EXECUTE'),
  'ingest: service_role only'
);

select ok(
  has_function_privilege('service_role', 'message_dispatcher.message_dispatcher_checkout_batch(integer,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'message_dispatcher.message_dispatcher_checkout_batch(integer,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'message_dispatcher.message_dispatcher_checkout_batch(integer,text)', 'EXECUTE'),
  'checkout_batch: service_role only'
);

select ok(
  has_function_privilege('service_role', 'message_dispatcher.message_dispatcher_report_delivery_outcome(uuid,text,message_dispatcher.message_channel,boolean,text,integer,text,text,jsonb,boolean)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'message_dispatcher.message_dispatcher_report_delivery_outcome(uuid,text,message_dispatcher.message_channel,boolean,text,integer,text,text,jsonb,boolean)', 'EXECUTE')
  and not has_function_privilege('anon', 'message_dispatcher.message_dispatcher_report_delivery_outcome(uuid,text,message_dispatcher.message_channel,boolean,text,integer,text,text,jsonb,boolean)', 'EXECUTE'),
  'report_delivery_outcome: service_role only'
);

select ok(
  has_function_privilege('service_role', 'message_dispatcher.message_dispatcher_reconcile_vendor_event(text,text,text,text,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'message_dispatcher.message_dispatcher_reconcile_vendor_event(text,text,text,text,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'message_dispatcher.message_dispatcher_reconcile_vendor_event(text,text,text,text,jsonb)', 'EXECUTE'),
  'reconcile_vendor_event: service_role only'
);

select finish();

rollback;
