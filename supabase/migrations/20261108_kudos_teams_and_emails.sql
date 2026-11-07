-- Kudos agent teams (several people per agency) and account emails.
--
-- * One owner per agency (the first approved claim); everyone else is a member.
-- * Same email domain as the agency: joins automatically. Anyone else: invited by the owner.
-- * Billing stays per agency: only the owner's plan drives agents.is_kudos_client.
-- * Emails (welcome, invite, admin alert for pending claims) are queued in
--   kudos_account_emails and sent by the kudos-account-email edge function via Postmark.

-- ---------------------------------------------------------------- roles
alter table public.kudos_accounts add column if not exists role text check (role in ('owner', 'member'));
alter table public.kudos_accounts drop constraint if exists kudos_accounts_claim_method_check;
alter table public.kudos_accounts add constraint kudos_accounts_claim_method_check
  check (claim_method in ('domain_match', 'manual', 'invite'));

update public.kudos_accounts set role = 'owner' where claim_status in ('approved', 'pending') and role is null;

drop index if exists public.kudos_accounts_one_owner_per_agent;
create unique index kudos_accounts_one_owner_per_agent
  on public.kudos_accounts (agent_id) where claim_status = 'approved' and role = 'owner';
create index if not exists kudos_accounts_agent_idx on public.kudos_accounts (agent_id);

-- Only the owner's plan sets the agency's Pro flag.
create or replace function public.kudos_sync_client_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'owner' and new.agent_id is not null then
    update public.agents
       set is_kudos_client = (new.plan = 'pro' and new.claim_status = 'approved')
     where id = new.agent_id;
  end if;
  if tg_op = 'UPDATE' and old.role = 'owner' and old.agent_id is not null
     and (old.agent_id is distinct from new.agent_id or new.role is distinct from 'owner') then
    update public.agents set is_kudos_client = false where id = old.agent_id;
  end if;
  return new;
end;
$$;

drop trigger if exists kudos_accounts_sync_client_flag on public.kudos_accounts;
create trigger kudos_accounts_sync_client_flag
  after insert or update of plan, claim_status, agent_id, role on public.kudos_accounts
  for each row execute function public.kudos_sync_client_flag();

-- ---------------------------------------------------------------- membership helper + RLS
create or replace function public.kudos_is_member(p_agent uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.kudos_accounts
                  where user_id = auth.uid() and agent_id = p_agent and claim_status = 'approved')
$$;
revoke execute on function public.kudos_is_member(uuid) from public, anon;
grant execute on function public.kudos_is_member(uuid) to authenticated, service_role;

drop policy if exists "kudos_embeds: owner can read" on public.kudos_embeds;
drop policy if exists "kudos_embeds: approved owner can create" on public.kudos_embeds;
drop policy if exists "kudos_embeds: approved owner can update" on public.kudos_embeds;
drop policy if exists "kudos_embeds: approved owner can delete" on public.kudos_embeds;

create policy "kudos_embeds: team can read" on public.kudos_embeds
  for select to authenticated using (public.kudos_is_member(agent_id));
create policy "kudos_embeds: team can create" on public.kudos_embeds
  for insert to authenticated with check (public.kudos_is_member(agent_id));
create policy "kudos_embeds: team can update" on public.kudos_embeds
  for update to authenticated using (public.kudos_is_member(agent_id)) with check (public.kudos_is_member(agent_id));
create policy "kudos_embeds: team can delete" on public.kudos_embeds
  for delete to authenticated using (public.kudos_is_member(agent_id));

drop policy if exists "kudos_widget_events: owner can read" on public.kudos_widget_events;
create policy "kudos_widget_events: team can read" on public.kudos_widget_events
  for select to authenticated using (public.kudos_is_member(agent_id));

-- ---------------------------------------------------------------- invites
create table if not exists public.kudos_invites (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references public.agents(id) on delete cascade,
  email       text not null,
  invited_by  uuid references public.kudos_accounts(id) on delete set null,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index if not exists kudos_invites_open_unique
  on public.kudos_invites (agent_id, lower(email)) where accepted_at is null;
create index if not exists kudos_invites_email_idx on public.kudos_invites (lower(email)) where accepted_at is null;
alter table public.kudos_invites enable row level security;
grant select on public.kudos_invites to anon, authenticated;   -- no policies: read through kudos_team()
grant all on public.kudos_invites to service_role;

-- ---------------------------------------------------------------- email queue
create table if not exists public.kudos_account_emails (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('welcome', 'invite', 'claim_pending')),
  to_email   text not null,
  agent_id   uuid references public.agents(id) on delete set null,
  account_id uuid references public.kudos_accounts(id) on delete set null,
  payload    jsonb not null default '{}',
  status     text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'failed')),
  error      text,
  postmark_message_id text,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
create index if not exists kudos_account_emails_status_idx on public.kudos_account_emails (status, created_at);
alter table public.kudos_account_emails enable row level security;
grant select on public.kudos_account_emails to anon, authenticated;   -- no policies: server only
grant all on public.kudos_account_emails to service_role;

create or replace function public.kudos_queue_email(p_kind text, p_to text, p_agent uuid, p_account uuid, p_payload jsonb default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.kudos_account_emails (kind, to_email, agent_id, account_id, payload)
  values (p_kind, lower(btrim(p_to)), p_agent, p_account, coalesce(p_payload, '{}'));
exception when others then
  raise warning 'kudos_queue_email failed: %', sqlerrm;   -- never block the account change
end;
$$;

-- Send straight away (the edge function only sends rows that are still pending).
create or replace function public.kudos_account_email_dispatch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://mtatzzrbapftzwuxrcko.supabase.co/functions/v1/kudos-account-email',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('id', new.id),
    timeout_milliseconds := 30000
  );
  return new;
exception when others then
  raise warning 'kudos_account_email_dispatch failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists kudos_account_emails_dispatch on public.kudos_account_emails;
create trigger kudos_account_emails_dispatch
  after insert on public.kudos_account_emails
  for each row execute function public.kudos_account_email_dispatch();

-- ---------------------------------------------------------------- embeds belong to the agency
create or replace function public.kudos_ensure_embed(p_account uuid, p_agent uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.kudos_embeds (account_id, agent_id, label)
  select p_account, p_agent, 'Main website'
  where not exists (select 1 from public.kudos_embeds where agent_id = p_agent and account_id is not null)
$$;

-- Approve an account (owner if the agency has none yet, otherwise member) and send the welcome email.
create or replace function public.kudos_approve_account(p_account uuid, p_agent uuid, p_method text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_email text;
begin
  select case when exists (select 1 from public.kudos_accounts
                            where agent_id = p_agent and claim_status = 'approved' and role = 'owner' and id <> p_account)
              then 'member' else 'owner' end
    into v_role;
  update public.kudos_accounts
     set agent_id = p_agent, claim_status = 'approved', role = v_role, claim_method = p_method,
         claim_note = null, claim_reviewed_at = now()
   where id = p_account
  returning email into v_email;
  perform public.kudos_ensure_embed(p_account, p_agent);
  perform public.kudos_queue_email('welcome', v_email, p_agent, p_account, jsonb_build_object('role', v_role));
end;
$$;

-- ---------------------------------------------------------------- account functions
create or replace function public.kudos_my_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_acc    public.kudos_accounts;
  v_invite public.kudos_invites;
begin
  if v_uid is null then raise exception 'Please sign in.'; end if;

  select * into v_acc from public.kudos_accounts where user_id = v_uid;
  if not found then
    insert into public.kudos_accounts (user_id, email) values (v_uid, v_email) returning * into v_acc;
  end if;

  -- Accept an open invitation for this email address.
  if v_acc.claim_status in ('unclaimed', 'rejected') then
    select * into v_invite from public.kudos_invites
     where lower(email) = v_acc.email and accepted_at is null
     order by created_at desc limit 1;
    if found then
      update public.kudos_invites set accepted_at = now() where id = v_invite.id;
      perform public.kudos_approve_account(v_acc.id, v_invite.agent_id, 'invite');
      select * into v_acc from public.kudos_accounts where id = v_acc.id;
    end if;
  end if;

  return jsonb_build_object(
    'id',           v_acc.id,
    'email',        v_acc.email,
    'claim_status', v_acc.claim_status,
    'claim_method', v_acc.claim_method,
    'claim_note',   v_acc.claim_note,
    'role',         v_acc.role,
    'plan',         v_acc.plan,
    'agent', (
      select jsonb_build_object(
        'id', a.id, 'name', a.agency_name, 'website', a.website, 'country', a.country,
        'slug', public.kudos_slugify(a.agency_name), 'logo_url', a.logo_url,
        'is_pro', coalesce(a.is_kudos_client, false))
      from public.agents a where a.id = v_acc.agent_id),
    'embed', (
      select to_jsonb(e) - 'account_id'
      from public.kudos_embeds e
      where v_acc.claim_status = 'approved' and e.agent_id = v_acc.agent_id and e.account_id is not null
      order by e.created_at limit 1)
  );
end;
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
  v_owned   boolean;
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

  v_email_d := public.kudos_domain(v_acc.email);
  v_site_d  := public.kudos_domain(v_agent.website);
  v_mail_d  := public.kudos_domain(v_agent.email);
  v_match := v_email_d is not null
         and not (v_email_d = any (v_free))
         and (   (v_site_d is not null and (v_email_d = v_site_d or v_email_d like '%.' || v_site_d or v_site_d like '%.' || v_email_d))
              or (v_mail_d is not null and v_email_d = v_mail_d));

  v_owned := exists (select 1 from public.kudos_accounts
                      where agent_id = v_agent.id and claim_status = 'approved' and role = 'owner');

  if v_match then
    -- Owner if the agency is unclaimed, otherwise joins the team.
    perform public.kudos_approve_account(v_acc.id, v_agent.id, 'domain_match');
  elsif v_owned then
    raise exception '% is already managed on Kudos by a colleague. Ask them to invite you from the Team tab, or sign in with your agency email address.', v_agent.agency_name;
  else
    update public.kudos_accounts
       set agent_id = v_agent.id, claim_status = 'pending', role = 'owner', claim_method = 'manual',
           claim_note = null, claim_reviewed_at = null
     where id = v_acc.id;
    perform public.kudos_queue_email('claim_pending', 'admin@agentbee.net', v_agent.id, v_acc.id,
      jsonb_build_object('email', v_acc.email, 'agency', v_agent.agency_name, 'website', v_agent.website));
  end if;
  return public.kudos_my_account();
end;
$$;

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
     set agent_id = null, claim_status = 'pending', role = 'owner', claim_method = 'manual',
         claim_note = jsonb_build_object('new_agency', left(btrim(p_name), 200),
                                         'website', left(btrim(coalesce(p_website, '')), 300),
                                         'country', left(btrim(coalesce(p_country, '')), 100))::text
   where id = v_acc.id;
  perform public.kudos_queue_email('claim_pending', 'admin@agentbee.net', null, v_acc.id,
    jsonb_build_object('email', v_acc.email, 'agency', btrim(p_name), 'website', btrim(coalesce(p_website, '')),
                       'country', btrim(coalesce(p_country, '')), 'new_agency', true));
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
     set agent_id = null, claim_status = 'unclaimed', role = null, claim_method = null, claim_note = null,
         claim_reviewed_at = null
   where user_id = auth.uid() and claim_status in ('pending', 'rejected');
  return public.kudos_my_account();
end;
$$;

-- Admin only: approve or reject a pending claim.
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
  perform public.kudos_approve_account(p_account_id, v_agent, 'manual');
end;
$$;

-- ---------------------------------------------------------------- team
create or replace function public.kudos_team()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.kudos_accounts;
begin
  select * into v_acc from public.kudos_accounts where user_id = auth.uid() and claim_status = 'approved';
  if not found then raise exception 'Please sign in.'; end if;
  return jsonb_build_object(
    'can_manage', v_acc.role = 'owner',
    'me', v_acc.id,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'email', a.email, 'role', a.role, 'joined', a.claim_reviewed_at)
                       order by (a.role = 'owner') desc, a.claim_reviewed_at)
        from public.kudos_accounts a
       where a.agent_id = v_acc.agent_id and a.claim_status = 'approved'), '[]'),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'created_at', i.created_at) order by i.created_at)
        from public.kudos_invites i
       where i.agent_id = v_acc.agent_id and i.accepted_at is null), '[]')
  );
end;
$$;

create or replace function public.kudos_invite_member(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc   public.kudos_accounts;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name  text;
begin
  select * into v_acc from public.kudos_accounts where user_id = auth.uid() and claim_status = 'approved';
  if not found or v_acc.role <> 'owner' then raise exception 'Only the account owner can invite people.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address.'; end if;
  if exists (select 1 from public.kudos_accounts where agent_id = v_acc.agent_id and claim_status = 'approved' and email = v_email) then
    raise exception '% is already on your team.', v_email;
  end if;
  if exists (select 1 from public.kudos_accounts where email = v_email and claim_status = 'approved') then
    raise exception '% already manages another agency on Kudos.', v_email;
  end if;
  if (select count(*) from public.kudos_invites where agent_id = v_acc.agent_id and accepted_at is null) >= 20 then
    raise exception 'You have too many open invitations. Cancel some first.';
  end if;
  insert into public.kudos_invites (agent_id, email, invited_by) values (v_acc.agent_id, v_email, v_acc.id)
  on conflict do nothing;
  select agency_name into v_name from public.agents where id = v_acc.agent_id;
  perform public.kudos_queue_email('invite', v_email, v_acc.agent_id, v_acc.id,
    jsonb_build_object('inviter', v_acc.email, 'agency', v_name));
  return public.kudos_team();
end;
$$;

create or replace function public.kudos_cancel_invite(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.kudos_accounts;
begin
  select * into v_acc from public.kudos_accounts where user_id = auth.uid() and claim_status = 'approved';
  if not found or v_acc.role <> 'owner' then raise exception 'Only the account owner can manage invitations.'; end if;
  delete from public.kudos_invites where id = p_invite_id and agent_id = v_acc.agent_id and accepted_at is null;
  return public.kudos_team();
end;
$$;

create or replace function public.kudos_remove_member(p_account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.kudos_accounts;
begin
  select * into v_acc from public.kudos_accounts where user_id = auth.uid() and claim_status = 'approved';
  if not found or v_acc.role <> 'owner' then raise exception 'Only the account owner can remove people.'; end if;
  if p_account_id = v_acc.id then raise exception 'You can''t remove yourself as the owner.'; end if;
  update public.kudos_accounts
     set agent_id = null, claim_status = 'unclaimed', role = null, claim_method = null, claim_reviewed_at = null
   where id = p_account_id and agent_id = v_acc.agent_id and role = 'member';
  return public.kudos_team();
end;
$$;

create or replace function public.kudos_leave_team()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.kudos_accounts where user_id = auth.uid() and role = 'owner' and claim_status = 'approved') then
    raise exception 'As the owner you can''t leave the team. Contact admin@agentbee.net to hand ownership to a colleague.';
  end if;
  update public.kudos_accounts
     set agent_id = null, claim_status = 'unclaimed', role = null, claim_method = null, claim_reviewed_at = null
   where user_id = auth.uid() and role = 'member';
  return public.kudos_my_account();
end;
$$;

-- Admin only: hand ownership to another team member.
create or replace function public.kudos_transfer_owner(p_new_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agent uuid;
  v_plan text;
begin
  select agent_id into v_agent from public.kudos_accounts where id = p_new_owner and claim_status = 'approved';
  if v_agent is null then raise exception 'That account is not an approved team member.'; end if;
  select plan into v_plan from public.kudos_accounts where agent_id = v_agent and role = 'owner' and claim_status = 'approved';
  update public.kudos_accounts set role = 'member' where agent_id = v_agent and role = 'owner';
  update public.kudos_accounts set role = 'owner', plan = coalesce(v_plan, plan) where id = p_new_owner;
end;
$$;

-- ---------------------------------------------------------------- grants
revoke execute on function public.kudos_queue_email(text, text, uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.kudos_account_email_dispatch() from public, anon, authenticated;
revoke execute on function public.kudos_approve_account(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.kudos_transfer_owner(uuid) from public, anon, authenticated;
revoke execute on function public.kudos_sync_client_flag() from public, anon, authenticated;
revoke execute on function public.kudos_team() from public, anon;
revoke execute on function public.kudos_invite_member(text) from public, anon;
revoke execute on function public.kudos_cancel_invite(uuid) from public, anon;
revoke execute on function public.kudos_remove_member(uuid) from public, anon;
revoke execute on function public.kudos_leave_team() from public, anon;

grant execute on function public.kudos_queue_email(text, text, uuid, uuid, jsonb) to service_role;
grant execute on function public.kudos_approve_account(uuid, uuid, text) to service_role;
grant execute on function public.kudos_transfer_owner(uuid) to service_role;
grant execute on function public.kudos_team() to authenticated;
grant execute on function public.kudos_invite_member(text) to authenticated;
grant execute on function public.kudos_cancel_invite(uuid) to authenticated;
grant execute on function public.kudos_remove_member(uuid) to authenticated;
grant execute on function public.kudos_leave_team() to authenticated;
