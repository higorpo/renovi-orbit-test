-- pgTAP: compute_next_retry_at backoff (design §4.6, task 36).

begin;

select plan(2);

select ok(
  extract(epoch from (
    message_dispatcher.message_dispatcher_compute_next_retry_at(0) - now()
  )) between 59 and 61,
  'retry_count 0 → +60s'
);

select ok(
  extract(epoch from (
    message_dispatcher.message_dispatcher_compute_next_retry_at(2) - now()
  )) between 239 and 241,
  'retry_count 2 → +240s (power(2,2)*60)'
);

select finish();

rollback;
