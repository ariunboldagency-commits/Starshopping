const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const ORIGIN = process.env.ORIGIN || 'https://starshopping-mn.github.io';
(async () => {
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.route(/connect\.facebook\.net|facebook\.com\/tr/, r => r.abort());
  await page.route(/(http:\/\/127\.0\.0\.1:8777\/)|https:\/\/(starshopping-mn\.github\.io|script\.google\.com|script\.googleusercontent\.com|drive\.google\.com)\//, async route => { try { const r = await route.fetch({ maxRedirects: 5 }); await route.fulfill({ response: r, body: await r.body() }); } catch (e) { try { await route.abort(); } catch {} } });
  await page.goto(ORIGIN + '/', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const geo = await page.evaluate(() => { const h = ScrollTrigger.getAll().find(t => t.vars.pin && t.trigger.id === 'hero'); const c = ScrollTrigger.getAll().find(t => t.vars.pin && t.trigger.id === 'cats'); return { heroEnd: h.end, catsStart: c.start, catsEnd: c.end, vh: innerHeight }; });
  console.log('geometry', JSON.stringify(geo));
  // real scrolling, wait past the 0.5s scrub each time, and ask what is on screen
  const stops = [0.3, 0.45, 0.6, 0.75, 0.9, 1.0].map(f => ['hero', f, Math.round(geo.heroEnd * f)]).concat([[ 'cats', 0.3, Math.round(geo.catsStart + (geo.catsEnd - geo.catsStart) * 0.3)], ['cats', 0.7, Math.round(geo.catsStart + (geo.catsEnd - geo.catsStart) * 0.7)]]);
  for (const [sec, f, y] of stops) {
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y);
    await page.waitForTimeout(900);
    const s = await page.evaluate(() => {
      const img = document.querySelector('.hero__cam img'); const b = img.getBoundingClientRect();
      const em = document.querySelector('.cats__emerge');
      return { scale: (getComputedStyle(img).transform.match(/matrix\(([\d.]+)/) || [0, '1'])[1], veil: getComputedStyle(document.querySelector('.hero__veil')).opacity, camBottom: Math.round(b.bottom), emergeOpacity: getComputedStyle(em).opacity, emergeScale: (getComputedStyle(em).transform.match(/matrix\(([\d.]+)/) || [0, '1'])[1] };
    });
    await page.screenshot({ path: `out/dead-${sec}-${f}.png` });
    console.log(`${sec} ${f} y=${y}`, JSON.stringify(s));
  }
  await browser.close();
})().catch(e => { console.error('ERR', e); process.exit(1); });
