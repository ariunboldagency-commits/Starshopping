const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const ORIGIN = 'http://127.0.0.1:8777';
(async () => {
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error' && !/facebook|ERR_FAILED/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  await page.route(/connect\.facebook\.net|facebook\.com\/tr/, r => r.abort());
  let posted = null;
  await page.route(/starshopping\.app\.n8n\.cloud\/webhook\/order-intake/, async route => {
    posted = { headers: route.request().headers(), body: route.request().postDataJSON() };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, order_id: 'a1b2c3d4-e5f6-7890', product: 'Хүүхдийн хашилт', quantity: 2, total_mnt: 178000, is_duplicate: false }) });
  });
  await page.route(/(http:\/\/127\.0\.0\.1:8777\/)|https:\/\/(script\.google\.com|script\.googleusercontent\.com|drive\.google\.com|lh3\.googleusercontent\.com)\//, async route => {
    try { const r = await route.fetch({ maxRedirects: 5 }); let body = await r.body(); if (/\/p\/[^/]+\/(\?.*)?$/.test(route.request().url())) body = Buffer.from(body.toString().split('https://starshopping-mn.github.io/').join(ORIGIN + '/')); await route.fulfill({ response: r, body }); } catch (e) { try { await route.abort(); } catch {} }
  });
  // 1. card page with ?ref → SPA, ss_ref kept
  await page.goto(ORIGIN + '/p/Huuhdiin-hashiwch/?ref=TEST-01', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const r1 = await page.evaluate(() => ({ url: location.href, ref: localStorage.getItem('ss_ref'), view: Array.from(document.querySelectorAll('.view')).filter(v => !v.hidden).map(v => v.id).join(','), buy: !!document.querySelector('#buyBtn'), call: !!document.querySelector('.callbuy'), sticky: (() => { const s = document.querySelector('.stickybuy'); return s ? (s.hidden ? 'hidden' : 'shown') : 'absent'; })() }));
  console.log('1 card+ref:', JSON.stringify(r1));
  // 2. scroll down: sticky bar shows with price
  await page.evaluate(() => window.scrollTo(0, 300)); await page.waitForTimeout(500);
  const r2 = await page.evaluate(() => { const s = document.querySelector('.stickybuy'); const b = document.querySelector('#buyBtn').getBoundingClientRect(); return { sticky: s ? (s.hidden ? 'hidden' : 'shown') : 'absent', price: s && s.querySelector('.stickybuy__price').textContent, buyTop: Math.round(b.top), vh: innerHeight, stickyBottom: s && Math.round(s.getBoundingClientRect().bottom) }; });
  console.log('2 scrolled 300:', JSON.stringify(r2));
  await page.screenshot({ path: 'out/pdp-sticky.png' });
  await page.evaluate(() => document.querySelector('#buyBtn').scrollIntoView({ block: 'center' })); await page.waitForTimeout(500);
  const r3 = await page.evaluate(() => { const s = document.querySelector('.stickybuy'); return s ? (s.hidden ? 'hidden' : 'shown') : 'absent'; });
  console.log('3 at real button, sticky:', r3);
  // 4. order form: required fields
  await page.click('.stickybuy__go').catch(() => page.click('#buyBtn'));
  await page.waitForTimeout(800);
  const r4 = await page.evaluate(() => ({ hash: location.hash, required: Array.from(document.querySelectorAll('#orderForm [required]')).map(e => e.id), inputs: document.querySelectorAll('#orderForm .input').length, qtyBtns: document.querySelectorAll('#orderForm .qty__btn').length, btnTop: Math.round(document.querySelector('#submitBtn, #orderForm button[type=submit]').getBoundingClientRect().top / innerHeight * 100) / 100 }));
  console.log('4 order form:', JSON.stringify(r4));
  await page.screenshot({ path: 'out/order-form.png', fullPage: true });
  // 5. qty + submit
  await page.click('#orderForm .qty__btn[data-step="1"]').catch(() => {});
  await page.fill('#fName', 'Тест'); await page.fill('#fPhone', '88104640'); await page.fill('#fAddr', 'БЗД 5-р хороо\n45 байр 12 тоот');
  await page.click('#orderForm button[type=submit]');
  await page.waitForTimeout(1500);
  const r5 = await page.evaluate(() => ({ hash: location.hash, err: (document.querySelector('#formErr')||{}).textContent, code: document.querySelector('#codeVal') && document.querySelector('#codeVal').textContent, total: Array.from(document.querySelectorAll('#donePage .totals__row')).map(r => r.textContent.replace(/\s+/g,' ').trim()).join(' | '), ref: localStorage.getItem('ss_ref') }));
  console.log('5 posted:', JSON.stringify(posted));
  console.log('5 done page:', JSON.stringify(r5));
  // 6. refusal path
  await page.unroute(/starshopping\.app\.n8n\.cloud\/webhook\/order-intake/);
  await page.route(/starshopping\.app\.n8n\.cloud\/webhook\/order-intake/, r => r.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'out_of_stock' }) }));
  await page.goto(ORIGIN + '/#/p/Huuhdiin-hashiwch', { waitUntil: 'load' }); await page.waitForTimeout(2000);
  await page.click('#buyBtn'); await page.waitForTimeout(800);
  await page.fill('#fName', 'Тест'); await page.fill('#fPhone', '88104640'); await page.fill('#fAddr', 'Дархан');
  await page.click('#orderForm button[type=submit]'); await page.waitForTimeout(1500);
  const r6 = await page.evaluate(() => ({ hash: location.hash, err: document.querySelector('#formErr').textContent, btn: document.querySelector('#orderForm button[type=submit]').disabled, label: document.querySelector('#orderForm .buy__label').textContent }));
  console.log('6 refusal:', JSON.stringify(r6));
  console.log('errors:', errs.length ? errs.join(' | ') : 'none');
  await browser.close();
})().catch(e => { console.error('ERR', e); process.exit(1); });
