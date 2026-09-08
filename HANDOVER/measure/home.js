// Home page health: console errors, zoom invariants from CLAUDE.md §6, pin gap, at three viewports.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const ORIGIN = process.env.ORIGIN || 'https://starshopping-mn.github.io';
const VIEWPORTS = [[1280, 800, false], [390, 844, true], [390, 600, true]];
(async () => {
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
  for (const [w, h, mobile] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(`[${m.type()}] ${m.text().slice(0, 140)}`); });
    page.on('pageerror', e => errs.push(`[pageerror] ${String(e).slice(0, 200)}`));
    page.on('requestfailed', r => errs.push(`[requestfailed] ${r.url().slice(0, 100)} ${r.failure() && r.failure().errorText}`));
    await page.route(/connect\.facebook\.net|facebook\.com\/tr/, r => r.abort());
    await page.route(/(http:\/\/127\.0\.0\.1:8777\/)|https:\/\/(starshopping-mn\.github\.io|script\.google\.com|script\.googleusercontent\.com|drive\.google\.com|lh3\.googleusercontent\.com)\//, async route => {
      try { const r = await route.fetch({ maxRedirects: 5 }); await route.fulfill({ response: r, body: await r.body() }); } catch (e) { try { await route.abort(); } catch {} }
    });
    await page.goto(ORIGIN + '/', { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const out = {};
      const pin = ScrollTrigger.getAll().find(t => t.vars.pin && t.trigger && t.trigger.id === 'hero');
      const cats = ScrollTrigger.getAll().find(t => t.vars.pin && t.trigger && t.trigger.id === 'cats');
      const img = document.querySelector('.hero__cam img');
      out.pins = ScrollTrigger.getAll().filter(t => t.vars.pin).length;
      out.heroStart = pin && Math.round(pin.start); out.heroEnd = pin && Math.round(pin.end);
      out.catsStart = cats && Math.round(cats.start);
      out.pinGap = (pin && cats) ? Math.round(cats.start - pin.end) : null;
      window.scrollTo({ top: 0, behavior: 'instant' }); ScrollTrigger.update();
      pin.animation.progress(1).pause();
      const b = img.getBoundingClientRect();
      out.transformAtEnd = getComputedStyle(img).transform;
      out.lensOffY = Math.round(b.top + b.height * 0.875 - innerHeight / 2);
      out.lensOffX = Math.round(b.left + b.width * 0.521 - innerWidth / 2);
      out.veilOpacityAtEnd = getComputedStyle(document.querySelector('.hero__veil')).opacity;
      pin.animation.progress(0).resume();
      out.heroWords = Array.from(document.querySelectorAll('.hero__word')).map(e => ({ t: e.textContent, fs: Math.round(parseFloat(getComputedStyle(e).fontSize)), w: Math.round(e.getBoundingClientRect().width) }));
      out.camImgSize = { w: Math.round(img.getBoundingClientRect().width), h: Math.round(img.getBoundingClientRect().height), natural: img.naturalWidth + 'x' + img.naturalHeight, src: img.currentSrc.split('/').pop() };
      out.docHeight = document.documentElement.scrollHeight;
      out.catsCount = document.querySelectorAll('#catRail > *').length;
      out.fonts = Array.from(document.fonts).filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight).filter((v, i, a) => a.indexOf(v) === i);
      return out;
    });
    // mid-zoom screenshot for the eye: progress 0.5
    await page.evaluate(() => { const pin = ScrollTrigger.getAll().find(t => t.vars.pin && t.trigger.id === 'hero'); window.scrollTo({ top: pin.start + (pin.end - pin.start) * 0.5, behavior: 'instant' }); });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `out/home-${w}x${h}-mid.png` });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(700);
    await page.screenshot({ path: `out/home-${w}x${h}-top.png` });
    console.log(`\n=== home ${w}x${h}`); console.log(JSON.stringify(r, null, 0)); console.log('errors:', errs.length ? errs.join('\n  ') : 'none');
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('ERR', e); process.exit(1); });
