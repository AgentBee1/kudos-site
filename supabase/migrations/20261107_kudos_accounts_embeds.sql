-- Kudos agent accounts, embeddable widgets and widget stats.
-- Claims, plan changes and widget event logging are done server-side (edge functions
-- with the service role). Signed-in agents can only read their own rows and manage
-- their own widgets once their claim is approved.

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.kudos_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- kudos_accounts: one per signed-in agent user
-- ---------------------------------------------------------------------------
create table public.kudos_accounts (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique references auth.users(id) on delete cascade,
  email                  text not null,
  agent_id               uuid references public.agents(id) on delete set null, -- canonical agent
  claim_status           text not null default 'unclaimed'
                           check (claim_status in ('unclaimed','pending','approved','rejected')),
  claim_method           text check (claim_method in ('domain_match','manual')),
  claim_note             text,
  claim_reviewed_at      timestamptz,
  plan                   text not null default 'free' check (plan in ('free','pro')),
  billing_interval       text check (billing_interval in ('month','year')),
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  stripe_price_id        text,
  subscription_status    text,
  paid_until             timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Only one approved owner per agency.
create unique index kudos_accounts_one_owner_per_agent
  on public.kudos_accounts (agent_id) where claim_status = 'approved';
create index kudos_accounts_claim_status_idx on public.kudos_accounts (claim_status);

create trigger kudos_accounts_updated_at
  before update on public.kudos_accounts
  for each row execute function public.kudos_set_updated_at();

-- Keep agents.is_kudos_client in step with the plan (drives the public site tiers).
create or replace function public.kudos_sync_client_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.agent_id is not null then
    update public.agents
       set is_kudos_client = (new.plan = 'pro' and new.claim_status = 'approved')
     where id = new.agent_id;
  end if;
  if tg_op = 'UPDATE' and old.agent_id is not null and old.agent_id is distinct from new.agent_id then
    update public.agents set is_kudos_client = false where id = old.agent_id;
  end if;
  return new;
end;
$$;

create trigger kudos_accounts_sync_client_flag
  after insert or update of plan, claim_status, agent_id on public.kudos_accounts
  for each row execute function public.kudos_sync_client_flag();

alter table public.kudos_accounts enable row level security;

create policy "kudos_accounts: owner can read"
  on public.kudos_accounts for select to authenticated
  using (user_id = (select auth.uid()));

-- A new user may create their own blank free account; claiming and billing are server-side.
create policy "kudos_accounts: owner can create blank account"
  on public.kudos_accounts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and plan = 'free'
    and claim_status = 'unclaimed'
    and agent_id is null
    and stripe_customer_id is null
    and stripe_subscription_id is null
  );

grant select on public.kudos_accounts to anon;              -- no anon policy: returns nothing
grant select, insert on public.kudos_accounts to authenticated;
grant all on public.kudos_accounts to service_role;

-- ---------------------------------------------------------------------------
-- kudos_embeds: one per website/domain the agent embeds the widget on
-- ---------------------------------------------------------------------------
create table public.kudos_embeds (
  id                 uuid primary key default gen_random_uuid(),
  embed_key          text not null unique
                       default ('kd_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  account_id         uuid not null references public.kudos_accounts(id) on delete cascade,
  agent_id           uuid not null references public.agents(id) on delete cascade,
  label              text,
  allowed_domains    text[] not null default '{}',
  layout             text not null default 'wall' check (layout in ('wall','carousel','badge')),
  theme              text not null default 'light' check (theme in ('light','dark')),
  accent             text not null default '#F5A623' check (accent ~ '^#[0-9A-Fa-f]{6}$'),
  featured_award_ids uuid[] not null default '{}',
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index kudos_embeds_account_idx on public.kudos_embeds (account_id);
create index kudos_embeds_agent_idx on public.kudos_embeds (agent_id);

create trigger kudos_embeds_updated_at
  before update on public.kudos_embeds
  for each row execute function public.kudos_set_updated_at();

alter table public.kudos_embeds enable row level security;

-- Owner = the signed-in user whose approved claim matches the embed's agent.
create policy "kudos_embeds: owner can read"
  on public.kudos_embeds for select to authenticated
  using (exists (
    select 1 from public.kudos_accounts a
     where a.id = kudos_embeds.account_id
       and a.user_id = (select auth.uid())
  ));

create policy "kudos_embeds: approved owner can create"
  on public.kudos_embeds for insert to authenticated
  with check (exists (
    select 1 from public.kudos_accounts a
     where a.id = kudos_embeds.account_id
       and a.user_id = (select auth.uid())
       and a.claim_status = 'approved'
       and a.agent_id = kudos_embeds.agent_id
  ));

create policy "kudos_embeds: approved owner can update"
  on public.kudos_embeds for update to authenticated
  using (exists (
    select 1 from public.kudos_accounts a
     where a.id = kudos_embeds.account_id
       and a.user_id = (select auth.uid())
       and a.claim_status = 'approved'
  ))
  with check (exists (
    select 1 from public.kudos_accounts a
     where a.id = kudos_embeds.account_id
       and a.user_id = (select auth.uid())
       and a.claim_status = 'approved'
       and a.agent_id = kudos_embeds.agent_id
  ));

create policy "kudos_embeds: approved owner can delete"
  on public.kudos_embeds for delete to authenticated
  using (exists (
    select 1 from public.kudos_accounts a
     where a.id = kudos_embeds.account_id
       and a.user_id = (select auth.uid())
       and a.claim_status = 'approved'
  ));

-- embed_key is generated, never client-set.
grant select on public.kudos_embeds to anon;                -- no anon policy: returns nothing
grant select, delete on public.kudos_embeds to authenticated;
grant insert (account_id, agent_id, label, allowed_domains, layout, theme, accent, featured_award_ids)
  on public.kudos_embeds to authenticated;
grant update (label, allowed_domains, layout, theme, accent, featured_award_ids, is_active)
  on public.kudos_embeds to authenticated;
grant all on public.kudos_embeds to service_role;

-- ---------------------------------------------------------------------------
-- kudos_widget_events: views and clicks, written by the widget edge function
-- ---------------------------------------------------------------------------
create table public.kudos_widget_events (
  id         bigint generated always as identity primary key,
  embed_id   uuid not null references public.kudos_embeds(id) on delete cascade,
  agent_id   uuid not null references public.agents(id) on delete cascade,
  event      text not null check (event in ('view','click')),
  award_id   uuid,
  domain     text,
  created_at timestamptz not null default now()
);

create index kudos_widget_events_embed_time_idx on public.kudos_widget_events (embed_id, created_at desc);
create index kudos_widget_events_agent_time_idx on public.kudos_widget_events (agent_id, created_at desc);

alter table public.kudos_widget_events enable row level security;

create policy "kudos_widget_events: owner can read"
  on public.kudos_widget_events for select to authenticated
  using (exists (
    select 1 from public.kudos_embeds e
      join public.kudos_accounts a on a.id = e.account_id
     where e.id = kudos_widget_events.embed_id
       and a.user_id = (select auth.uid())
  ));

grant select on public.kudos_widget_events to anon;         -- no anon policy: returns nothing
grant select on public.kudos_widget_events to authenticated;
grant all on public.kudos_widget_events to service_role;

-- Trigger functions are not for API use.
revoke execute on function public.kudos_sync_client_flag() from public, anon, authenticated;
revoke execute on function public.kudos_set_updated_at() from public, anon, authenticated;
