// Turns an award's source link into the platform's official embed (LinkedIn, Instagram,
// Facebook). Returns null when the link can't be embedded, so the page falls back to a link.

async function expandShortLink(url) {
  // lnkd.in short links redirect to the full LinkedIn post URL. Skipped during the build
  // (pages are then filled in on first visit) and capped at 4 seconds so it can never stall.
  if (process.env.NEXT_PHASE === 'phase-production-build') return url;
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(4000), next: { revalidate: 86400 } });
    if (res.url && res.url !== url) return res.url;
    // Some short links answer with an interstitial page instead of a redirect.
    const html = await res.text();
    const m = html.match(/https:\/\/www\.linkedin\.com\/(?:posts|feed\/update)\/[^"'<>\s]+/);
    return m ? m[0].replace(/&amp;/g, '&') : url;
  } catch {
    return url;
  }
}

function linkedInUrn(url) {
  const m =
    url.match(/urn:li:(activity|ugcPost|share):(\d+)/) ||
    url.match(/(activity|ugcPost|share)[-:](\d{15,})/);
  return m ? `urn:li:${m[1]}:${m[2]}` : null;
}

export async function getPostEmbed(sourceUrl) {
  if (!sourceUrl) return null;
  let url = sourceUrl;
  let host;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }

  if (host === 'lnkd.in') {
    url = await expandShortLink(url);
    host = 'linkedin.com';
  }

  if (host.endsWith('linkedin.com')) {
    const urn = linkedInUrn(url);
    if (!urn) return null;
    return {
      platform: 'LinkedIn',
      src: `https://www.linkedin.com/embed/feed/update/${urn}`,
      height: 680
    };
  }

  if (host.endsWith('instagram.com')) {
    const m = url.match(/instagram\.com\/(p|reel)\/([A-Za-z0-9_-]+)/);
    if (!m) return null;
    return {
      platform: 'Instagram',
      src: `https://www.instagram.com/${m[1]}/${m[2]}/embed/captioned/`,
      height: 760
    };
  }

  if (host.endsWith('facebook.com')) {
    const clean = url.split('?')[0].includes('photo.php') ? url : url.split('?')[0];
    return {
      platform: 'Facebook',
      src: `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(clean)}&show_text=true&width=500`,
      height: 640
    };
  }

  return null;
}
