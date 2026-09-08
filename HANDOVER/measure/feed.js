// Does the product page survive the feed landing? Feed is served from the
// offline copy (same) or a modified copy (changed), delayed 5s like the real one.
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:8777';
const SLUG = 'Huuhdiin-hashiwch';
const catalog = JSON.parse(fs.readFileSync('data/catalog.json', 'utf8'));
const changed = JSON.parse(JSON.stringify(catalog));
changed.products.find(p => p.slug === SLUG).price += 1000;

async function run(name, feedBody) {
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/facebook/.test(m.text())) errs.push(m.text()); });
  await page.route(/connect\.facebook\.net|facebook\.com\/tr/, r => r.abort());
  await page.route(/^http:\/\/127\.0\.0\.1:8777\//, async route => { try { const r = await route.fetch(); await route.fulfill({ response: r, body: await r.body() }); } catch (e) { try { await route.abort(); } catch {} } });
  await page.route(/script\.google\.com/, async route => {
    await new Promise(r => setTimeout(r, 5000));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(feedBody) });
  });
  await page.addInitScript(() => {
    window.__redraws = 0;
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver(() => window.__redraws++).observe(document.getElementById('pdp'), { childList: true });
    });
  });
  await page.goto(`${ORIGIN}/#/p/${SLUG}`, { waitUntil: 'load' });
  await page.waitForTimeout(4200); // feed still 0.8s away; gallery has rotated
  const beforeFeed = await page.evaluate(() => {
    const g = document.querySelector('.pdp__gallery');
    g.dataset.probe = 'kept';
    return { index: g.dataset.index, redraws: window.__redraws, price: document.querySelector('.price-now').textContent };
  });
  await page.waitForTimeout(3300); // feed landed at ~5s
  const afterFeed = await page.evaluate(() => {
    const g = document.querySelector('.pdp__gallery');
    return { index: g.dataset.index, probe: g.dataset.probe || 'gone (redrawn)', redraws: window.__redraws, price: document.querySelector('.price-now').textContent, timers: null };
  });
  // does the rotation still run after the feed?
  const i1 = await page.evaluate(() => document.querySelector('.pdp__gallery').dataset.index);
  await page.waitForTimeout(3000);
  const i2 = await page.evaluate(() => document.querySelector('.pdp__gallery').dataset.index);
  console.log(`\n=== ${name}`);
  console.log('before feed:', JSON.stringify(beforeFeed));
  console.log('after feed: ', JSON.stringify(afterFeed));
  console.log('rotation after feed:', i1, '->', i2, i1 !== i2 ? '(still rotating)' : '(STOPPED)');
  console.log('errors:', errs.length ? errs.join(' | ') : 'none');
  await browser.close();
}
(async () => {
  await run('feed same as offline copy', catalog);
  if (!process.env.ONLY_SAME) await run('feed changed (price +1000)', changed);
})().catch(e => { console.error('ERR', e); process.exit(1); });
