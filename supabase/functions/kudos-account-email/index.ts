// kudos-account-email: sends one queued Kudos account email via Postmark.
// Called by the kudos_account_emails insert trigger with {"id": "<row id>"}. It only ever
// sends rows that are still 'pending', so calling it again (or by anyone) can't resend.
//
// Kinds: welcome (account approved / joined a team), invite (owner invited a colleague),
//        claim_pending (alert to admin@agentbee.net).
// Env: POSTMARK_API_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const POSTMARK_TOKEN = Deno.env.get('POSTMARK_API_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE = 'https://kudos.agentbee.net';
const ACCOUNT_URL = `${SITE}/account`;
const FROM = 'Kudos by AgentBee <notifications@agentbee.net>';

const esc = (t: unknown) =>
  String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// Reserved test domains never get real mail.
const isTestAddress = (e: string) => /@(example\.(com|org|net)|[^@]+\.(test|invalid|example))$/i.test(e);

const button = (href: string, label: string) =>
  `<p style="margin:24px 0;"><a href="${href}" style="background:#e0a83a;color:#fff;padding:12px 22px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">${esc(label)}</a></p>`;

const layout = (body: string) => `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1f2430;max-width:560px;">
${body}
<p style="color:#6b7280;font-size:12px;margin-top:32px;border-top:1px solid #eee;padding-top:12px;">Kudos by AgentBee · verified awards for international student recruitment agents · <a href="${SITE}" style="color:#6b7280;">kudos.agentbee.net</a></p>
</div>`;

type Email = { subject: string; html: string; text: string; stream?: string };

function welcome(agency: string, embedKey: string | null, role: string): Email {
  const snippet = embedKey ? `<script src="${SITE}/embed.js" data-key="${embedKey}" async></script>` : '';
  const joined = role === 'member' ? `You've joined the team managing <strong>${esc(agency)}</strong>` : `You're now managing <strong>${esc(agency)}</strong>`;
  const html = layout(`<p>Hi,</p>
<p>${joined} on Kudos, AgentBee's directory of verified agent awards.</p>
<p>In your account you can add your awards, choose how your awards widget looks, and preview it on desktop and mobile.</p>
${button(ACCOUNT_URL, 'Open your Kudos account')}
${snippet ? `<p><strong>Show your verified awards on your website</strong><br>Paste this code where you'd like your awards to appear:</p>
<pre style="background:#0f172a;color:#e2e8f0;padding:12px 14px;border-radius:8px;font-size:12px;white-space:pre-wrap;word-break:break-all;">${esc(snippet)}</pre>` : ''}
<p>To sign in again, go to <a href="${ACCOUNT_URL}">${ACCOUNT_URL.replace('https://', '')}</a> and enter this email address. We'll email you a sign-in link; there's no password.</p>`);
  const text = `${role === 'member' ? "You've joined the team managing" : "You're now managing"} ${agency} on Kudos.

Open your Kudos account: ${ACCOUNT_URL}
${snippet ? `\nShow your verified awards on your website by pasting this code:\n${snippet}\n` : ''}
To sign in again, go to ${ACCOUNT_URL} and enter this email address.`;
  return { subject: `Your Kudos account for ${agency} is ready`, html, text };
}

function invite(agency: string, inviter: string, to: string): Email {
  const html = layout(`<p>Hi,</p>
<p><strong>${esc(inviter)}</strong> has invited you to help manage <strong>${esc(agency)}</strong> on Kudos, AgentBee's directory of verified agent awards.</p>
${button(ACCOUNT_URL, 'Accept invitation')}
<p>Sign in with <strong>${esc(to)}</strong> and you'll be added to the team straight away. We'll email you a sign-in link; there's no password.</p>
<p style="color:#6b7280;font-size:13px;">Not expecting this? You can ignore this email.</p>`);
  const text = `${inviter} has invited you to help manage ${agency} on Kudos.

Accept: ${ACCOUNT_URL}
Sign in with ${to} and you'll be added to the team straight away.`;
  return { subject: `${inviter} invited you to ${agency} on Kudos`, html, text };
}

function claimPending(p: Record<string, string>, accountId: string): Email {
  const sql = `select kudos_review_claim('${accountId}', true);`;
  const html = `<p>A Kudos claim is waiting for approval.</p>
<table cellpadding="6" style="border-collapse:collapse;font-size:14px;">
<tr><td style="color:#6b7280;">Agency</td><td><strong>${esc(p.agency)}</strong>${p.new_agency ? ' (not on Kudos yet)' : ''}</td></tr>
<tr><td style="color:#6b7280;">Website</td><td>${esc(p.website || '—')}</td></tr>
${p.country ? `<tr><td style="color:#6b7280;">Country</td><td>${esc(p.country)}</td></tr>` : ''}
<tr><td style="color:#6b7280;">Requested by</td><td>${esc(p.email)}</td></tr>
</table>
<p>The email domain didn't match the agency's website, so it needs a manual check.</p>
<p>To approve, run this in the Supabase SQL editor${p.new_agency ? " (create or find the agent first and add its id as a third argument: <code>kudos_review_claim('…', true, '&lt;agent id&gt;')</code>)" : ''}:</p>
<pre style="background:#f5f7fb;padding:10px;border-radius:6px;">${esc(sql)}</pre>
<p>To reject: <code>select kudos_review_claim('${esc(accountId)}', false);</code></p>`;
  const text = `Kudos claim waiting for approval.\nAgency: ${p.agency}${p.new_agency ? ' (not on Kudos yet)' : ''}\nWebsite: ${p.website || '-'}\nRequested by: ${p.email}\n\nApprove: ${sql}\nReject: select kudos_review_claim('${accountId}', false);`;
  return { subject: `Kudos: claim waiting for approval – ${p.agency}`, html, text };
}

Deno.serve(async (req) => {
  let id = '';
  try {
    id = (await req.json())?.id ?? '';
  } catch { /* empty body */ }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Missing id', { status: 400 });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: row, error } = await sb.from('kudos_account_emails').select('*').eq('id', id).single();
  if (error || !row) return new Response('Not found', { status: 404 });
  if (row.status !== 'pending') return new Response(`Already ${row.status}`, { status: 200 });

  const mark = (patch: Record<string, unknown>) => sb.from('kudos_account_emails').update(patch).eq('id', id).eq('status', 'pending');

  if (isTestAddress(row.to_email)) {
    await mark({ status: 'skipped', error: 'test address' });
    return new Response('Skipped test address', { status: 200 });
  }

  const p = row.payload ?? {};
  let agency = p.agency ?? '';
  if (!agency && row.agent_id) {
    const { data: a } = await sb.from('agents').select('agency_name').eq('id', row.agent_id).single();
    agency = a?.agency_name ?? 'your agency';
  }

  let email: Email;
  if (row.kind === 'welcome') {
    const { data: e } = await sb
      .from('kudos_embeds').select('embed_key')
      .eq('agent_id', row.agent_id).not('account_id', 'is', null)
      .order('created_at').limit(1).maybeSingle();
    email = welcome(agency, e?.embed_key ?? null, p.role ?? 'owner');
  } else if (row.kind === 'invite') {
    email = invite(agency, p.inviter ?? 'A colleague', row.to_email);
  } else {
    email = claimPending({ ...p, agency }, row.account_id ?? '');
  }

  const res = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Postmark-Server-Token': POSTMARK_TOKEN },
    body: JSON.stringify({
      From: FROM,
      To: row.to_email,
      Subject: email.subject,
      HtmlBody: email.html,
      TextBody: email.text,
      MessageStream: 'outbound',
      Tag: `kudos-${row.kind}`,
    }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || out.ErrorCode) {
    await mark({ status: 'failed', error: String(out.Message ?? res.status).slice(0, 500) });
    return new Response(`Postmark error: ${out.Message ?? res.status}`, { status: 502 });
  }
  await mark({ status: 'sent', sent_at: new Date().toISOString(), postmark_message_id: out.MessageID ?? null });
  return new Response('Sent', { status: 200 });
});
