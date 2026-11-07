'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import EmbedPreview from '../../embed-preview';

let client;
function getClient(url, key) {
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' }
    });
  }
  return client;
}

const LAUNCH_PRICE = 'US$79/month or US$790/year';
const FREE_CAP = 3;

export default function AccountApp({ supabaseUrl, supabaseKey, siteUrl, awardFormUrl }) {
  // Created in the browser only (the server render just shows "Loading…").
  const sb = useMemo(
    () => (typeof window === 'undefined' || !supabaseUrl ? null : getClient(supabaseUrl, supabaseKey)),
    [supabaseUrl, supabaseKey]
  );
  const [session, setSession] = useState(undefined);
  const [account, setAccount] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data } = sb.auth.onAuthStateChange((_event, s) => setSession(s || null));
    return () => data.subscription.unsubscribe();
  }, [sb]);

  const load = useCallback(async () => {
    setError('');
    const { data, error: e } = await sb.rpc('kudos_my_account');
    if (e) setError(e.message);
    else setAccount(data);
  }, [sb]);

  useEffect(() => {
    if (session) load();
    else setAccount(null);
  }, [session?.user?.id, load]); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => {
    await sb.auth.signOut();
    setAccount(null);
  };

  const status = account?.claim_status;
  const wide = status === 'approved';

  return (
    <main className={`acct ${wide ? 'wrap-wide' : 'wrap'}`}>
      <div className="acct-top">
        <div>
          <p className="acct-eyebrow">Kudos for agents</p>
          <h1>{account?.agent && status === 'approved' ? account.agent.name : 'Your Kudos account'}</h1>
        </div>
        {session && (
          <div className="acct-user">
            <span className="muted small">{session.user.email}</span>
            <button className="btn btn-ghost" onClick={signOut}>
              Sign out
            </button>
          </div>
        )}
      </div>

      {error && <p className="acct-error">{error}</p>}

      {session === undefined ? (
        <p className="muted">Loading…</p>
      ) : !session ? (
        <SignIn sb={sb} />
      ) : !account ? (
        !error && <p className="muted">Loading your account…</p>
      ) : status === 'approved' && account.agent ? (
        <Dashboard sb={sb} account={account} setAccount={setAccount} siteUrl={siteUrl} awardFormUrl={awardFormUrl} />
      ) : status === 'pending' ? (
        <Pending sb={sb} account={account} setAccount={setAccount} />
      ) : (
        <Claim sb={sb} account={account} setAccount={setAccount} />
      )}
    </main>
  );
}

/* ---------------------------------------------------------------- Sign in */

function SignIn({ sb }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Enter a valid email address.');
    setBusy(true);
    const { error: err } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/account${window.location.search}`, shouldCreateUser: true }
    });
    setBusy(false);
    if (err) setError(err.message);
    else setSent(true);
  };

  if (sent) {
    return (
      <div className="acct-card acct-narrow">
        <h2>Check your email</h2>
        <p>
          We've sent a sign-in link to <strong>{email}</strong>. Open it on this device to continue. It may take a
          minute to arrive, so check your spam folder if you don't see it.
        </p>
        <button className="btn btn-ghost" onClick={() => setSent(false)}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="acct-grid-2">
      <div className="acct-card">
        <h2>Sign in or create your free account</h2>
        <p className="muted">No password needed: we'll email you a sign-in link.</p>
        <form onSubmit={submit} className="acct-form">
          <label htmlFor="email">Work email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@youragency.com"
            autoComplete="email"
            required
          />
          <button className="btn btn-gold btn-lg" disabled={busy}>
            {busy ? 'Sending…' : 'Email me a sign-in link'}
          </button>
          {error && <p className="acct-error">{error}</p>}
        </form>
        <p className="small muted">
          Tip: use an email at your agency's own website domain (not Gmail or similar) and your account is approved
          straight away.
        </p>
      </div>
      <div className="acct-pitch">
        <h2>Show your verified awards on your own website</h2>
        <ul>
          <li>Claim your agency's free Kudos profile</li>
          <li>Add awards you've received from universities and colleges</li>
          <li>Paste one line of code to show them on your website, independently verified by AgentBee</li>
          <li>Preview exactly how it looks on desktop and mobile before you add it</li>
        </ul>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Claim */

function Claim({ sb, account, setAccount }) {
  const initial = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const slug = new URLSearchParams(window.location.search).get('claim') || '';
    return slug.replace(/-/g, ' ').trim();
  }, []);
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newAgency, setNewAgency] = useState({ name: '', website: '', country: '' });

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data, error: e } = await sb.rpc('kudos_search_agents', { p_q: term });
      setSearching(false);
      if (e) setError(e.message);
      else setResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [q, sb]);

  const claim = async (agent) => {
    setError('');
    setBusy(agent.id);
    const { data, error: e } = await sb.rpc('kudos_claim_agent', { p_agent_id: agent.id });
    setBusy('');
    if (e) setError(e.message);
    else setAccount(data);
  };

  const submitNew = async (e) => {
    e.preventDefault();
    setError('');
    setBusy('new');
    const { data, error: err } = await sb.rpc('kudos_claim_new_agency', {
      p_name: newAgency.name,
      p_website: newAgency.website,
      p_country: newAgency.country
    });
    setBusy('');
    if (err) setError(err.message);
    else setAccount(data);
  };

  return (
    <div className="acct-card">
      {account.claim_status === 'rejected' && (
        <p className="acct-note">
          We couldn't confirm your last claim. Search again below, or contact admin@agentbee.net if you think this is a
          mistake.
        </p>
      )}
      <h2>Find your agency</h2>
      <p className="muted">
        Signed in as <strong>{account.email}</strong>. If that email matches your agency's website domain you'll be
        approved straight away; otherwise we'll check and approve you, usually within one business day.
      </p>
      <input
        className="acct-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Agency name or website"
        autoFocus
      />
      {error && <p className="acct-error">{error}</p>}
      {searching && <p className="muted small">Searching…</p>}
      {results.length > 0 && (
        <ul className="acct-results">
          {results.map((r) => (
            <li key={r.id}>
              <div>
                <strong>{r.name}</strong>
                <div className="muted small">
                  {[
                    r.country,
                    r.website,
                    r.award_count ? `${r.award_count} award${r.award_count === 1 ? '' : 's'} on Kudos` : '',
                    r.claimed ? 'Already managed by a colleague' : ''
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <button className="btn btn-blue" disabled={!!busy} onClick={() => claim(r)}>
                {busy === r.id ? 'Please wait…' : r.claimed ? 'Join this team' : 'This is my agency'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 3 && !searching && results.length === 0 && <p className="muted small">No agencies found.</p>}

      <p className="small" style={{ marginTop: 18 }}>
        <button className="acct-link" onClick={() => setShowNew(!showNew)}>
          Can't find your agency?
        </button>
      </p>
      {showNew && (
        <form className="acct-form" onSubmit={submitNew}>
          <label htmlFor="na-name">Agency name</label>
          <input
            id="na-name"
            value={newAgency.name}
            onChange={(e) => setNewAgency({ ...newAgency, name: e.target.value })}
            required
          />
          <label htmlFor="na-web">Website</label>
          <input
            id="na-web"
            value={newAgency.website}
            onChange={(e) => setNewAgency({ ...newAgency, website: e.target.value })}
            placeholder="youragency.com"
          />
          <label htmlFor="na-country">Country</label>
          <input
            id="na-country"
            value={newAgency.country}
            onChange={(e) => setNewAgency({ ...newAgency, country: e.target.value })}
          />
          <button className="btn btn-gold" disabled={!!busy}>
            {busy === 'new' ? 'Sending…' : 'Send for review'}
          </button>
        </form>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Pending */

function Pending({ sb, account, setAccount }) {
  let name = account.agent?.name;
  if (!name && account.claim_note) {
    try {
      name = JSON.parse(account.claim_note).new_agency;
    } catch {}
  }
  const cancel = async () => {
    const { data, error } = await sb.rpc('kudos_cancel_claim');
    if (!error) setAccount(data);
  };
  return (
    <div className="acct-card acct-narrow">
      <h2>We're checking your claim</h2>
      <p>
        You've asked to manage <strong>{name || 'your agency'}</strong> on Kudos. We check that{' '}
        <strong>{account.email}</strong> belongs to someone at the agency before giving access, usually within one
        business day. Come back to this page to get started once you're approved.
      </p>
      <p className="small muted">
        Faster next time: claims from an email at the agency's own website domain are approved automatically.
      </p>
      <button className="btn btn-ghost" onClick={cancel}>
        Cancel and choose a different agency
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- Dashboard */

function Dashboard({ sb, account, setAccount, siteUrl, awardFormUrl }) {
  const [tab, setTab] = useState('widget');
  const [awards, setAwards] = useState(null);
  const agent = account.agent;
  const isPro = Boolean(agent.is_pro);

  useEffect(() => {
    sb.from('kudos_awards_public')
      .select('award_id,award_title,issuer_name,issuer_type,award_date,award_slug')
      .eq('agent_id', agent.id)
      .order('award_date', { ascending: false })
      .then(({ data }) => setAwards(data || []));
  }, [sb, agent.id]);

  const setEmbed = (embed) => setAccount({ ...account, embed });

  return (
    <>
      <div className="acct-sub">
        <span className={`acct-plan ${isPro ? 'pro' : ''}`}>{isPro ? 'Kudos Pro' : 'Free plan'}</span>
        <a href={`${siteUrl}/agent/${agent.slug}`} target="_blank" rel="noopener" className="small">
          View your Kudos profile ↗
        </a>
      </div>
      <nav className="tabs acct-tabs">
        {[
          ['widget', 'Website widget'],
          ['awards', `Awards${awards ? ` (${awards.length})` : ''}`],
          ['team', 'Team'],
          ['plan', 'Plan']
        ].map(([id, label]) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {!account.embed ? (
        <p className="acct-note">Your widget is being set up. Please refresh in a moment.</p>
      ) : tab === 'widget' ? (
        <WidgetTab sb={sb} embed={account.embed} setEmbed={setEmbed} isPro={isPro} siteUrl={siteUrl} awards={awards} />
      ) : tab === 'awards' ? (
        <AwardsTab
          sb={sb}
          embed={account.embed}
          setEmbed={setEmbed}
          isPro={isPro}
          awards={awards}
          agent={agent}
          awardFormUrl={awardFormUrl}
        />
      ) : tab === 'team' ? (
        <TeamTab sb={sb} agent={agent} onLeft={setAccount} />
      ) : (
        <PlanTab isPro={isPro} agent={agent} isOwner={account.role === 'owner'} />
      )}
    </>
  );
}

function parseDomains(text) {
  return [
    ...new Set(
      text
        .split(/[\s,]+/)
        .map((d) =>
          d
            .toLowerCase()
            .trim()
            .replace(/^https?:\/\//, '')
            .replace(/\/.*$/, '')
            .replace(/^www\./, '')
        )
        .filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d))
    )
  ];
}

function WidgetTab({ sb, embed, setEmbed, isPro, siteUrl, awards }) {
  const [layout, setLayout] = useState(embed.layout);
  const [theme, setTheme] = useState(embed.theme);
  const [accent, setAccent] = useState(embed.accent);
  const [previewAccent, setPreviewAccent] = useState(embed.accent);
  const [domains, setDomains] = useState((embed.allowed_domains || []).join('\n'));
  const [device, setDevice] = useState('desktop');
  const [showPro, setShowPro] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => /^#[0-9a-f]{6}$/i.test(accent) && setPreviewAccent(accent), 350);
    return () => clearTimeout(t);
  }, [accent]);

  useEffect(() => {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    sb.from('kudos_widget_events')
      .select('event')
      .eq('embed_id', embed.id)
      .gte('created_at', since)
      .then(({ data }) => {
        const rows = data || [];
        setStats({ views: rows.filter((r) => r.event === 'view').length, clicks: rows.filter((r) => r.event === 'click').length });
      });
  }, [sb, embed.id]);

  const domainList = parseDomains(domains);
  const dirty =
    layout !== embed.layout ||
    theme !== embed.theme ||
    accent.toLowerCase() !== String(embed.accent).toLowerCase() ||
    domainList.join(',') !== (embed.allowed_domains || []).join(',');

  const save = async () => {
    setMsg('');
    if (!/^#[0-9a-f]{6}$/i.test(accent)) return setMsg('Accent colour must be a hex colour like #E0A83A.');
    setSaving(true);
    const { data, error } = await sb
      .from('kudos_embeds')
      .update({ layout, theme, accent, allowed_domains: domainList })
      .eq('id', embed.id)
      .select()
      .single();
    setSaving(false);
    if (error) return setMsg(error.message);
    setEmbed(data);
    setDomains(domainList.join('\n'));
    setMsg('Saved. Your website widget updates straight away.');
  };

  const snippet = `<script src="${siteUrl}/embed.js" data-key="${embed.embed_key}" async></script>`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const hidden = awards && !isPro ? Math.max(0, awards.length - FREE_CAP) : 0;

  return (
    <div className="acct-widget">
      <div className="acct-controls acct-card">
        <h3>Layout</h3>
        <div className="acct-options">
          {[
            ['wall', 'Wall', 'All awards, grouped by year'],
            ['carousel', 'Carousel', 'One scrolling row'],
            ['badge', 'Badge', 'Small link with your award count']
          ].map(([id, label, hint]) => (
            <label key={id} className={`acct-option ${layout === id ? 'on' : ''}`}>
              <input type="radio" name="layout" checked={layout === id} onChange={() => setLayout(id)} />
              <span>
                <strong>{label}</strong>
                <span className="muted small">{hint}</span>
              </span>
            </label>
          ))}
        </div>

        <h3>Theme</h3>
        <div className="acct-seg">
          {['light', 'dark'].map((t) => (
            <button key={t} className={theme === t ? 'on' : ''} onClick={() => setTheme(t)}>
              {t === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>

        <h3>Accent colour</h3>
        <div className="acct-color">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(accent) ? accent : '#e0a83a'} onChange={(e) => setAccent(e.target.value)} />
          <input value={accent} onChange={(e) => setAccent(e.target.value)} maxLength={7} />
        </div>

        <h3>Your website</h3>
        <p className="muted small">
          The widget only loads on these domains (and their subdomains). Leave empty while you're testing.
        </p>
        <textarea rows={3} value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="youragency.com" />

        <button className="btn btn-gold btn-lg" disabled={!dirty || saving} onClick={save}>
          {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
        </button>
        {msg && <p className="small acct-msg">{msg}</p>}

        {stats && (
          <p className="small muted" style={{ marginTop: 16 }}>
            Last 30 days: <strong>{stats.views}</strong> views · <strong>{stats.clicks}</strong> award clicks
          </p>
        )}
      </div>

      <div className="acct-preview">
        <div className="acct-preview-bar">
          <div className="acct-seg">
            {['desktop', 'mobile'].map((d) => (
              <button key={d} className={device === d ? 'on' : ''} onClick={() => setDevice(d)}>
                {d === 'desktop' ? 'Desktop' : 'Mobile'}
              </button>
            ))}
          </div>
          {!isPro && (
            <label className="small acct-toggle">
              <input type="checkbox" checked={showPro} onChange={(e) => setShowPro(e.target.checked)} /> Preview Kudos
              Pro
            </label>
          )}
        </div>
        {!isPro && !showPro && hidden > 0 && (
          <p className="small muted" style={{ margin: '0 0 10px' }}>
            Free plan: your widget shows 3 awards and links to the other {hidden} on Kudos.
          </p>
        )}
        <DeviceFrame device={device} domain={domainList[0]}>
          <EmbedPreview
            widgetKey={embed.embed_key}
            layout={layout}
            theme={theme}
            accent={previewAccent}
            preview={showPro ? 'pro' : undefined}
          />
        </DeviceFrame>

        <div className="acct-card" style={{ marginTop: 20 }}>
          <h3 style={{ marginTop: 0 }}>Add it to your website</h3>
          <p className="muted small">
            Paste this where you want your awards to appear: in a Custom HTML block (WordPress), an Embed element (Wix,
            Squarespace, Webflow) or straight into your page's HTML. Changes you save here appear automatically, so you
            only paste it once.
          </p>
          <pre className="acct-code">{snippet}</pre>
          <button className="btn btn-blue" onClick={copy}>
            {copied ? 'Copied ✓' : 'Copy code'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeviceFrame({ device, domain, children }) {
  const outer = useRef(null);
  const inner = useRef(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(400);
  const DESKTOP = 1200;

  useEffect(() => {
    if (device !== 'desktop') return;
    const update = () => {
      if (!outer.current || !inner.current) return;
      const s = Math.min(1, outer.current.clientWidth / DESKTOP);
      setScale(s);
      setHeight(inner.current.offsetHeight * s);
    };
    update();
    const ro = new ResizeObserver(update);
    if (outer.current) ro.observe(outer.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [device]);

  const site = (
    <>
      <div className="fake-nav">
        <span className="fake-logo" />
        <span className="fake-links" />
      </div>
      <div className="fake-hero" />
      <div className="fake-content">{children}</div>
      <div className="fake-footer" />
    </>
  );

  return (
    <div className={`device ${device}`}>
      <div className="device-chrome">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        <span className="addr">{domain || 'youragency.com'}</span>
      </div>
      {device === 'desktop' ? (
        <div className="device-screen" ref={outer} style={{ height }}>
          <div className="device-inner" ref={inner} style={{ width: DESKTOP, transform: `scale(${scale})` }}>
            {site}
          </div>
        </div>
      ) : (
        <div className="device-screen">
          <div className="device-inner">{site}</div>
        </div>
      )}
    </div>
  );
}

function AwardsTab({ sb, embed, setEmbed, isPro, awards, agent, awardFormUrl }) {
  const [featured, setFeatured] = useState(embed.featured_award_ids || []);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  if (!awards) return <p className="muted">Loading awards…</p>;

  // What the free widget shows: chosen awards first, topped up with the latest.
  const chosen = featured.filter((id) => awards.some((a) => a.award_id === id));
  const shown = new Set(
    [...chosen, ...awards.map((a) => a.award_id).filter((id) => !chosen.includes(id))].slice(0, FREE_CAP)
  );

  const toggle = (id) => {
    setMsg('');
    if (chosen.includes(id)) setFeatured(chosen.filter((x) => x !== id));
    else if (chosen.length < FREE_CAP) setFeatured([...chosen, id]);
    else setMsg(`You can choose up to ${FREE_CAP} awards on the free plan.`);
  };

  const dirty = chosen.join(',') !== (embed.featured_award_ids || []).join(',');
  const save = async () => {
    setSaving(true);
    const { data, error } = await sb
      .from('kudos_embeds')
      .update({ featured_award_ids: chosen })
      .eq('id', embed.id)
      .select()
      .single();
    setSaving(false);
    if (error) return setMsg(error.message);
    setEmbed(data);
    setMsg('Saved.');
  };

  const addUrl = `${awardFormUrl}${awardFormUrl.includes('?') ? '&' : '?'}business=${encodeURIComponent(agent.name)}`;

  return (
    <div className="acct-card">
      <div className="acct-row-head">
        <div>
          <h3 style={{ margin: 0 }}>Your awards on Kudos</h3>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {isPro
              ? 'Kudos Pro: every award appears on your widget and profile.'
              : `Tick the ${FREE_CAP} awards to show on your website. If you don't choose, your latest ${FREE_CAP} are shown.`}
          </p>
        </div>
        <a className="btn btn-gold" href={addUrl} target="_blank" rel="noopener">
          + Add an award
        </a>
      </div>

      {awards.length === 0 ? (
        <p className="muted">
          No awards yet. Add your first one: AgentBee checks every award before it appears, usually within a day.
        </p>
      ) : (
        <ul className="acct-awards">
          {awards.map((a) => {
            const on = !isPro && shown.has(a.award_id);
            return (
              <li key={a.award_id} className={on ? 'on' : ''}>
                {!isPro && (
                  <input
                    type="checkbox"
                    checked={chosen.includes(a.award_id)}
                    onChange={() => toggle(a.award_id)}
                    aria-label={`Show ${a.award_title} on my widget`}
                  />
                )}
                <div>
                  <strong>{a.award_title}</strong>
                  <div className="muted small">
                    {a.issuer_name}
                    {a.issuer_type === 'aggregator' ? ' (agent aggregator)' : ''}
                    {a.award_date ? ` · ${a.award_date.slice(0, 4)}` : ''}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!isPro && awards.length > 0 && (
        <>
          <button className="btn btn-blue" disabled={!dirty || saving} onClick={save}>
            {saving ? 'Saving…' : dirty ? 'Save choice' : 'Saved'}
          </button>
          {msg && <span className="small acct-msg" style={{ marginLeft: 12 }}>{msg}</span>}
        </>
      )}
      <p className="small muted" style={{ marginTop: 16 }}>
        New awards are checked by AgentBee before they appear, usually within a day.
      </p>
    </div>
  );
}

function PlanTab({ isPro, agent, isOwner }) {
  const rows = [
    ['Awards on your website widget', `Your choice of ${FREE_CAP}`, 'All of them'],
    ['Awards on your Kudos profile', `Latest ${FREE_CAP}`, 'All of them'],
    ['Logo and "Visit website" button on Kudos', '—', '✓'],
    ['Widget layouts and colours', '✓', '✓'],
    ['"Verified by AgentBee Kudos" mark', '✓', '✓'],
    ['Price', 'Free', LAUNCH_PRICE]
  ];
  const mail = `mailto:admin@agentbee.net?subject=${encodeURIComponent(`Kudos Pro for ${agent.name}`)}`;
  return (
    <div className="acct-card">
      <h3 style={{ marginTop: 0 }}>{isPro ? "You're on Kudos Pro" : 'Upgrade to Kudos Pro'}</h3>
      <table className="acct-table">
        <thead>
          <tr>
            <th />
            <th>Free</th>
            <th>Kudos Pro</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, free, pro]) => (
            <tr key={label}>
              <td>{label}</td>
              <td>{free}</td>
              <td>
                <strong>{pro}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!isPro && !isOwner && (
        <p className="small muted">Ask your account owner (see the Team tab) to upgrade your agency to Kudos Pro.</p>
      )}
      {!isPro && isOwner && (
        <>
          <p className="small muted">Launch price, available to early members.</p>
          <a className="btn btn-gold btn-lg" href={mail}>
            Upgrade to Kudos Pro
          </a>
          <p className="small muted">Online payment is coming soon. Until then, email us and we'll set you up.</p>
        </>
      )}
    </div>
  );
}

function TeamTab({ sb, agent, onLeft }) {
  const [team, setTeam] = useState(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const run = async (fn, args, ok) => {
    setError('');
    setMsg('');
    setBusy(true);
    const { data, error: e } = await sb.rpc(fn, args);
    setBusy(false);
    if (e) return setError(e.message);
    if (fn === 'kudos_leave_team') return onLeft(data);
    setTeam(data);
    if (ok) setMsg(ok);
  };

  useEffect(() => {
    run('kudos_team');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!team) return <p className="muted">{error || 'Loading team…'}</p>;

  const invite = (e) => {
    e.preventDefault();
    run('kudos_invite_member', { p_email: email }, `Invitation sent to ${email.trim()}.`).then(() => setEmail(''));
  };
  const date = (d) => (d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

  return (
    <div className="acct-card">
      <h3 style={{ marginTop: 0 }}>People who can manage {agent.name}</h3>
      <p className="muted small">
        Everyone on the team can add awards and change the website widget. Colleagues who sign in with an email at your
        agency's website domain join automatically; anyone else needs an invitation.
      </p>
      <ul className="acct-awards">
        {team.members.map((m) => (
          <li key={m.id}>
            <div>
              <strong>{m.email}</strong>
              {m.id === team.me && <span className="muted"> (you)</span>}
              <div className="muted small">
                {m.role === 'owner' ? 'Owner' : 'Member'}
                {m.joined ? ` · joined ${date(m.joined)}` : ''}
              </div>
            </div>
            {team.can_manage && m.role !== 'owner' && (
              <button
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => window.confirm(`Remove ${m.email} from the team?`) && run('kudos_remove_member', { p_account_id: m.id })}
              >
                Remove
              </button>
            )}
          </li>
        ))}
        {team.invites.map((i) => (
          <li key={i.id}>
            <div>
              <strong>{i.email}</strong>
              <div className="muted small">Invited {date(i.created_at)} · waiting for them to sign in</div>
            </div>
            {team.can_manage && (
              <button className="btn btn-ghost" disabled={busy} onClick={() => run('kudos_cancel_invite', { p_invite_id: i.id })}>
                Cancel
              </button>
            )}
          </li>
        ))}
      </ul>

      {team.can_manage ? (
        <form className="acct-invite" onSubmit={invite}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@email.com" required />
          <button className="btn btn-gold" disabled={busy}>
            Send invitation
          </button>
        </form>
      ) : (
        <p className="small muted">
          Only the owner can invite or remove people.{' '}
          <button
            className="acct-link"
            disabled={busy}
            onClick={() => window.confirm('Leave this team? You will lose access to this agency.') && run('kudos_leave_team')}
          >
            Leave this team
          </button>
        </p>
      )}
      {msg && <p className="small acct-msg">{msg}</p>}
      {error && <p className="acct-error">{error}</p>}
    </div>
  );
}
