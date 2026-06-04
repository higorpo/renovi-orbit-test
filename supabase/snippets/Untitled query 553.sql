INSERT INTO "public"."service_requests" ("id", "client_id", "service_id", "address_id", "title", "description", "photos", "form_data", "form_schema", "form_version", "urgency", "scope_complexity", "tags", "missing_info_warnings", "suggested_equipment", "suggested_materials", "estimated_duration_hint", "location",  "created_at", "updated_at", "completed_at", "cancelled_at", "contracted_service_id", "status") VALUES ('7017e457-5a32-44e7-b8da-1727a14f4d34', '28e30f1d-3c47-441f-94c6-76b6ea0db470', 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a62', 'acd13138-0d54-431f-a672-55903f31301e', 'Instalação elétrica no quarto', 'Preciso instalar 5 pontos de tomada novos na sala e cozinha. A casa é antiga e não tem aterramento.', null, '{"urgency": "medium", "descricao": "Preciso instalar 5 pontos de tomada novos na sala e cozinha. A casa é antiga e não tem aterramento.", "qtd_pontos": 5, "aterramento": true, "tipo_imovel": "residencial", "tipo_servico": "nova"}', null, '2.0', 'medium', null, null, null, null, null, null, null, '2026-06-02 13:52:39.312783+00', '2026-06-02 13:52:39.312783+00', null, null, null, 'OPEN');

-- Impersona o prestador do seed
select set_config('request.jwt.claim.sub', '5d09e025-20a2-4842-aeef-324d42a431e1', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"5d09e025-20a2-4842-aeef-324d42a431e1"}',
  true
);

-- Cria ou retorna a conversa (idempotency_key pode ser qualquer UUID)
select public.cns_initiate_conversation(
  '7017e457-5a32-44e7-b8da-1727a14f4d34'::uuid,
  gen_random_uuid()
);






update public.provider_proposals
set
  status = 'REJECTED'::public.proposal_status,
  updated_at = now()
where status = 'REVISED'::public.proposal_status
  and revision_reason is null
  and nullif(trim(client_rejection_response), '') is not null;


UPDATE public.chats
SET
  status = 'INACTIVE'::public.cns_conversation_status,
  inactivated_at = now(),
  inactivation_reason = 'NO_RECIPROCITY'::public.cns_inactivation_reason,
  updated_at = now()
WHERE id = '108b098f-9faa-42f4-8743-fbd665fd8fe5'
  AND status = 'ACTIVE'::public.cns_conversation_status;

UPDATE public.chats
SET
  status = 'ACTIVE'::public.cns_conversation_status,
  closed_at = NULL,
  closure_type = NULL,
  closed_by_user_id = NULL,
  closure_reason = NULL,
  inactivated_at = NULL,
  inactivation_reason = NULL,
  activated_at = COALESCE(activated_at, now()),
  last_interaction_at = now(),
  updated_at = now()
WHERE id = '108b098f-9faa-42f4-8743-fbd665fd8fe5'
  AND status = 'CLOSED'::public.cns_conversation_status;



  UPDATE public.provider_proposals
SET
  status = 'EXPIRED'::public.proposal_status,
  expired_at = now(),
  updated_at = now()
WHERE id = '3b39d023-bc8c-4935-81b7-9dd7dfa53f62'
  AND status = 'PENDING'::public.proposal_status
RETURNING id, status, expired_at;