import { revalidateTag } from 'next/cache';
import { getAwards, SITE_URL } from '../../../lib/data';

// Called by AgentBee's award-notification function right after an award is saved, so the
// home page, agent profile and award page show it within seconds instead of 10 minutes.
//
// No secret is needed: it only refreshes the public cache, and only for an award that
// genuinely exists and was added in the last few hours, so it can't be used to hammer
// the site or Supabase.
const RECENT_MS = 6 * 60 * 60 * 1000;

export async function POST(req) {
  let awardId;
  try {
    ({ award_id: awardId } = await req.json());
  } catch {
    return Response.json({ ok: false, error: 'Expected JSON body with award_id' }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(awardId || '')) {
    return Response.json({ ok: false, error: 'Invalid award_id' }, { status: 400 });
  }

  const awards = await getAwards({ fresh: true });
  const award = awards.find((a) => a.award_id === awardId);
  if (!award) return Response.json({ ok: false, error: 'Award not found' }, { status: 404 });

  const age = Date.now() - new Date(award.created_at).getTime();
  if (!(age >= 0 && age < RECENT_MS)) {
    return Response.json({ ok: false, error: 'Only recently added awards can be refreshed' }, { status: 409 });
  }

  revalidateTag('kudos');
  return Response.json({ ok: true, url: `${SITE_URL}/award/${award.award_slug}` });
}
