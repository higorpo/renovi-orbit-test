create or replace function public.reject_client_budget_proposal(
  p_proposal_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_sr_id uuid;
  v_status text;
  v_deadline timestamptz;
begin
  v_client_id := (select auth.uid());
  if v_client_id is null then
    raise exception 'Autenticação necessária' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_client_id and p.role = 'client') then
    raise exception 'Apenas clientes podem recusar orçamentos' using errcode = '42501';
  end if;
  if p_proposal_id is null then
    raise exception 'Orçamento é obrigatório';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'Motivo da recusa é obrigatório';
  end if;
  if char_length(trim(p_reason)) > 2000 then
    raise exception 'Motivo deve ter no máximo 2000 caracteres';
  end if;

  select pp.service_request_id, pp.status, pp.client_response_deadline_at
  into v_sr_id, v_status, v_deadline
  from public.provider_proposals pp
  join public.service_requests sr on sr.id = pp.service_request_id
  where pp.id = p_proposal_id
    and sr.client_id = v_client_id
    and sr.status in ('open', 'in_progress');

  if v_sr_id is null then
    raise exception 'Orçamento não encontrado para este pedido' using errcode = '42501';
  end if;

  if v_status <> 'submitted' then
    raise exception 'Apenas orçamentos aguardando avaliação podem ser recusados';
  end if;

  if v_deadline is not null and v_deadline < now() then
    raise exception 'Prazo para responder este orçamento expirou';
  end if;

  update public.provider_proposals pp
  set
    status = 'rejected',
    client_rejection_response = trim(p_reason),
    updated_at = now()
  where pp.id = p_proposal_id;

  return jsonb_build_object(
    'proposal_id', p_proposal_id,
    'service_request_id', v_sr_id,
    'status', 'rejected'
  );
end;
$$;

comment on function public.reject_client_budget_proposal(uuid, text) is 'Client rejects a submitted provider proposal with a required reason message for the provider.';

revoke all on function public.reject_client_budget_proposal(uuid, text) from public;
revoke all on function public.reject_client_budget_proposal(uuid, text) from anon;
grant execute on function public.reject_client_budget_proposal(uuid, text) to authenticated;
