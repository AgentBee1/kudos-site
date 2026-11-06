-- Agent account functions for kudos.agentbee.net/account.
-- Signed-in agents call these with their own session; claim decisions happen here,
-- server-side, so an agent can't approve their own claim.

create or replace function public.kudos_my_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_acc   public.kudos_accounts;
begin
  if v_uid is null then raise exception 'Please sign in.'; end if;

  select * into v_acc from public.kudos_accounts where user_id = v_uid;
  if not found then
    insert into public.kudos_accounts (user_id, email) values (v_uid, v_email) returning * into v_acc;
  end if;

  return jsonb_build_object(
    'id',           v_acc.id,
    'email',        v_acc.email,
    'claim_status', v_acc.claim_status,
    'claim_method', v_acc.claim_method,
    'claim_note',   v_acc.claim_note,
    'plan',         v_acc.plan,
    'agent', (
      select jsonb_build_object(
        'id', a.id, 'name', a.agency_name, 'website', a.website, 'country', a.country,
        'slug', public.kudos_slugify(a.agency_name), 'logo_url', a.logo_url,
        'is_pro', coalesce(a.is_kudos_client, false))
      from public.agents a where a.id = v_acc.agent_id),
    'embed', (
      select to_jsonb(e) - 'account_id'
      from public.kudos_embeds e where e.account_id = v_acc.id
      order by e.created_at limit 1)
  );
end;
$$;

create or replace function public.kudos_search_agents(p_q text)
returns table (id uuid, name text, country text, website text, award_count bigint, claimed boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.agency_name, a.country, a.website,
         (select count(*) from public.kudos_awards_public k where k.agent_id = a.id),
         exists (select 1 from public.kudos_accounts c where c.agent_id = a.id and c.claim_status = 'approved')
  from public.agents a
  where a.canonical_agent_id is null
    and length(btrim(coalesce(p_q, ''))) >= 3
    and (a.agency_name ilike '%' || btrim(p_q) || '%' or a.website ilike '%' || btrim(p_q) || '%')
  order by (a.agency_name ilike btrim(p_q) || '%') desc, a.agency_name
  limit 15
$$;

-- Bare domain from a website or email address: "https://www.Example.com/x" -> "example.com".
create or replace function public.kudos_domain(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(split_part(regexp_replace(
           case when position('@' in s) > 0 then split_part(s, '@', 2) else s end,
           '^https?://', ''), '/', 1), '^www\.', ''), '')
  from (select lower(btrim(coalesce(p, ''))) as s) x
$$;

create or replace function public.kudos_ensure_embed(p_account uuid, p_agent uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.kudos_embeds (account_id, agent_id, label)
  select p_account, p_agent, 'Main website'
  where not exists (select 1 from public.kudos_embeds where account_id = p_account)
$$;

create or replace function public.kudos_claim_agent(p_agent_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_acc     public.kudos_accounts;
  v_agent   public.agents;
  v_email_d text;
  v_site_d  text;
  v_mail_d  text;
  v_match   boolean;
  v_free    text[] := array['gmail.com','googlemail.com','yahoo.com','yahoo.co.in','hotmail.com','outlook.com','live.com',
                            'msn.com','icloud.com','me.com','aol.com','qq.com','163.com','126.com','rediffmail.com',
                            'proton.me','protonmail.com','yandex.com','mail.com','gmx.com','zoho.com','naver.com'];
begin
  if v_uid is null then raise exception 'Please sign in.'; end if;
  perform public.kudos_my_account();
  select * into v_acc from public.kudos_accounts where user_id = v_uid;
  if v_acc.claim_status in ('approved', 'pending') then
    raise exception 'Your account already has a claim in progress.';
  end if;

  select * into v_agent from public.agents
   where id = (select coalesce(canonical_agent_id, id) from public.agents where id = p_agent_id);
  if not found then raise exception 'Agency not found.'; end if;

  if exists (select 1 from public.kudos_accounts
              where agent_id = v_agent.id and claim_status = 'approved' and id <> v_acc.id) then
    raise exception 'This agency has already been claimed. If you think this is wrong, contact us at admin@agentbee.net.';
  end if;

  v_email_d := public.kudos_domain(v_acc.email);
  v_site_d  := public.kudos_domain(v_agent.website);
  v_mail_d  := public.kudos_domain(v_agent.email);
  v_match := v_email_d is not null
         and not (v_email_d = any (v_free))
         and (   (v_site_d is not null and (v_email_d = v_site_d or v_email_d like '%.' || v_site_d or v_site_d like '%.' || v_email_d))
              or (v_mail_d is not null and v_email_d = v_mail_d));

  update public.kudos_accounts
     set agent_id          = v_agent.id,
         claim_status      = case when v_match then 'approved' else 'pending' end,
         claim_method      = case when v_match then 'domain_match' else 'manual' end,
         claim_note        = null,
         claim_reviewed_at = case when v_match then now() end
   where id = v_acc.id;

  if v_match then perform public.kudos_ensure_embed(v_acc.id, v_agent.id); end if;
  return public.kudos_my_account();
end;
$$;

-- Agency not on Kudos yet: AgentBee creates or matches the agent record, then approves.
create or replace function public.kudos_claim_new_agency(p_name text, p_website text, p_country text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_acc public.kudos_accounts;
begin
  if v_uid is null then raise exception 'Please sign in.'; end if;
  if length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'Please enter your agency name.'; end if;
  perform public.kudos_my_account();
  select * into v_acc from public.kudos_accounts where user_id = v_uid;
  if v_acc.claim_status in ('approved', 'pending') then
    raise exception 'Your account already has a claim in progress.';
  end if;
  update public.kudos_accounts
     set agent_id = null, claim_status = 'pending', claim_method = 'manual',
         claim_note = jsonb_build_object('new_agency', left(btrim(p_name), 200),
                                         'website', left(btrim(coalesce(p_website, '')), 300),
                                         'country', left(btrim(coalesce(p_country, '')), 100))::text
   where id = v_acc.id;
  return public.kudos_my_account();
end;
$$;

create or replace function public.kudos_cancel_claim()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  update public.kudos_accounts
     set agent_id = null, claim_status = 'unclaimed', claim_method = null, claim_note = null, claim_reviewed_at = null
   where user_id = auth.uid() and claim_status in ('pending', 'rejected');
  return public.kudos_my_account();
end;
$$;

-- Admin only (service role / SQL editor): approve or reject a pending claim.
--   select kudos_review_claim('<account id>', true);                 -- approve as claimed
--   select kudos_review_claim('<account id>', true, '<agent id>');   -- approve, linking an agent
--   select kudos_review_claim('<account id>', false);                -- reject
create or replace function public.kudos_review_claim(p_account_id uuid, p_approve boolean, p_agent_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agent uuid;
begin
  if not p_approve then
    update public.kudos_accounts set claim_status = 'rejected', claim_reviewed_at = now() where id = p_account_id;
    return;
  end if;
  select coalesce(p_agent_id, agent_id) into v_agent from public.kudos_accounts where id = p_account_id;
  if v_agent is null then raise exception 'Pass the agent id to link this account to.'; end if;
  select coalesce(canonical_agent_id, id) into v_agent from public.agents where id = v_agent;
  update public.kudos_accounts
     set agent_id = v_agent, claim_status = 'approved', claim_method = 'manual', claim_reviewed_at = now()
   where id = p_account_id;
  perform public.kudos_ensure_embed(p_account_id, v_agent);
end;
$$;

revoke execute on function public.kudos_my_account() from public, anon;
revoke execute on function public.kudos_search_agents(text) from public, anon;
revoke execute on function public.kudos_claim_agent(uuid) from public, anon;
revoke execute on function public.kudos_claim_new_agency(text, text, text) from public, anon;
revoke execute on function public.kudos_cancel_claim() from public, anon;
revoke execute on function public.kudos_ensure_embed(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.kudos_review_claim(uuid, boolean, uuid) from public, anon, authenticated;

grant execute on function public.kudos_my_account() to authenticated;
grant execute on function public.kudos_search_agents(text) to authenticated;
grant execute on function public.kudos_claim_agent(uuid) to authenticated;
grant execute on function public.kudos_claim_new_agency(text, text, text) to authenticated;
grant execute on function public.kudos_cancel_claim() to authenticated;
grant execute on function public.kudos_ensure_embed(uuid, uuid) to service_role;
grant execute on function public.kudos_review_claim(uuid, boolean, uuid) to service_role;
