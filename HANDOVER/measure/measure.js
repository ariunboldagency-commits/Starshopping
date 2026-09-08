// Deep-link timeline measurement against the live shop.
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');

const ORIGIN = process.env.ORIGIN || 'https://starshopping-mn.github.io';
const SLUG = 'Huuhdiin-hashiwch';
const OUT = process.env.OUT || 'out';
fs.mkdirSync(OUT, { recursive: true });

const catalog = JSON.parse(fs.readFileSync('data/catalog.json', 'utf8'));
const staleCatalog = { ...catalog, products: catalog.products.filter(p => p.slug !== SLUG) };

const INIT = `
  window.__log = [];
  const log = (ev, extra) => window.__log.push({ t: Math.round(performance.now()), ev, extra: extra === undefined ? '' : String(extra), hash: location.hash });
  log('init');
  const origFetch = window.fetch;
  window.fetch = function (u, o) {
    const url = String(u);
    const short = url.includes('script.google') ? 'FEED' : url.includes('catalog.json') ? 'FALLBACK' : url.slice(0, 60);
    log('fetch:start', short);
    return origFetch.apply(this, arguments).then(r => { log('fetch:done', short + ' ' + r.status); return r; }, e => { log('fetch:fail', short + ' ' + e.name); throw e; });
  };
  document.addEventListener('DOMContentLoaded', () => {
    log('DOMContentLoaded');
    const main = document.querySelector('main');
    const state = () => Array.from(document.querySelectorAll('.view')).filter(v => !v.hidden).map(v => v.id).join(',');
    log('visible', state());
    new MutationObserver(() => log('visible', state())).observe(main, { attributes: true, attributeFilter: ['hidden'], subtree: true });
    const pdp = document.getElementById('pdp');
    new MutationObserver(() => { const c = pdp.firstElementChild; log('pdp', c ? (c.className || c.tagName) : 'empty'); }).observe(pdp, { childList: true });
    new MutationObserver(() => log('title', document.title)).observe(document.querySelector('title'), { childList: true, characterData: true, subtree: true });
  });
  window.addEventListener('load', () => log('load'));
  // sampler: what is actually pinned / scrolled
  setInterval(() => {
    const pins = window.ScrollTrigger ? ScrollTrigger.getAll().filter(t => t.vars.pin).length : -1;
    log('sample', 'pins=' + pins + ' scrollY=' + Math.round(scrollY) + ' heroCamTransform=' + (document.querySelector('.hero__cam img') ? getComputedStyle(document.querySelector('.hero__cam img')).transform.slice(0, 30) : 'n/a'));
  }, 250);
`;

const THROTTLE = {
  none: null,
  // Chrome DevTools "Fast 3G" preset
  fast3g: { offline: false, latency: 562.5, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 },
};

async function run(name, { url, cache, throttle, shots }) {
  const browser = await chromium.launch({
    proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' },
  });
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const consoleMsgs = [];
  page.on('console', m => consoleMsgs.push(`[${m.type()}] ${m.text().slice(0, 160)}`));
  page.on('pageerror', e => consoleMsgs.push(`[pageerror] ${String(e).slice(0, 200)}`));
  // keep the pixel out of the picture — it is a third party and not what we measure
  await page.route(/connect\.facebook\.net|facebook\.com\/tr/, r => r.abort());
  const th = THROTTLE[throttle];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await page.route(/(http:\/\/127\.0\.0\.1:8777\/)|https:\/\/(starshopping-mn\.github\.io|script\.google\.com|script\.googleusercontent\.com|drive\.google\.com|lh3\.googleusercontent\.com)\//, async route => {
    try {
      const t = Date.now();
      const r = await route.fetch({ maxRedirects: 5 });
      const body = await r.body();
      if (th) {
        // one round trip of latency, then the bytes at the link speed
        const want = th.latency + (body.length / th.downloadThroughput) * 1000;
        const spent = Date.now() - t;
        if (want > spent) await sleep(want - spent);
      }
      await route.fulfill({ response: r, body });
    } catch (e) { try { await route.abort(); } catch {} }
  });

  if (cache) {
    await page.goto(ORIGIN + '/diag.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['ss_catalog_v3', JSON.stringify(cache)]);
  }
  await page.addInitScript(INIT);

  const t0 = Date.now();
  const nav = page.goto(url, { waitUntil: 'commit' });
  const shotAt = shots ? [400, 1000, 2000, 3500, 6000, 9000] : [];
  const shotP = shotAt.map(ms => new Promise(res => setTimeout(async () => {
    try { await page.screenshot({ path: `${OUT}/${name}-${ms}ms.png` }); } catch (e) {}
    res();
  }, ms)));
  await nav;
  await Promise.all(shotP);
  await page.waitForTimeout(shots ? 500 : 9500);
  const log = await page.evaluate(() => window.__log);
  const finalUrl = page.url();
  const heroImg = await page.evaluate(() => { const e = performance.getEntriesByType('resource').find(r => /hero-camera/.test(r.name)); return e ? Math.round(e.responseEnd) + 'ms ' + Math.round(e.transferSize/1024) + 'KB' : 'not fetched'; });
  const navT = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return n ? { ttfb: Math.round(n.responseStart), domInteractive: Math.round(n.domInteractive), load: Math.round(n.loadEventEnd), redirects: n.redirectCount } : null; });
  await browser.close();
  const out = { name, url, finalUrl, throttle, cache: cache ? (cache.products.length + ' products in cache') : 'none', navT, wall: Date.now() - t0, log: log.filter(l => l.ev !== 'sample'), samples: log.filter(l => l.ev === 'sample'), console: consoleMsgs };
  fs.writeFileSync(`${OUT}/${name}.json`, JSON.stringify(out, null, 1));
  // compact print
  console.log(`\n=== ${name} (${throttle}, cache: ${out.cache}) -> ${finalUrl}`);
  console.log('nav:', JSON.stringify(navT), 'hero image:', heroImg);
  for (const l of out.log) if (['visible', 'pdp', 'fetch:start', 'fetch:done', 'fetch:fail', 'DOMContentLoaded', 'load', 'init'].includes(l.ev)) console.log(`${String(l.t).padStart(6)}ms  ${l.ev.padEnd(12)} ${l.extra}  ${l.hash}`);
  const firstPin = out.samples.find(s => /pins=[1-9]/.test(s.extra));
  console.log('first sample with a pin:', firstPin ? firstPin.t + 'ms ' + firstPin.extra : 'never');
  if (consoleMsgs.length) console.log('console:', consoleMsgs.slice(0, 6).join(' | '));
}

(async () => {
  const which = (process.argv[2] || 'all');
  const S = {
    A_cold_spa:      { url: `${ORIGIN}/#/p/${SLUG}`, cache: null,          throttle: 'none' },
    B_cold_card:     { url: `${ORIGIN}/p/${SLUG}/`,  cache: null,          throttle: 'none', shots: true },
    C_stale_cache:   { url: `${ORIGIN}/#/p/${SLUG}`, cache: staleCatalog,  throttle: 'none' },
    D_fresh_cache:   { url: `${ORIGIN}/#/p/${SLUG}`, cache: catalog,       throttle: 'none' },
    E_cold_card_3g:  { url: `${ORIGIN}/p/${SLUG}/`,  cache: null,          throttle: 'fast3g', shots: true },
    F_stale_3g:      { url: `${ORIGIN}/#/p/${SLUG}`, cache: staleCatalog,  throttle: 'fast3g' },
    L_cold_3g:       { url: `${ORIGIN}/#/p/${SLUG}`, cache: null,          throttle: 'fast3g', shots: true },
    L_home_3g:       { url: `${ORIGIN}/`,            cache: null,          throttle: 'fast3g' },
    L_cat_3g:        { url: `${ORIGIN}/#/c/huuhdiin-heregsel`, cache: null, throttle: 'fast3g', shots: true },
    L_stale_3g:      { url: `${ORIGIN}/#/p/${SLUG}`, cache: staleCatalog,  throttle: 'fast3g' },
  };
  for (const [k, v] of Object.entries(S)) if (which === 'all' || which === k) await run(k, v);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
