-- Service completion Task 25: resolve_completion_checklist_template cascade
-- (design §4.8 / decision 19): platform_service → category → global.

create or replace function public.resolve_completion_checklist_template(
  p_platform_service_id uuid,
  p_category_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_category_id uuid := p_category_id;
  v_tpl public.completion_checklist_templates%rowtype;
  v_scope text;
begin
  -- Worker/Edge only (generate-completion-checklist). Not product-authenticated.
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for resolve_completion_checklist_template'
      using errcode = '42501';
  end if;

  -- Derive category from platform_services.parent_id when not provided.
  if v_category_id is null and p_platform_service_id is not null then
    select ps.parent_id
    into v_category_id
    from public.platform_services ps
    where ps.id = p_platform_service_id;
  end if;

  -- 1) platform_service scope
  if p_platform_service_id is not null then
    select *
    into v_tpl
    from public.completion_checklist_templates t
    where t.is_active
      and t.platform_service_id = p_platform_service_id
    limit 1;

    if found then
      v_scope := 'service';
    end if;
  end if;

  -- 2) category scope (parent platform_services node)
  if v_tpl.id is null and v_category_id is not null then
    select *
    into v_tpl
    from public.completion_checklist_templates t
    where t.is_active
      and t.category_id = v_category_id
    limit 1;

    if found then
      v_scope := 'category';
    end if;
  end if;

  -- 3) global scope
  if v_tpl.id is null then
    select *
    into v_tpl
    from public.completion_checklist_templates t
    where t.is_active
      and t.is_global
    limit 1;

    if found then
      v_scope := 'global';
    end if;
  end if;

  if v_tpl.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'template_id', v_tpl.id,
    'scope', v_scope,
    'schema_version', v_tpl.schema_version,
    'checklist_schema', v_tpl.checklist_schema,
    'platform_service_id', v_tpl.platform_service_id,
    'category_id', v_tpl.category_id,
    'is_global', v_tpl.is_global
  );
end;
$$;

comment on function public.resolve_completion_checklist_template(uuid, uuid) is
  'Resolve active checklist template cascade: platform_service → category (parent platform_services) → global. Returns null if none. Does not mutate templates.';

revoke all on function public.resolve_completion_checklist_template(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_completion_checklist_template(uuid, uuid)
  to service_role;
grant execute on function public.resolve_completion_checklist_template(uuid, uuid)
  to postgres;
