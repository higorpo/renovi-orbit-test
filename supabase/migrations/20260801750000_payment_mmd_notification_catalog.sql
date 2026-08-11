-- Payment Task 109: MMD template catalog + mmd_ingest_event routing (design.md §1.7.9, Req 12/33).

-- Shared variable schema for payment lifecycle notifications.
-- deep_link_path example: /dashboard/services/{contracted_service_id}

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
    'payment.upcoming_charge',
    'push',
    'Cobrança em 24 horas — {{service_request_title}}',
    'Será cobrado amanhã o valor de {{charge_amount_formatted}} no cartão cadastrado. Confira os detalhes e atualize o cartão se necessário.',
    '{"type":"object","properties":{"schedule_id":{"type":"string"},"contracted_service_id":{"type":"string"},"service_request_title":{"type":"string"},"charge_scheduled_at":{"type":"string"},"charge_amount":{"type":"number"},"charge_amount_formatted":{"type":"string"},"paid_amount":{"type":"number"},"deep_link_path":{"type":"string"}},"required":["contracted_service_id","service_request_title","charge_amount_formatted"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'payment.upcoming_charge',
    'email',
    'Lembrete: cobrança em 24 horas — {{service_request_title}}',
    '<p>Seu cartão será cobrado em aproximadamente 24 horas pelo serviço <strong>{{service_request_title}}</strong>.</p><p>Valor da cobrança: <strong>{{charge_amount_formatted}}</strong></p><p><a href="{{deep_link_path}}">Ver detalhes do serviço</a></p>',
    '{"type":"object","properties":{"schedule_id":{"type":"string"},"contracted_service_id":{"type":"string"},"service_request_title":{"type":"string"},"charge_scheduled_at":{"type":"string"},"charge_amount":{"type":"number"},"charge_amount_formatted":{"type":"string"},"paid_amount":{"type":"number"},"deep_link_path":{"type":"string"}},"required":["contracted_service_id","service_request_title","charge_amount_formatted","deep_link_path"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'payment.charge_succeeded',
    'push',
    'Pagamento confirmado — {{service_request_title}}',
    'Pagamento aprovado, serviço agendado para {{service_execution_formatted}}.',
    '{"type":"object","properties":{"contracted_service_id":{"type":"string"},"service_request_title":{"type":"string"},"service_execution_formatted":{"type":"string"},"charge_amount_formatted":{"type":"string"},"paid_amount":{"type":"number"},"deep_link_path":{"type":"string"}},"required":["contracted_service_id","service_request_title","service_execution_formatted"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'payment.charge_succeeded',
    'email',
    'Pagamento confirmado — {{service_request_title}}',
    '<p>Seu pagamento de <strong>{{charge_amount_formatted}}</strong> foi aprovado para <strong>{{service_request_title}}</strong>.</p><p>O serviço está agendado para <strong>{{service_execution_formatted}}</strong>.</p><p><a href="{{deep_link_path}}">Ver serviço</a></p>',
    '{"type":"object","properties":{"contracted_service_id":{"type":"string"},"service_request_title":{"type":"string"},"service_execution_formatted":{"type":"string"},"charge_amount_formatted":{"type":"string"},"paid_amount":{"type":"number"},"deep_link_path":{"type":"string"}},"required":["contracted_service_id","service_request_title","service_execution_formatted","deep_link_path"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'payment.charge_succeeded_provider',
    'push',
    'Trabalho confirmado — {{service_request_title}}',
    'Pagamento confirmado, serviço agendado para {{service_execution_formatted}}.',
    '{"type":"object","properties":{"contracted_service_id":{"type":"string"},"service_request_title":{"type":"string"},"service_execution_formatted":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["contracted_service_id","service_request_title","service_execution_formatted"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'payment.charge_failed',
    'push',
    'Pagamento não processado — {{service_request_title}}',
    'Não foi possível processar o pagamento. Tentaremos novamente automaticamente.',
    '{"type":"object","properties":{"contracted_service_id":{"type":"string"},"service_request_title":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["contracted_service_id","service_request_title"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'payment.charge_failed',
    'email',
    'Pagamento não processado — {{service_request_title}}',
    '<p>Não foi possível processar o pagamento de <strong>{{service_request_title}}</strong>. Tentaremos novamente automaticamente.</p><p><a href="{{deep_link_path}}">Ver serviço</a></p>',
    '{"type":"object","properties":{"contracted_service_id":{"type":"string"},"service_request_title":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["contracted_service_id","service_request_title","deep_link_path"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'payment.charge_failed_permanent',
    'push',
    'Pagamento falhou — {{service_request_title}}',
    'O pagamento falhou definitivamente. Efetue o pagamento manualmente para evitar o cancelamento.',
    '{"type":"object","properties":{"contracted_service_id":{"type":"string"},"service_request_title":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["contracted_service_id","service_request_title"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'payment.charge_failed_permanent',
    'email',
    'Pagamento falhou — {{service_request_title}}',
    '<p>O pagamento de <strong>{{service_request_title}}</strong> falhou definitivamente. Efetue o pagamento manualmente para evitar o cancelamento do serviço.</p><p><a href="{{deep_link_path}}">Efetuar pagamento</a></p>',
    '{"type":"object","properties":{"contracted_service_id":{"type":"string"},"service_request_title":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["contracted_service_id","service_request_title","deep_link_path"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'payment.charge_failed_permanent_provider',
    'push',
    'Pagamento do cliente pendente — {{service_request_title}}',
    'O cliente ainda não confirmou o pagamento. Manteremos você informado. Se não for resolvido até 12 horas antes do serviço, cancelaremos o serviço automaticamente.',
    '{"type":"object","properties":{"contracted_service_id":{"type":"string"},"service_request_title":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["contracted_service_id","service_request_title"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'payment.charge_in_analysis',
    'push',
    'Pagamento em análise — {{service_request_title}}',
    'O pagamento está em análise antifraude. Você será notificado assim que houver uma atualização.',
    '{"type":"object","properties":{"contracted_service_id":{"type":"string"},"service_request_title":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["contracted_service_id","service_request_title"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'payment.service_auto_cancelled',
    'push',
    'Serviço cancelado — {{service_request_title}}',
    'Cancelamos o serviço automaticamente por falta de pagamento. Entre em contato com o suporte se precisar de ajuda.',
    '{"type":"object","properties":{"contracted_service_id":{"type":"string"},"service_request_title":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["contracted_service_id","service_request_title"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'payment.service_auto_cancelled',
    'email',
    'Serviço cancelado — {{service_request_title}}',
    '<p><strong>{{service_request_title}}</strong> foi cancelado automaticamente por falta de pagamento.</p><p>Entre em contato com o suporte se precisar de ajuda.</p><p><a href="{{deep_link_path}}">Ver detalhes</a></p>',
    '{"type":"object","properties":{"contracted_service_id":{"type":"string"},"service_request_title":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["contracted_service_id","service_request_title","deep_link_path"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'payment.service_auto_cancelled_provider',
    'push',
    'Serviço não confirmado — {{service_request_title}}',
    'Cancelamos o serviço porque o pagamento do cliente não foi concluído.',
    '{"type":"object","properties":{"contracted_service_id":{"type":"string"},"service_request_title":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["contracted_service_id","service_request_title"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'payment.service_auto_cancelled_suspended',
    'push',
    'Serviço cancelado — {{service_request_title}}',
    'Cancelamos o serviço porque o prestador foi suspenso. Entre em contato com o suporte se precisar de ajuda.',
    '{"type":"object","properties":{"contracted_service_id":{"type":"string"},"service_request_title":{"type":"string"},"cancellation_reason":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["contracted_service_id","service_request_title"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'payment.service_auto_cancelled_suspended',
    'email',
    'Serviço cancelado — {{service_request_title}}',
    '<p><strong>{{service_request_title}}</strong> foi cancelado porque o prestador foi suspenso.</p><p>Entre em contato com o suporte se precisar de ajuda.</p><p><a href="{{deep_link_path}}">Ver detalhes</a></p>',
    '{"type":"object","properties":{"contracted_service_id":{"type":"string"},"service_request_title":{"type":"string"},"cancellation_reason":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["contracted_service_id","service_request_title","deep_link_path"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'payment.service_auto_cancelled_suspended_provider',
    'push',
    'Serviço cancelado — {{service_request_title}}',
    'Cancelamos o serviço porque sua conta está suspensa e o pagamento do cliente não foi concluído.',
    '{"type":"object","properties":{"contracted_service_id":{"type":"string"},"service_request_title":{"type":"string"},"cancellation_reason":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["contracted_service_id","service_request_title"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'account.provider_kyc_submitted',
    'push',
    'Documentos enviados',
    'Seus documentos de credenciamento foram enviados. Aguarde a análise da plataforma.',
    '{"type":"object","properties":{"provider_id":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["provider_id"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'account.provider_kyc_submitted',
    'email',
    'Documentos de credenciamento enviados',
    '<p>Seus documentos de credenciamento foram enviados com sucesso.</p><p>Aguarde a análise da plataforma. Você será notificado quando houver uma atualização.</p><p><a href="{{deep_link_path}}">Acessar o app</a></p>',
    '{"type":"object","properties":{"provider_id":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["provider_id","deep_link_path"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'account.provider_kyc_under_review',
    'push',
    'Credenciamento em análise',
    'Seus documentos estão em análise. Você será notificado quando houver uma atualização.',
    '{"type":"object","properties":{"provider_id":{"type":"string"},"provider_gateway_account_id":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["provider_id"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'account.provider_kyc_under_review',
    'email',
    'Credenciamento em análise',
    '<p>Seus documentos de credenciamento estão em análise na plataforma de pagamentos.</p><p>Você será notificado quando houver uma atualização.</p><p><a href="{{deep_link_path}}">Acessar o app</a></p>',
    '{"type":"object","properties":{"provider_id":{"type":"string"},"provider_gateway_account_id":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["provider_id","deep_link_path"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'account.provider_kyc_rejected',
    'push',
    'Credenciamento não aprovado',
    'Seu credenciamento não foi aprovado. Revise os documentos e envie novamente.',
    '{"type":"object","properties":{"provider_id":{"type":"string"},"provider_gateway_account_id":{"type":"string"},"reason":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["provider_id"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'account.provider_kyc_rejected',
    'email',
    'Credenciamento não aprovado',
    '<p>Seu credenciamento de pagamentos não foi aprovado.</p><p>Revise os documentos e envie novamente pelo app.</p><p><a href="{{deep_link_path}}">Corrigir e reenviar</a></p>',
    '{"type":"object","properties":{"provider_id":{"type":"string"},"provider_gateway_account_id":{"type":"string"},"reason":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["provider_id","deep_link_path"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'payment.transaction_dispute',
    'push',
    'Disputa em análise — {{service_request_title}}',
    'Há uma disputa de pagamento em análise. A plataforma entrará em contato se necessário.',
    '{"type":"object","properties":{"contracted_service_id":{"type":"string"},"schedule_id":{"type":"string"},"service_request_title":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["contracted_service_id","service_request_title"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'service.service_executed',
    'push',
    'Confirme o recebimento — {{service_request_title}}',
    'O prestador marcou o serviço como executado. Confirme se recebeu o serviço.',
    '{"type":"object","properties":{"service_id":{"type":"string"},"provider_id":{"type":"string"},"service_request_title":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["service_id","service_request_title"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'service.service_completed',
    'push',
    'Serviço concluído — {{service_request_title}}',
    'O cliente confirmou a conclusão do serviço.',
    '{"type":"object","properties":{"service_id":{"type":"string"},"client_id":{"type":"string"},"completed_by":{"type":"string"},"service_request_title":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["service_id","service_request_title"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'payment.provider_suspended_client',
    'push',
    'Pagamento em espera — {{service_request_title}}',
    'O pagamento está em espera. Você pode cancelar o serviço sem penalidade enquanto resolvemos a situação com o prestador.',
    '{"type":"object","properties":{"contracted_service_id":{"type":"string"},"schedule_id":{"type":"string"},"service_request_title":{"type":"string"},"provider_id":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["contracted_service_id","service_request_title"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'payment.provider_suspended_client',
    'email',
    'Pagamento em espera — {{service_request_title}}',
    '<p>O pagamento de <strong>{{service_request_title}}</strong> está em espera enquanto analisamos a situação do prestador.</p><p>Você pode cancelar o serviço sem penalidade.</p><p><a href="{{deep_link_path}}">Ver serviço</a></p>',
    '{"type":"object","properties":{"contracted_service_id":{"type":"string"},"schedule_id":{"type":"string"},"service_request_title":{"type":"string"},"provider_id":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["contracted_service_id","service_request_title","deep_link_path"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'account.provider_suspended',
    'push',
    'Conta suspensa',
    'Sua conta de prestador foi suspensa. Entre em contato com o suporte para mais informações.',
    '{"type":"object","properties":{"provider_id":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["provider_id"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'account.provider_suspended',
    'email',
    'Conta de prestador suspensa',
    '<p>Sua conta de prestador foi suspensa. Entre em contato com o suporte para mais informações.</p>',
    '{"type":"object","properties":{"provider_id":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["provider_id"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'account.provider_onboarding_incomplete_reminder',
    'push',
    'Complete seu credenciamento',
    'Falta pouco para liberar oportunidades e receber pagamentos. Finalize o credenciamento no app.',
    '{"type":"object","properties":{"provider_id":{"type":"string"},"provider_gateway_account_id":{"type":"string"},"onboarding_status":{"type":"string"},"reminder_count":{"type":"integer"},"deep_link_path":{"type":"string"}},"required":["provider_id","deep_link_path"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'account.provider_onboarding_incomplete_reminder',
    'email',
    'Complete seu credenciamento na Prestway',
    '<p>Você ainda não concluiu o credenciamento de pagamentos.</p><p>Finalize o envio dos documentos para liberar oportunidades e receber pelos serviços.</p><p><a href="{{deep_link_path}}">Completar credenciamento</a></p>',
    '{"type":"object","properties":{"provider_id":{"type":"string"},"provider_gateway_account_id":{"type":"string"},"onboarding_status":{"type":"string"},"reminder_count":{"type":"integer"},"deep_link_path":{"type":"string"}},"required":["provider_id","deep_link_path"],"additionalProperties":true}'::jsonb,
    true
  )
on conflict (template_key, channel) do update set
  subject_template = excluded.subject_template,
  body_template = excluded.body_template,
  variable_schema = excluded.variable_schema,
  active = excluded.active;

create or replace function public.mmd_ingest_event(
  p_event_type text,
  p_recipient_profile_id uuid,
  p_idempotency_key text,
  p_template_variables jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_template_key text;
  v_channels message_dispatcher.message_channel[];
  v_push_bypass_limits boolean;
  v_email_bypass_limits boolean;
  v_channel_bypass_limits boolean;
  v_channel message_dispatcher.message_channel;
  v_channel_suffix text;
  v_channel_idempotency text;
  v_ingest_key uuid;
  v_variables jsonb;
  v_dispatch jsonb;
  v_dispatches jsonb := '[]'::jsonb;
  v_skipped_count int := 0;
  v_ingested_count int := 0;
  v_audience text := lower(coalesce(p_metadata->>'recipient', 'client'));
  v_cancellation_reason text := upper(btrim(coalesce(p_metadata->>'cancellation_reason', '')));
begin
  if nullif(btrim(p_event_type), '') is null then
    raise exception 'p_event_type is required'
      using errcode = '22023';
  end if;

  if p_recipient_profile_id is null then
    raise exception 'p_recipient_profile_id is required'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'p_idempotency_key is required'
      using errcode = '22023';
  end if;

  if p_template_variables is null then
    raise exception 'p_template_variables must not be null'
      using errcode = '22023';
  end if;

  case upper(btrim(p_event_type))
    when 'CHAT_MESSAGE_SENT' then
      v_template_key := 'chat.new_message';
      v_channels := array['push']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'PROPOSAL_SUBMITTED' then
      v_template_key := 'proposal.submitted';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'PROPOSAL_REVISION_REQUESTED' then
      v_template_key := 'proposal.revision_requested';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'PROPOSAL_ACCEPTED' then
      v_template_key := 'proposal.accepted';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'PROPOSAL_REJECTED' then
      v_template_key := 'proposal.rejected';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'PROPOSAL_EXPIRED' then
      v_template_key := 'proposal.expired';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'PROPOSAL_EXPIRING_SOON' then
      v_template_key := 'proposal.expiring_soon';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'CONVERSATION_CLOSED' then
      v_template_key := 'chat.closed';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := false;
      v_email_bypass_limits := false;
    when 'UPCOMING_CHARGE' then
      v_template_key := 'payment.upcoming_charge';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'CHARGE_SUCCEEDED' then
      if v_audience = 'provider' then
        v_template_key := 'payment.charge_succeeded_provider';
        v_channels := array['push']::message_dispatcher.message_channel[];
        v_push_bypass_limits := true;
        v_email_bypass_limits := false;
      else
        v_template_key := 'payment.charge_succeeded';
        v_channels := array['push', 'email']::message_dispatcher.message_channel[];
        v_push_bypass_limits := true;
        v_email_bypass_limits := true;
      end if;
    when 'CHARGE_FAILED' then
      v_template_key := 'payment.charge_failed';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := false;
      v_email_bypass_limits := false;
    when 'CHARGE_FAILED_PERMANENT' then
      if v_audience = 'provider' then
        v_template_key := 'payment.charge_failed_permanent_provider';
        v_channels := array['push']::message_dispatcher.message_channel[];
        v_push_bypass_limits := true;
        v_email_bypass_limits := false;
      else
        v_template_key := 'payment.charge_failed_permanent';
        v_channels := array['push', 'email']::message_dispatcher.message_channel[];
        v_push_bypass_limits := true;
        v_email_bypass_limits := true;
      end if;
    when 'CHARGE_IN_ANALYSIS' then
      v_template_key := 'payment.charge_in_analysis';
      v_channels := array['push']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'SERVICE_AUTO_CANCELLED' then
      if v_cancellation_reason = 'PROVIDER_SUSPENDED' then
        if v_audience = 'provider' then
          v_template_key := 'payment.service_auto_cancelled_suspended_provider';
          v_channels := array['push']::message_dispatcher.message_channel[];
          v_push_bypass_limits := true;
          v_email_bypass_limits := false;
        else
          v_template_key := 'payment.service_auto_cancelled_suspended';
          v_channels := array['push', 'email']::message_dispatcher.message_channel[];
          v_push_bypass_limits := true;
          v_email_bypass_limits := true;
        end if;
      elsif v_audience = 'provider' then
        v_template_key := 'payment.service_auto_cancelled_provider';
        v_channels := array['push']::message_dispatcher.message_channel[];
        v_push_bypass_limits := true;
        v_email_bypass_limits := false;
      else
        v_template_key := 'payment.service_auto_cancelled';
        v_channels := array['push', 'email']::message_dispatcher.message_channel[];
        v_push_bypass_limits := true;
        v_email_bypass_limits := true;
      end if;
    when 'PROVIDER_KYC_SUBMITTED' then
      v_template_key := 'account.provider_kyc_submitted';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := false;
      v_email_bypass_limits := false;
    when 'PROVIDER_ONBOARDING_UNDER_REVIEW' then
      v_template_key := 'account.provider_kyc_under_review';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'PROVIDER_KYC_REJECTED' then
      v_template_key := 'account.provider_kyc_rejected';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'TRANSACTION_DISPUTE' then
      v_template_key := 'payment.transaction_dispute';
      v_channels := array['push']::message_dispatcher.message_channel[];
      v_push_bypass_limits := false;
      v_email_bypass_limits := false;
    when 'SERVICE_EXECUTED' then
      v_template_key := 'service.service_executed';
      v_channels := array['push']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'SERVICE_COMPLETED' then
      v_template_key := 'service.service_completed';
      v_channels := array['push']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'PROVIDER_SUSPENDED' then
      if v_audience = 'provider' then
        v_template_key := 'account.provider_suspended';
        v_channels := array['push', 'email']::message_dispatcher.message_channel[];
        v_push_bypass_limits := true;
        v_email_bypass_limits := false;
      else
        v_template_key := 'payment.provider_suspended_client';
        v_channels := array['push', 'email']::message_dispatcher.message_channel[];
        v_push_bypass_limits := true;
        v_email_bypass_limits := false;
      end if;
    else
      raise log 'NOTIFICATION_SKIPPED event_type=% recipient=% reason=unsupported_event_type',
        p_event_type,
        p_recipient_profile_id;

      return jsonb_build_object(
        'event_type', p_event_type,
        'skipped', true,
        'reason', 'unsupported_event_type',
        'dispatches', '[]'::jsonb
      );
  end case;

  v_variables := p_template_variables;

  foreach v_channel in array v_channels loop
    v_channel_suffix := ':' || v_channel::text;

    if right(p_idempotency_key, char_length(v_channel_suffix)) = v_channel_suffix then
      v_channel_idempotency := p_idempotency_key;
    else
      v_channel_idempotency := p_idempotency_key || v_channel_suffix;
    end if;

    v_ingest_key := public.mmd_idempotency_uuid(v_channel_idempotency);

    v_channel_bypass_limits := case v_channel
      when 'push'::message_dispatcher.message_channel then v_push_bypass_limits
      when 'email'::message_dispatcher.message_channel then v_email_bypass_limits
      else false
    end;

    begin
      v_dispatch := message_dispatcher.message_dispatcher_ingest(
        v_ingest_key,
        p_recipient_profile_id,
        v_channel,
        v_template_key,
        v_variables,
        now(),
        'cns',
        coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
          'event_type', upper(btrim(p_event_type)),
          'idempotency_key', v_channel_idempotency
        ),
        v_channel_bypass_limits
      );

      v_ingested_count := v_ingested_count + 1;
      v_dispatches := v_dispatches || jsonb_build_array(
        v_dispatch || jsonb_build_object(
          'channel', v_channel,
          'bypass_limits', v_channel_bypass_limits
        )
      );
    exception
      when others then
        v_skipped_count := v_skipped_count + 1;
        raise log 'NOTIFICATION_SKIPPED event_type=% channel=% recipient=% idempotency_key=% sqlstate=% message=%',
          p_event_type,
          v_channel,
          p_recipient_profile_id,
          v_channel_idempotency,
          sqlstate,
          sqlerrm;

        v_dispatches := v_dispatches || jsonb_build_array(
          jsonb_build_object(
            'skipped', true,
            'channel', v_channel,
            'reason', sqlerrm
          )
        );
    end;
  end loop;

  raise log 'mmd_ingest_event_duration_ms=% event_type=% ingested=% skipped=%',
    round(extract(epoch from (clock_timestamp() - v_started_at)) * 1000)::bigint,
    p_event_type,
    v_ingested_count,
    v_skipped_count;

  return jsonb_build_object(
    'event_type', upper(btrim(p_event_type)),
    'template_key', v_template_key,
    'bypass_limits', jsonb_build_object(
      'push', v_push_bypass_limits,
      'email', v_email_bypass_limits
    ),
    'ingested_count', v_ingested_count,
    'skipped_count', v_skipped_count,
    'dispatches', v_dispatches
  );
end;
$$;

comment on function public.mmd_ingest_event(text, uuid, text, jsonb, jsonb) is
  'Platform → MMD bridge: CNS + payment lifecycle events (design.md §1.7.9).';
