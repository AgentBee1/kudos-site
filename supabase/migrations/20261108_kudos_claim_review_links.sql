-- One-click review links for pending Kudos claims.
-- Each "claim waiting for approval" email carries a random token. Only its SHA-256 hash is
-- stored here; the admin tool (incident-report-widget /claim.html) looks it up with the
-- service role key. Tokens expire after 7 days and work once.

create table if not exists public.kudos_claim_tokens (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.kudos_accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists kudos_claim_tokens_account_idx on public.kudos_claim_tokens (account_id);
alter table public.kudos_claim_tokens enable row level security;
grant select on public.kudos_claim_tokens to anon, authenticated;   -- no policies: server only
grant all on public.kudos_claim_tokens to service_role;

create or replace function public.kudos_new_claim_token(p_account uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  insert into public.kudos_claim_tokens (account_id, token_hash)
  values (p_account, encode(extensions.digest(v_token, 'sha256'), 'hex'));
  return v_token;
end;
$$;

-- Claim alerts now carry a review token.
create or replace function public.kudos_queue_email(p_kind text, p_to text, p_agent uuid, p_account uuid, p_payload jsonb default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := coalesce(p_payload, '{}');
begin
  if p_kind = 'claim_pending' and p_account is not null then
    v_payload := v_payload || jsonb_build_object('token', public.kudos_new_claim_token(p_account));
  end if;
  insert into public.kudos_account_emails (kind, to_email, agent_id, account_id, payload)
  values (p_kind, lower(btrim(p_to)), p_agent, p_account, v_payload);
exception when others then
  raise warning 'kudos_queue_email failed: %', sqlerrm;
end;
$$;

revoke execute on function public.kudos_new_claim_token(uuid) from public, anon, authenticated;
grant execute on function public.kudos_new_claim_token(uuid) to service_role;
revoke execute on function public.kudos_queue_email(text, text, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.kudos_queue_email(text, text, uuid, uuid, jsonb) to service_role;
