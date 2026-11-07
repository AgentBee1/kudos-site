/*!
 * Kudos by AgentBee – verified awards widget
 * <script src="https://kudos.agentbee.net/embed.js" data-key="kd_..." async></script>
 * Optional: data-layout="wall|carousel|badge", data-theme="light|dark", data-accent="#hex"
 */
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script || !script.parentNode || !script.getAttribute('data-key')) return;

  var BASE = new URL(script.src).origin;
  var KEY = script.getAttribute('data-key');

  var host = document.createElement('div');
  host.className = 'kudos-widget';
  host.style.display = 'block';
  script.parentNode.insertBefore(host, script);
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeUrl(u) {
    return /^https:\/\//i.test(u || '') ? u : '#';
  }
  function hex(c, fallback) {
    return /^#[0-9a-f]{6}$/i.test(c || '') ? c : fallback;
  }

  var TROPHY =
    '<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18"><path fill="currentColor" d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.35A5 5 0 0 1 13 14.9V17h3v2H8v-2h3v-2.1A5 5 0 0 1 8.35 12H8a4 4 0 0 1-4-4V5h3V3Zm0 4H6v1a2 2 0 0 0 1.2 1.83A5 5 0 0 1 7 8.9V7Zm10 0v1.9c0 .32-.03.63-.08.93A2 2 0 0 0 18 8V7h-1ZM9 5v3.9a3 3 0 0 0 6 0V5H9Z"/></svg>';
  var CHECK =
    '<svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14"><path fill="currentColor" d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.9-4.9 1.4 1.4-6.3 6.3Z"/></svg>';

  var CSS =
    ':host{all:initial;display:block;font-family:inherit}' +
    '*{box-sizing:border-box}' +
    '.v{--bg:#fff;--card:#fff;--line:#e6eaf2;--ink:#1f2430;--muted:#6b7280;--chip:#f5f7fb;font-family:inherit;color:var(--ink);line-height:1.4}' +
    '.v.dark{--bg:#111827;--card:#1f2937;--line:#2d3748;--ink:#f3f4f6;--muted:#9ca3af;--chip:#1f2937}' +
    '.kw{background:var(--bg);border:1px solid var(--line);border-radius:16px;padding:20px;font-size:15px}' +
    'a{color:inherit;text-decoration:none}' +
    '.head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}' +
    '.who{display:flex;align-items:center;gap:12px;min-width:0}' +
    '.logo{width:44px;height:44px;border-radius:10px;object-fit:contain;background:#fff;border:1px solid var(--line)}' +
    '.eyebrow{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--a);font-weight:700}' +
    '.title{font-size:18px;font-weight:700;margin-top:2px}' +
    '.verified{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--muted);background:var(--chip);border:1px solid var(--line);border-radius:999px;padding:5px 10px;white-space:nowrap}' +
    '.verified svg{color:#16a34a}' +
    '.verified:hover{color:var(--ink)}' +
    '.year{font-size:13px;font-weight:700;color:var(--muted);margin:16px 0 8px;display:flex;align-items:center;gap:8px}' +
    '.year:first-of-type{margin-top:0}' +
    '.year:after{content:"";flex:1;height:1px;background:var(--line)}' +
    '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}' +
    '.card{display:flex;gap:10px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-top:3px solid var(--a);border-radius:12px;padding:12px;transition:transform .15s,box-shadow .15s}' +
    '.card:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(20,40,80,.12)}' +
    '.ico{color:var(--a);flex:none;margin-top:1px}' +
    '.aw{font-weight:700;font-size:14px}' +
    '.iss{font-size:13px;color:var(--muted);margin-top:2px}' +
    '.dt{font-size:12px;color:var(--muted);margin-top:4px}' +
    '.more{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:14px;padding:10px;border:1px dashed var(--a);border-radius:12px;font-weight:600;font-size:14px;color:var(--ink)}' +
    '.more:hover{background:var(--chip)}' +
    '.foot{margin-top:14px;font-size:12px;color:var(--muted);text-align:right}' +
    '.foot a{font-weight:600;color:var(--ink)}' +
    '.row{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding-bottom:2px}' +
    '.row::-webkit-scrollbar{display:none}' +
    '.row .card,.row .more{flex:0 0 240px;scroll-snap-align:start;margin-top:0}' +
    '.nav{display:flex;gap:6px}' +
    '.nav button{all:unset;cursor:pointer;width:30px;height:30px;border-radius:50%;border:1px solid var(--line);display:grid;place-items:center;color:var(--ink);background:var(--card);font-size:16px}' +
    '.nav button:hover{border-color:var(--a)}' +
    '.badge{display:inline-flex;align-items:center;gap:10px;background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:8px 14px 8px 10px;font-family:inherit;color:var(--ink);line-height:1.2}' +
    '.badge .ico{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--chip);margin:0}' +
    '.badge b{font-size:16px}' +
    '.badge small{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted);font-weight:600}' +
    '.badge small svg{color:#16a34a}' +
    '.badge:hover{border-color:var(--a)}';

  function card(a) {
    return (
      '<a class="card" href="' + esc(safeUrl(a.url)) + '" target="_blank" rel="noopener" data-award="' + esc(a.id) + '">' +
      '<span class="ico">' + TROPHY + '</span><span>' +
      '<div class="aw">' + esc(a.title) + '</div>' +
      '<div class="iss">' + esc(a.issuer) + '</div>' +
      (a.dateLabel ? '<div class="dt">' + esc(a.dateLabel) + '</div>' : '') +
      '</span></a>'
    );
  }

  function moreLink(d) {
    if (!d.hidden) return '';
    return (
      '<a class="more" href="' + esc(safeUrl(d.agent.url)) + '" target="_blank" rel="noopener">+' + d.hidden +
      ' more verified award' + (d.hidden === 1 ? '' : 's') + ' on Kudos →</a>'
    );
  }

  function header(d, extra) {
    return (
      '<div class="head"><div class="who">' +
      (d.agent.logo ? '<img class="logo" src="' + esc(safeUrl(d.agent.logo)) + '" alt="">' : '') +
      '<div><div class="eyebrow">Awards &amp; Recognition</div><div class="title">' + esc(d.agent.name) + '</div></div></div>' +
      (extra || '<a class="verified" href="' + esc(safeUrl(d.agent.url)) + '" target="_blank" rel="noopener">' + CHECK + 'Verified by AgentBee Kudos</a>') +
      '</div>'
    );
  }

  function footer(d) {
    return (
      '<div class="foot">Awards independently verified by <a href="' + esc(safeUrl(d.agent.url)) +
      '" target="_blank" rel="noopener">AgentBee Kudos</a></div>'
    );
  }

  function wall(d) {
    var html = header(d);
    var year = null;
    var open = false;
    d.awards.forEach(function (a) {
      if (a.year !== year) {
        if (open) html += '</div>';
        year = a.year;
        html += '<div class="year">' + esc(year || 'Undated') + '</div><div class="grid">';
        open = true;
      }
      html += card(a);
    });
    if (open) html += '</div>';
    return html + moreLink(d) + footer(d);
  }

  function carousel(d) {
    var nav = '<div class="nav"><button type="button" data-dir="-1" aria-label="Previous">‹</button><button type="button" data-dir="1" aria-label="Next">›</button></div>';
    var html = header(d, nav) + '<div class="row">';
    d.awards.forEach(function (a) { html += card(a); });
    html += moreLink(d) + '</div>';
    return html + footer(d);
  }

  function badge(d) {
    return (
      '<a class="badge" href="' + esc(safeUrl(d.agent.url)) + '" target="_blank" rel="noopener">' +
      '<span class="ico">' + TROPHY + '</span><span><b>' + d.total + '</b> verified award' + (d.total === 1 ? '' : 's') +
      '<small>' + CHECK + 'AgentBee Kudos</small></span></a>'
    );
  }

  function render(d) {
    var s = d.settings || {};
    var layout = script.getAttribute('data-layout') || s.layout || 'wall';
    var theme = script.getAttribute('data-theme') || s.theme || 'light';
    var accent = hex(script.getAttribute('data-accent'), hex(s.accent, '#e0a83a'));
    if (!d.awards.length && layout !== 'badge') return;

    var dark = theme === 'dark' ? ' dark' : '';
    var style = '<style>' + CSS + '</style>';
    if (layout === 'badge') {
      host.style.display = 'inline-block';
      root.innerHTML = style + '<span class="v' + dark + '" style="display:inline-block;--a:' + accent + '">' + badge(d) + '</span>';
    } else {
      var body = layout === 'carousel' ? carousel(d) : wall(d);
      root.innerHTML = style + '<div class="v kw' + dark + '" style="--a:' + accent + '">' + body + '</div>';
    }

    var row = root.querySelector('.row');
    root.querySelectorAll('.nav button').forEach(function (b) {
      b.addEventListener('click', function () {
        row.scrollBy({ left: Number(b.getAttribute('data-dir')) * 250, behavior: 'smooth' });
      });
    });

    root.querySelectorAll('a[data-award]').forEach(function (a) {
      a.addEventListener('click', function () {
        var payload = JSON.stringify({ key: KEY, award_id: a.getAttribute('data-award') });
        if (navigator.sendBeacon) navigator.sendBeacon(BASE + '/api/widget', payload);
      });
    });
  }

  var preview = script.getAttribute('data-preview') === 'pro' ? '&preview=pro' : '';
  fetch(BASE + '/api/widget?key=' + encodeURIComponent(KEY) + preview)
    .then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
        return d;
      });
    })
    .then(render)
    .catch(function (e) {
      if (window.console) console.warn('Kudos widget:', e.message);
    });
})();
