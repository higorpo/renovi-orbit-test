-- Service completion Task 19: enrichment_validate_checklist_schema (design §5.3.2 / §5.8).

create or replace function public.enrichment_validate_checklist_schema(
  p_schema jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_min int;
  v_max int;
  v_ev_min_default int;
  v_ev_max_default int;
  v_blocks jsonb;
  v_block jsonb;
  v_type text;
  v_label text;
  v_id text;
  v_criterion_count int := 0;
  v_config jsonb;
  v_requires boolean;
  v_ev_min int;
  v_ev_max int;
  v_content text;
begin
  begin
    if p_schema is null or jsonb_typeof(p_schema) <> 'object' then
      return false;
    end if;

    -- Top-level evidence_images not allowed in completion schemas (ADR-0003).
    if p_schema ? 'evidence_images' then
      return false;
    end if;

    v_blocks := p_schema -> 'blocks';
    if v_blocks is null or jsonb_typeof(v_blocks) <> 'array' then
      return false;
    end if;

    v_min := public.platform_constant_int('checklist_criterion_min', 3);
    v_max := public.platform_constant_int('checklist_criterion_max', 12);
    v_ev_min_default := public.platform_constant_int('checklist_evidence_min', 1);
    v_ev_max_default := public.platform_constant_int('checklist_evidence_max', 5);

    for v_block in
      select value
      from jsonb_array_elements(v_blocks)
    loop
      if jsonb_typeof(v_block) <> 'object' then
        return false;
      end if;

      v_type := nullif(btrim(v_block ->> 'type'), '');
      if v_type is null then
        return false;
      end if;

      if v_type not in ('completion_criterion', 'static_text') then
        return false;
      end if;

      if v_type = 'static_text' then
        v_content := nullif(btrim(v_block ->> 'content'), '');
        if v_content is null then
          return false;
        end if;
        continue;
      end if;

      -- completion_criterion: id, label, required structure + evidence config
      v_id := nullif(btrim(v_block ->> 'id'), '');
      v_label := nullif(btrim(v_block ->> 'label'), '');
      if v_id is null or v_label is null then
        return false;
      end if;

      v_config := v_block -> 'config';
      if v_config is null or jsonb_typeof(v_config) <> 'object' then
        return false;
      end if;

      if not (v_config ? 'requires_evidence_when_met') then
        return false;
      end if;

      begin
        v_requires := (v_config ->> 'requires_evidence_when_met')::boolean;
      exception
        when others then
          return false;
      end;

      -- evidence bounds optional; when present must be valid ints within platform defaults range
      if v_config ? 'evidence_min' then
        begin
          v_ev_min := (v_config ->> 'evidence_min')::int;
        exception
          when others then
            return false;
        end;
        if v_ev_min < 1 then
          return false;
        end if;
      else
        v_ev_min := v_ev_min_default;
      end if;

      if v_config ? 'evidence_max' then
        begin
          v_ev_max := (v_config ->> 'evidence_max')::int;
        exception
          when others then
            return false;
        end;
        if v_ev_max < v_ev_min then
          return false;
        end if;
      else
        v_ev_max := v_ev_max_default;
      end if;

      if v_ev_max > v_ev_max_default then
        return false;
      end if;

      -- Block type itself defines met + justification slots (ADR-0003); no extra keys required.
      v_criterion_count := v_criterion_count + 1;
    end loop;

    if v_criterion_count < v_min or v_criterion_count > v_max then
      return false;
    end if;

    return true;
  exception
    when others then
      return false;
  end;
end;
$$;

comment on function public.enrichment_validate_checklist_schema(jsonb) is
  'Defense-in-depth checklist schema validation: allowlist completion_criterion|static_text; cardinality from platform_constants; required criterion fields (design §5.3.2). Returns false on malformed input.';

revoke all on function public.enrichment_validate_checklist_schema(jsonb)
  from public, anon, authenticated;
grant execute on function public.enrichment_validate_checklist_schema(jsonb) to service_role;
grant execute on function public.enrichment_validate_checklist_schema(jsonb) to postgres;
