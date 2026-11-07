-- Make "Find your agency" smarter:
--  * kudos_suggest_agents(): agencies whose website (or email) domain matches the signed-in email
--  * kudos_agent_by_slug(): the agency an agent came from via "Claim this profile"
--  * kudos_search_agents(): search from 2 characters

create or replace function public.kudos_suggest_agents()
returns table (id uuid, name text, country text, website text, award_count bigint, claimed boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dom  text := public.kudos_domain(auth.jwt() ->> 'email');
  v_free text[] := array['gmail.com','googlemail.com','yahoo.com','yahoo.co.in','hotmail.com','outlook.com','live.com',
                         'msn.com','icloud.com','me.com','aol.com','qq.com','163.com','126.com','rediffmail.com',
                         'proton.me','protonmail.com','yandex.com','mail.com','gmx.com','zoho.com','naver.com'];
begin
  if auth.uid() is null or v_dom is null or v_dom = any (v_free) then return; end if;
  return query
    select a.id, a.agency_name, a.country, a.website,
           (select count(*) from public.kudos_awards_public k where k.agent_id = a.id),
           exists (select 1 from public.kudos_accounts c where c.agent_id = a.id and c.claim_status = 'approved')
      from public.agents a
     where a.canonical_agent_id is null
       and (   public.kudos_domain(a.website) = v_dom
            or v_dom like '%.' || public.kudos_domain(a.website)
            or public.kudos_domain(a.email) = v_dom)
     order by 5 desc, a.agency_name
     limit 5;
end;
$$;

create or replace function public.kudos_agent_by_slug(p_slug text)
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
     and public.kudos_slugify(a.agency_name) = lower(btrim(coalesce(p_slug, '')))
   limit 1
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
    and length(btrim(coalesce(p_q, ''))) >= 2
    and (a.agency_name ilike '%' || btrim(p_q) || '%' or a.website ilike '%' || btrim(p_q) || '%')
  order by (a.agency_name ilike btrim(p_q) || '%') desc,
           (select count(*) from public.kudos_awards_public k where k.agent_id = a.id) desc,
           a.agency_name
  limit 15
$$;

revoke execute on function public.kudos_suggest_agents() from public, anon;
revoke execute on function public.kudos_agent_by_slug(text) from public, anon;
grant execute on function public.kudos_suggest_agents() to authenticated;
grant execute on function public.kudos_agent_by_slug(text) to authenticated;
