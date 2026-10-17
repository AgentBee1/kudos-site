# Kudos by AgentBee – public site

Public awards directory for kudos.agentbee.net. Next.js on Vercel, reading from the
Supabase view `kudos_awards_public`.

## Pages

- `/` – all agents (newest award first), search, `?view=institution` for issuers
- `/agent/[slug]` – agent profile
- `/award/[slug]` – award page (the link to paste into social comments)
- Each agent and award page has an auto-generated branded share image
- `/sitemap.xml`, `/robots.txt`

New awards appear automatically within 10 minutes of being added to Supabase.

## Tiers

- `agents.is_kudos_client = false` – shows the 3 most recent awards, "Showing 3 of N",
  and a "Claim this profile" prompt
- `agents.is_kudos_client = true` – shows all awards, logo (`agents.logo_url`), a
  "Visit website" button, and no Kudos sales prompts

Awards hidden by the cap still have a page (so older social links work), but it is
excluded from search engines and the sitemap.

## Data

The view only exposes: award title/date/source, agent name/country/website/logo,
issuer name/country, and the client flag. No risk scores or incident data.
Variant agent records roll up to their canonical agent automatically.

The source link comes from `incidents.original_source_url` (the original social post).

## Deploy

1. Push this folder to a new GitHub repo (e.g. `AgentBee1/kudos-site`).
2. Vercel → Add New → Project → import the repo (framework: Next.js, auto-detected).
3. Environment variables (Project Settings → Environment Variables):
   - `SUPABASE_URL` = `https://mtatzzrbapftzwuxrcko.supabase.co`
   - `SUPABASE_ANON_KEY` = the project's anon/publishable key
   - optional: `SITE_URL`, `KUDOS_CLAIM_URL`, `KUDOS_PAID_TIER_NAME`
4. Deploy.
5. Vercel → Project → Settings → Domains → add `kudos.agentbee.net`, then add the
   CNAME record Vercel shows at your DNS provider.

The key is only used on the server; it never appears in the page source.

## Local test without Supabase

    npm install
    KUDOS_FIXTURE=test/fixture.json npm run build
    KUDOS_FIXTURE=test/fixture.json npm start
