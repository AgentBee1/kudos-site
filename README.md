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

## Embedding in agentbee.net (WordPress)

`/embed` is the directory on its own (no header, hero or footer), for use inside an
iframe. Links open the full Kudos pages in a new tab. It's excluded from search engines,
so Google indexes kudos.agentbee.net itself rather than the embed.

Paste this into a Custom HTML block on the WordPress page. It replaces the old
awards-opal iframe, and the script makes the iframe grow and shrink as rows are opened:

    <iframe id="kudos-embed" src="https://kudos.agentbee.net/embed"
      style="width:100%;border:0;min-height:600px" loading="lazy"
      title="Kudos – Education Agent Awards & Recognition"></iframe>
    <script>
      window.addEventListener('message', function (e) {
        if (e.origin !== 'https://kudos.agentbee.net') return;
        if (e.data && e.data.type === 'kudos-embed-height') {
          document.getElementById('kudos-embed').style.height = e.data.height + 'px';
        }
      });
    </script>

## Agent awards widget (agents' own websites)

`/widget` lets an agent search for their agency, preview their awards and copy an
embed snippet. The snippet loads `/embed/agent/<slug>`: that agent's awards only, with
the same free-tier cap as their profile and a "Verified by AgentBee Kudos" footer that
links back to their profile. It isn't indexed, so search engines credit Kudos, not the
embed. The snippet's script resizes the iframe and only listens to messages from its own
iframe, so several embeds can sit on one page. Each agent profile links to its widget.
