// Product page + order form geometry and validation, on phones.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:8777';
const SLUG = process.env.SLUG || 'Huuhdiin-hashiwch';
const OUT = process.env.OUT || 'out';
const VIEWPORTS = [[390, 844], [390, 600]];
const box = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) }; };
(async () => {
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
  for (const [w, h] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && !/facebook|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
    await page.route(/connect\.facebook\.net|facebook\.com\/tr/, r => r.abort());
    await page.route(/^http:\/\/127\.0\.0\.1:8777\//, async route => { try { const r = await route.fetch(); await route.fulfill({ response: r, body: await r.body() }); } catch (e) { try { await route.abort(); } catch {} } });
    // the sheet is never written to from here: the order POST is answered locally
    let posted = null;
    await page.route(/script\.google\.com/, async route => {
      if (route.request().method() === 'POST') { posted = JSON.parse(route.request().postData()); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, code: 'SS-TEST' }) }); }
      try { const r = await route.fetch(); await route.fulfill({ response: r, body: await r.body() }); } catch (e) { try { await route.abort(); } catch {} }
    });
    await page.goto(`${ORIGIN}/#/p/${SLUG}`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const g = () => page.evaluate((box) => {
      const q = (s) => document.querySelector(s);
      const bar = q('#stickyBuy');
      const barBox = bar && !bar.hidden ? bar.getBoundingClientRect() : null;
      const ctrl = [...document.querySelectorAll('.gnav, .pdp__dots')].map(e => e.getBoundingClientRect());
      const overlap = barBox ? ctrl.some(c => c.bottom > barBox.top && c.top < barBox.bottom) : false;
      return {
        docHeight: document.documentElement.scrollHeight, scrollY: Math.round(scrollY),
        buyTop: q('#buyBtn') ? Math.round(q('#buyBtn').getBoundingClientRect().top + scrollY) : null,
        barVisible: !!barBox, barTop: barBox ? Math.round(barBox.top) : null, barHeight: barBox ? Math.round(barBox.height) : null,
        barText: bar ? bar.textContent.replace(/\s+/g, ' ').trim() : null,
        barOverlapsGalleryControls: overlap,
        callLink: !!q('a[href^="tel:"].alt-order__link'), messengerLink: !!q('a[href*="m.me"]'),
        assure: q('.assure') ? q('.assure').textContent.replace(/\s+/g, ' ').trim() : null,
      };
    });
    const atTop = await g();
    await page.screenshot({ path: `${OUT}/pdp-${w}x${h}-top.png` });
    // scroll so the real button is in view
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('#buyBtn').scrollIntoView({ block: 'center' }); });
    await page.waitForTimeout(400);
    const atBuy = await g();
    await page.screenshot({ path: `${OUT}/pdp-${w}x${h}-buy.png` });
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(400);
    const atEnd = await g();
    const footerCovered = await page.evaluate(() => { const f = document.querySelector('.foot__note').getBoundingClientRect(); const bar = document.querySelector('#stickyBuy'); if (!bar || bar.hidden) return false; const b = bar.getBoundingClientRect(); return f.bottom > b.top; });
    console.log(`\n=== product ${w}x${h}`);
    console.log('top:  ', JSON.stringify(atTop));
    console.log('atBuy:', JSON.stringify({ scrollY: atBuy.scrollY, barVisible: atBuy.barVisible }));
    console.log('end:  ', JSON.stringify({ scrollY: atEnd.scrollY, barVisible: atEnd.barVisible, footerCoveredByBar: footerCovered }));

    // ---- order form
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.click('#buyBtn');
    await page.waitForTimeout(600);
    const form = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('#orderPage input')];
      const order = [...document.querySelectorAll('#orderPage .field__label, #orderPage input')].map(e => e.tagName === 'INPUT' ? '[' + e.id + ']' : e.textContent.trim().replace(/\s+/g, ' ')).filter((v, i, a) => a.indexOf(v) === i);
      return { docHeight: document.documentElement.scrollHeight, inputs: inputs.length, required: inputs.filter(i => i.required).length, submitTop: Math.round(document.querySelector('#submitBtn').getBoundingClientRect().top + scrollY), order: order.join(' > ') };
    });
    console.log('form: ', JSON.stringify(form));
    await page.screenshot({ path: `${OUT}/order-${w}x${h}.png`, fullPage: true });
    const submit = async (label) => {
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.click('#submitBtn');
      await page.waitForTimeout(500);
      const r = await page.evaluate(() => {
        const inv = document.querySelector('.input.is-invalid');
        const err = document.querySelector('#formErr');
        const b = inv && inv.getBoundingClientRect();
        return { hash: location.hash, err: err.textContent, invalid: inv ? inv.id : null, focused: document.activeElement && document.activeElement.id, inView: b ? b.top >= 0 && b.bottom <= innerHeight : null, errNextToField: inv ? inv.closest('.field') === err.closest('.field') : null, btn: document.querySelector('#submitBtn') ? document.querySelector('#submitBtn').textContent.replace(/\s+/g, ' ').trim() : 'gone' };
      });
      console.log(`submit ${label.padEnd(22)}`, JSON.stringify(r));
      return r;
    };
    await submit('empty');
    await page.fill('#fName', 'Тест Хэрэглэгч');
    await submit('name only');
    await page.fill('#fPhone', '99112233');
    await submit('name+phone');
    if (await page.$('#aCity')) await page.fill('#aCity', 'Улаанбаатар');
    await page.fill('#aDist', 'Баянзүрх');
    const done = await submit('name+phone+district');
    if (done.hash !== '#/done') {
      // the old form wants more: fill everything it has
      for (const [id, v] of [['aKhoroo', '5'], ['aBuilding', '12'], ['aEntrance', '3'], ['aDoor', '45']]) if (await page.$('#' + id)) await page.fill('#' + id, v);
      await submit('all fields');
    }
    console.log('posted:', JSON.stringify(posted));
    console.log('errors:', errs.length ? errs.join(' | ') : 'none');
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('ERR', e); process.exit(1); });
