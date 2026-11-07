-- Two simultaneous first loads could both try to create the account row
-- ("duplicate key value violates unique constraint kudos_accounts_user_id_key").
-- Create it with ON CONFLICT DO NOTHING, then read it back.
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

  insert into public.kudos_accounts (user_id, email) values (v_uid, v_email)
  on conflict (user_id) do nothing;
  select * into v_acc from public.kudos_accounts where user_id = v_uid;

  if v_acc.claim_status in ('unclaimed', 'rejected') then
    select * into v_invite from public.kudos_invites
     where lower(email) = v_acc.email and accepted_at is null
     order by created_at desc limit 1
     for update skip locked;
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
