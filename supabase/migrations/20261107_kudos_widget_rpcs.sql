-- Public read/log functions for the embeddable agent awards widget.
-- The widget API (kudos-site /api/widget) calls these with the anon key; they only
-- expose what the public Kudos site already shows, plus the embed's display settings.

-- Embeds can be issued by AgentBee directly (demos, complimentary widgets) without an account.
alter table public.kudos_embeds alter column account_id drop not null;

create or replace function public.kudos_widget_get(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'embed_id',           e.id,
    'agent_id',           e.agent_id,
    'agent_name',         a.agent_name,
    'agent_slug',         public.kudos_slugify(a.agent_name),
    'agent_logo_url',     a.logo_url,
    'is_pro',             coalesce(a.is_kudos_client, false),
    'layout',             e.layout,
    'theme',              e.theme,
    'accent',             e.accent,
    'allowed_domains',    e.allowed_domains,
    'featured_award_ids', e.featured_award_ids
  )
  from public.kudos_embeds e
  join (select id, agency_name as agent_name, logo_url, is_kudos_client from public.agents) a
    on a.id = e.agent_id
  where e.embed_key = p_key
    and e.is_active
$$;

create or replace function public.kudos_widget_log(p_key text, p_event text, p_award_id uuid default null, p_domain text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_embed uuid;
  v_agent uuid;
begin
  if p_event not in ('view', 'click') then return; end if;
  select id, agent_id into v_embed, v_agent
    from public.kudos_embeds where embed_key = p_key and is_active;
  if v_embed is null then return; end if;
  insert into public.kudos_widget_events (embed_id, agent_id, event, award_id, domain)
  values (v_embed, v_agent, p_event, p_award_id, left(p_domain, 253));
end;
$$;

revoke execute on function public.kudos_widget_get(text) from public;
revoke execute on function public.kudos_widget_log(text, text, uuid, text) from public;
grant execute on function public.kudos_widget_get(text) to anon, authenticated, service_role;
grant execute on function public.kudos_widget_log(text, text, uuid, text) to anon, authenticated, service_role;
