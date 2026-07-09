-- Remove incorrect card-fee disclaimer from cancellation SYSTEM chat messages.

create or replace function public.cns_build_contracted_service_cancel_system_message(
  p_initiator text,
  p_refund_tier text default null,
  p_pre_charge boolean default false,
  p_cancellation_reason text default null
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_reason text := upper(coalesce(nullif(btrim(p_cancellation_reason), ''), ''));
begin
  if p_initiator not in ('client', 'provider', 'system') then
    raise exception 'INVALID_INITIATOR'
      using errcode = '22023';
  end if;

  if p_initiator = 'system' then
    return case v_reason
      when 'PROVIDER_SUSPENDED' then
        'O serviço foi cancelado automaticamente porque o prestador está temporariamente indisponível.'
      when 'NON_PAYMENT' then
        'O serviço foi cancelado automaticamente por falta de pagamento.'
      else
        'O serviço foi cancelado automaticamente.'
    end;
  end if;

  if p_pre_charge then
    return case p_initiator
      when 'provider' then
        'O serviço foi cancelado pelo prestador. A cobrança ainda não havia sido realizada.'
      else
        'O serviço foi cancelado pelo cliente. A cobrança ainda não havia sido realizada.'
    end;
  end if;

  if p_initiator = 'provider' then
    return
      'O serviço foi cancelado pelo prestador. O valor pago será estornado integralmente '
      || '(o processamento pode levar de 30 a 60 dias).';
  end if;

  return case coalesce(p_refund_tier, '')
    when 'FULL_REFUND' then
      'O serviço foi cancelado pelo cliente. O valor pago será reembolsado integralmente '
      || '(incluindo taxas de cartão).'
    when 'PENALTY_10' then
      'O serviço foi cancelado pelo cliente. Será reembolsado 90% do valor do serviço '
      || 'por cancelamento com menos de 48 h de antecedência (taxas de cartão não são reembolsadas).'
    when 'PENALTY_30' then
      'O serviço foi cancelado pelo cliente. Será reembolsado 70% do valor do serviço '
      || 'por cancelamento de última hora (taxas de cartão não são reembolsadas).'
    else
      'O serviço foi cancelado pelo cliente. O estorno seguirá as regras dos Termos de Uso.'
  end;
end;
$$;

comment on function public.cns_build_contracted_service_cancel_system_message(text, text, boolean, text) is
  'PT-BR system chat copy for contracted service cancellation (shared by client and provider views).';
