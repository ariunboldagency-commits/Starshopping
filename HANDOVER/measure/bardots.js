const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
  for (const [w, h] of [[390, 520]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.route(/connect\.facebook\.net|facebook\.com\/tr/, r => r.abort());
    await page.route(/^http:\/\/127\.0\.0\.1:8777\//, async route => { try { const r = await route.fetch(); await route.fulfill({ response: r, body: await r.body() }); } catch (e) { try { await route.abort(); } catch {} } });
    await page.route(/script\.google\.com/, async route => { try { const r = await route.fetch(); await route.fulfill({ response: r, body: await r.body() }); } catch (e) { try { await route.abort(); } catch {} } });
    await page.goto(`http://127.0.0.1:8777/#/p/Huuhdiin-hashiwch`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const state = () => page.evaluate(() => { const bar = document.querySelector('#stickyBuy'); const d = document.querySelector('.pdp__dots').getBoundingClientRect(); const bb = bar.getBoundingClientRect(); return { scrollY: Math.round(scrollY), dotsTop: Math.round(d.top), dotsBottom: Math.round(d.bottom), barTop: bar.hidden ? null : Math.round(bb.top), barVisible: !bar.hidden }; });
    const dotsY = await page.evaluate(() => document.querySelector('.pdp__dots').getBoundingClientRect().top + scrollY);
    const out = [];
    for (const y of [0, 30, 90, 200]) {
      await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y);
      await page.waitForTimeout(350);
      out.push(await state());
    }
    // a tap on the dots where they sit in the band must reach the dots, not the bar
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), 0);
    await page.waitForTimeout(350);
    const hit = await page.evaluate(() => { const d = document.querySelectorAll('.pdot')[2].getBoundingClientRect(); const el = document.elementFromPoint(d.left + d.width / 2, d.top + d.height / 2); return el ? el.className : null; });
    console.log(`=== ${w}x${h}`); out.forEach(o => console.log(JSON.stringify(o))); console.log('element under a dot in the band:', hit);
    await ctx.close();
  }
  await browser.close();
})();
