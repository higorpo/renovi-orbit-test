-- Enum for ai_prompts use_case
create type public.ai_prompt_use_case as enum (
  'description',
  'detail',
  'suggestion',
  'analysis',
  'moderation',
  'response'
);

comment on type public.ai_prompt_use_case is 'Use case for AI prompts (description, suggestion, etc.).';

-- ai_prompts: stores prompt configs for edge functions (e.g. generate-smart-description)
create table public.ai_prompts (
  id uuid primary key default gen_random_uuid(),
  prompt_key text not null unique,
  name text not null,
  system_prompt text not null,
  user_prompt_template text,
  category_slug text,
  use_case public.ai_prompt_use_case not null default 'description',
  impact_description text not null default 'Descrição do impacto não definida',
  impact_location text not null default 'Local de uso não especificado',
  admin_notes text,
  max_tokens int not null default 800,
  temperature numeric(3,2) not null default 0.7 check (temperature >= 0 and temperature <= 1),
  variables_schema jsonb not null default '[]',
  formatting_rules jsonb not null default '{"max_words": 350, "allow_markdown": false, "use_caps_for_titles": true, "use_block_separation": true}',
  version int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

comment on table public.ai_prompts is 'AI prompt configurations for edge functions (e.g. generate-smart-description).';

create index idx_ai_prompts_active on public.ai_prompts (is_active) where is_active = true;
create index idx_ai_prompts_prompt_key on public.ai_prompts (prompt_key);
create index idx_ai_prompts_use_case on public.ai_prompts (use_case);
create index idx_ai_prompts_category on public.ai_prompts (category_slug);

alter table public.ai_prompts enable row level security;

-- Allow read so edge function (service role) can read; restrict write to service role only via policy that blocks anon/auth
create policy "Allow read ai_prompts"
  on public.ai_prompts for select
  using (true);

-- ai_prompt_usage: analytics log for prompt usage
create table public.ai_prompt_usage (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.ai_prompts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  request_id uuid references public.service_requests(id) on delete set null,
  session_id text,
  tokens_used int,
  generation_time_ms int,
  success boolean not null default true,
  error_message text,
  used_at timestamptz not null default now()
);

comment on table public.ai_prompt_usage is 'Usage log for AI prompts (analytics).';

create index idx_ai_prompt_usage_prompt_id on public.ai_prompt_usage (prompt_id);
create index idx_ai_prompt_usage_used_at on public.ai_prompt_usage (used_at desc);

alter table public.ai_prompt_usage enable row level security;

-- Only service role (edge function) can insert; no policy = no insert for anon/authenticated
create policy "Allow select ai_prompt_usage"
  on public.ai_prompt_usage for select
  using (true);

-- get_prompt_by_key: fetch active prompt by key, fallback to use_case default
create or replace function public.get_prompt_by_key(p_prompt_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_prompt record;
  v_result jsonb;
begin
  select
    id,
    prompt_key,
    name,
    system_prompt,
    user_prompt_template,
    category_slug,
    use_case,
    impact_description,
    max_tokens,
    temperature,
    variables_schema,
    formatting_rules,
    version
  into v_prompt
  from public.ai_prompts
  where prompt_key = p_prompt_key
    and is_active = true;

  if v_prompt is null then
    select
      id,
      prompt_key,
      name,
      system_prompt,
      user_prompt_template,
      category_slug,
      use_case,
      impact_description,
      max_tokens,
      temperature,
      variables_schema,
      formatting_rules,
      version
    into v_prompt
    from public.ai_prompts
    where prompt_key = split_part(p_prompt_key, '_', 1) || '_default'
      and is_active = true;
  end if;

  if v_prompt is null then
    return null;
  end if;

  v_result := jsonb_build_object(
    'id', v_prompt.id,
    'prompt_key', v_prompt.prompt_key,
    'name', v_prompt.name,
    'system_prompt', v_prompt.system_prompt,
    'user_prompt_template', v_prompt.user_prompt_template,
    'category_slug', v_prompt.category_slug,
    'use_case', v_prompt.use_case,
    'max_tokens', v_prompt.max_tokens,
    'temperature', v_prompt.temperature,
    'variables_schema', v_prompt.variables_schema,
    'formatting_rules', v_prompt.formatting_rules,
    'version', v_prompt.version
  );

  return v_result;
end;
$$;

comment on function public.get_prompt_by_key(text) is 'Returns active prompt config by key, or use_case default (e.g. description_default).';

-- Optional reference from services to ai_prompts for generate-smart-description (service-specific prompt).
alter table public.services
  add column if not exists ai_prompt_id uuid references public.ai_prompts (id) on delete set null;
comment on column public.services.ai_prompt_id is 'AI prompt used for this service in generate-smart-description; null falls back to default prompt.';
create index if not exists services_ai_prompt_id_idx on public.services (ai_prompt_id) where ai_prompt_id is not null;
