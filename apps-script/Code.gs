/**
 * Starshopping — backend
 *
 * Энэ файл Google Sheet дээрх Apps Script рүү бүтнээр нь хуулагдана.
 *
 * Хийдэг ажил:
 *   doGet()   → Каталогийг JSON болгож сайт руу өгнө
 *   doPost()  → Захиалга хүлээж авч, SS-0001 код үүсгэн Orders-д бичнэ
 *   setup()   → Шаардлагатай бүх tab, гарчиг, trigger-ийг үүсгэнэ (нэг удаа)
 *
 * Тохиргоог доорх CONFIG дотроос л засна.
 */

const CONFIG = {
  orderPrefix: 'SS-',
  notifyEvery: 10,                       // хэдэн захиалга тутамд имэйл илгээх
  notifyEmail: 'Ariunbold.agency@gmail.com',
  archiveAfterHours: 48,
  shop: {
    bank: 'Худалдаа Хөгжлийн банк',
    account: '740004000460072440',
    holder: 'Аюурзана Ариунболд',
    phones: ['88104640', '94114495'],
    email: 'Ariunbold.agency@gmail.com',
    delivery: [
      { name: 'Энгийн хүргэлт', price: 6000 },
      { name: 'Шуурхай хүргэлт', price: 12000 },
      { name: 'Алслагдсан бүс', price: 8000, priceMax: 12000 }
    ]
  }
};

const SHEETS = {
  products: 'Products',
  categories: 'Categories',
  orders: 'Orders',
  archive: 'Archive'
};

const ORDER_HEADERS = [
  'Огноо', 'Захиалгын код', 'Нэр', 'Утас', 'Хаяг',
  'Бараа', 'Өнгө', 'Хэмжээ', 'Тоо',
  'Нэгж үнэ', 'Хүргэлт', 'Нийт дүн', 'Төлбөрийн сонголт', 'Төлөв'
];

/* ====================================================================
   SETUP — нэг удаа ажиллуулна
   ==================================================================== */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error(
      'Sheet олдсонгүй. Энэ скриптийг Sheet дотроос Extensions → Apps Script гэж нээгээрэй.'
    );
  }

  // CSV-ээр орж ирсэн эхний хуудсыг Products болгож нэрлэнэ
  const first = ss.getSheets()[0];
  if (!ss.getSheetByName(SHEETS.products)) first.setName(SHEETS.products);

  // Categories — байхгүй бол үүсгээд эхлэлийн мөрүүдийг тавина
  if (!ss.getSheetByName(SHEETS.categories)) {
    const s = ss.insertSheet(SHEETS.categories);
    s.getRange(1, 1, 1, 5).setValues([['slug', 'name', 'image', 'order', 'active']]);
    s.getRange(2, 1, 3, 5).setValues([
      ['undaanii-sav', 'УНДААНЫ САВ', 'assets/p/bottle-a.jpg', 1, true],
      ['ger-ahui', 'ГЭР АХУЙ', 'assets/product-clock.png', 2, true],
      ['duu-hugjim', 'ДУУ ХӨГЖИМ', 'assets/product-turntable.png', 3, true]
    ]);
    s.setFrozenRows(1);
  }

  [SHEETS.orders, SHEETS.archive].forEach(function (name) {
    if (!ss.getSheetByName(name)) {
      const s = ss.insertSheet(name);
      s.getRange(1, 1, 1, ORDER_HEADERS.length).setValues([ORDER_HEADERS]);
      s.setFrozenRows(1);
      s.getRange(1, 1, 1, ORDER_HEADERS.length).setFontWeight('bold');
    }
  });

  ss.getSheetByName(SHEETS.products).setFrozenRows(1);

  // 48 цагийн архивлалт — өдөрт 2 удаа
  const has = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'archiveOld';
  });
  if (!has) {
    ScriptApp.newTrigger('archiveOld').timeBased().everyHours(12).create();
  }

  // Санамж: энд SpreadsheetApp.getUi().alert() хэрэглэж болохгүй. Скриптийг
  // засварлагчаас Run хийхэд тэр цонх Sheet-ийн таб дээр гарч, хэн ч хариулахгүй
  // тул скрипт 6 минутын хязгаарт хүртэл гацдаг.
  Logger.log('Бэлэн боллоо. Tab-ууд: ' + ss.getSheets().map(function (s) {
    return s.getName();
  }).join(', '));
  Logger.log('Дараа нь Deploy → New deployment → Web app хийнэ үү.');
}

/* ====================================================================
   READ — каталогийг JSON болгож өгнө
   ==================================================================== */
function doGet() {
  const data = {
    shop: CONFIG.shop,
    categories: readCategories(),
    products: readProducts()
  };
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function rowsOf(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const head = values[0].map(function (h) { return String(h).trim(); });
  return values.slice(1).map(function (row) {
    const obj = {};
    head.forEach(function (h, i) { if (h) obj[h] = row[i]; });
    return obj;
  });
}

function truthy(v) {
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === '1' || s === 'тийм' || s === '';
}

function readCategories() {
  return rowsOf(SHEETS.categories)
    .filter(function (r) { return r.slug && truthy(r.active); })
    .map(function (r) {
      return {
        slug: String(r.slug).trim(),
        name: String(r.name || '').trim(),
        image: String(r.image || '').trim(),
        order: Number(r.order) || 0,
        active: true
      };
    })
    .sort(function (a, b) { return a.order - b.order; });
}

function readProducts() {
  return rowsOf(SHEETS.products)
    .filter(function (r) { return r.slug && truthy(r.active); })
    .map(function (r) {
      const images = [];
      for (let i = 1; i <= 5; i++) {
        const v = String(r['image' + i] || '').trim();
        if (v) images.push(v);
      }
      const d = String(r.discount === undefined ? '' : r.discount).trim();
      return {
        slug: String(r.slug).trim(),
        category: String(r.category || '').trim(),
        name: String(r.name || '').trim(),
        desc: String(r.desc || '').trim(),
        price: Number(r.price) || 0,
        discount: d === '' ? null : Number(d),
        images: images,
        colors: splitList(r.colors),
        sizes: splitList(r.sizes),
        stock: Number(r.stock) || 0,
        active: true
      };
    });
}

function splitList(v) {
  return String(v || '')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s !== ''; });
}

/* ====================================================================
   WRITE — захиалга хүлээж авна
   ==================================================================== */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // дугаар давхцахаас сэргийлнэ
  try {
    const body = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS.orders);

    const code = nextOrderCode(sheet);
    const qty = Number(body.qty) || 1;
    const unit = Number(body.price) || 0;
    const ship = Number(body.delivery) || 0;

    sheet.appendRow([
      new Date(),
      code,
      String(body.name || ''),
      String(body.phone || ''),
      String(body.address || ''),
      String(body.product || ''),
      String(body.color || ''),
      String(body.size || ''),
      qty,
      unit,
      ship,
      unit * qty + ship,
      String(body.payment || ''),
      'Шинэ'
    ]);

    const count = sheet.getLastRow() - 1;
    if (count > 0 && count % CONFIG.notifyEvery === 0) notifyBatch(sheet, count);

    return json({ ok: true, code: code });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function nextOrderCode(sheet) {
  const last = sheet.getLastRow();
  let n = 0;
  if (last > 1) {
    const prev = String(sheet.getRange(last, 2).getValue());
    const m = prev.match(/(\d+)\s*$/);
    if (m) n = parseInt(m[1], 10);
  }
  return CONFIG.orderPrefix + String(n + 1).padStart(4, '0');
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ====================================================================
   NOTIFY — N захиалга тутамд имэйл
   ==================================================================== */
function notifyBatch(sheet, count) {
  const n = CONFIG.notifyEvery;
  const rows = sheet.getRange(sheet.getLastRow() - n + 1, 1, n, ORDER_HEADERS.length).getValues();

  let html = '<h3>Сүүлийн ' + n + ' захиалга (нийт ' + count + ')</h3>'
    + '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:13px">'
    + '<tr style="background:#f0f0f0">'
    + ['Код', 'Нэр', 'Утас', 'Бараа', 'Тоо', 'Нийт'].map(function (h) { return '<th>' + h + '</th>'; }).join('')
    + '</tr>';

  rows.forEach(function (r) {
    html += '<tr>'
      + '<td>' + r[1] + '</td>'
      + '<td>' + r[2] + '</td>'
      + '<td>' + r[3] + '</td>'
      + '<td>' + r[5] + '</td>'
      + '<td>' + r[8] + '</td>'
      + '<td>' + r[11] + '₮</td>'
      + '</tr>';
  });
  html += '</table>';

  MailApp.sendEmail({
    to: CONFIG.notifyEmail,
    subject: 'Starshopping — ' + count + ' дэх захиалга',
    htmlBody: html
  });
}

/* ====================================================================
   ARCHIVE — 48 цагаас хуучирсан мөрийг зөөнө (устгахгүй)
   ==================================================================== */
function archiveOld() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const orders = ss.getSheetByName(SHEETS.orders);
  const archive = ss.getSheetByName(SHEETS.archive);
  if (!orders || !archive) return;

  const last = orders.getLastRow();
  if (last < 2) return;

  const values = orders.getRange(2, 1, last - 1, ORDER_HEADERS.length).getValues();
  const cutoff = Date.now() - CONFIG.archiveAfterHours * 3600 * 1000;
  const move = [];
  const keep = [];

  values.forEach(function (row) {
    const t = row[0] instanceof Date ? row[0].getTime() : 0;
    (t && t < cutoff ? move : keep).push(row);
  });

  if (!move.length) return;

  archive.getRange(archive.getLastRow() + 1, 1, move.length, ORDER_HEADERS.length).setValues(move);
  orders.getRange(2, 1, values.length, ORDER_HEADERS.length).clearContent();
  if (keep.length) {
    orders.getRange(2, 1, keep.length, ORDER_HEADERS.length).setValues(keep);
  }
}
