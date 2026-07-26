/**
 * Starshopping — backend
 *
 * Энэ файл Google Sheet дээрх Apps Script рүү бүтнээр нь хуулагдана.
 *
 *   setup()   → Бүх хуудас, багана, тайлбар, цагийн бүс, trigger-ийг бэлдэнэ
 *   doGet()   → Каталогийг JSON болгож сайт руу өгнө
 *   doPost()  → Захиалга хүлээж авч, SS-0001 код үүсгэн Orders-д бичнэ
 *
 * Тохиргоог доорх CONFIG дотроос л засна.
 */

const CONFIG = {
  timeZone: 'Asia/Ulaanbaatar',          // захиалгын огноо энэ бүсээр бичигдэнэ
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
  bundles: 'Bundles',
  reviews: 'Reviews',
  orders: 'Orders',
  archive: 'Archive',
  guide: 'Заавар'
};

/* Products хуудасны багана — холбоотой талбарууд зэрэгцэж байхаар эрэмбэлсэн.
   setup() ажиллах бүрд хуудсыг энэ дараалалд оруулна. */
const PRODUCT_COLS = [
  'slug', 'category', 'name', 'desc',
  'price', 'discount',
  'sizes', 'sizePrices',
  'colors', 'colorImages', 'sizeImages',
  'image1', 'image2', 'image3', 'image4', 'image5',
  'stock', 'active'
];

const PRODUCT_NOTES = {
  slug: 'Барааны богино нэр. Латинаар, зайгүй, зурааснаас өөр тэмдэггүй.\nЖишээ: chako-thermos\nДавхардаж болохгүй.',
  category: 'Аль категорид харьяалагдах. Categories хуудасны slug-тай яг таарна.\nЖишээ: undaanii-sav',
  name: 'Сайт дээр харагдах нэр.\nЖишээ: Chako Lab термос аяга',
  desc: 'Богино тайлбар. 1-2 өгүүлбэр.',
  price: 'Үндсэн үнэ, зөвхөн тоо (₮ бичихгүй).\nЖишээ: 45900\nХэмжээ бүр өөр үнэтэй бол sizePrices-ыг ашиглана.',
  discount: 'Хямдралын ХУВЬ, зөвхөн тоо.\nЖишээ: 20  →  20% хямдарна.\nХоосон бол хямдрал огт харагдахгүй.',
  sizes: 'Хэмжээнүүд, таслалаар тусгаарлана.\nЖишээ: 350мл, 500мл\nХоосон бол хэмжээ сонгох хэсэг гарахгүй.',
  sizePrices: 'Хэмжээ бүрийн үнэ, sizes-тэй ЯГ ИЖИЛ дараалалтай.\nЖишээ: sizes = 350мл, 500мл\n        sizePrices = 45900, 62900\nХоосон бол бүх хэмжээнд price баганын үнэ хэрэглэгдэнэ.',
  colors: 'Өнгөнүүд, таслалаар тусгаарлана.\nЖишээ: Шар, Ягаан, Цэнхэр\nХоосон бол өнгө сонгох хэсэг гарахгүй.',
  colorImages: 'Өнгө бүрийн зураг, colors-тэй ЯГ ИЖИЛ дараалалтай.\nӨнгө дархад галерей тэр зураг руу үсэрнэ.\nХоосон бол зураг солигдохгүй.',
  sizeImages: 'Хэмжээ бүрийн зураг, sizes-тэй ижил дараалалтай.\nИхэвчлэн хэрэггүй, хоосон орхиж болно.',
  image1: 'Үндсэн зураг. Drive-ийн share линк тавьж болно.',
  image2: 'Нэмэлт зураг (заавал биш).',
  image3: 'Нэмэлт зураг (заавал биш).',
  image4: 'Нэмэлт зураг (заавал биш).',
  image5: 'Нэмэлт зураг (заавал биш).',
  stock: 'Үлдэгдэл тоо. 5 ба түүнээс бага бол сайт дээр "Үлдсэн Nш" гэж харагдана.',
  active: 'TRUE = сайт дээр харагдана.\nFALSE = түр нуугдана (устгах шаардлагагүй).'
};

const CATEGORY_NOTES = {
  slug: 'Категорийн богино нэр. Латинаар, зайгүй.\nProducts хуудасны category баганад энэ нэрийг бичнэ.',
  name: 'Сайт дээр харагдах нэр. Хоёр үгтэй бол хоёр мөр болж харагдана.\nЖишээ: УНДААНЫ САВ',
  image: 'Категорийн зураг. Шинэ категори нэмвэл зургийг боловсруулах хэрэгтэй.',
  order: 'Харагдах дараалал. 1, 2, 3 ...',
  active: 'TRUE = харагдана, FALSE = нуугдана.'
};

const BUNDLE_COLS = ['product', 'qty', 'price', 'label', 'active'];
const BUNDLE_NOTES = {
  product: 'Аль барааны багц вэ. Products хуудасны slug-ийг бичнэ.\nЖишээ: chako-thermos',
  qty: 'Багцад хэдэн ширхэг орох.\nЖишээ: 3',
  price: 'Багцын НИЙТ үнэ, зөвхөн тоо.\nЖишээ: 99000  (3 ширхэгийн нийт үнэ)',
  label: 'Сайт дээр гарах тайлбар.\nЖишээ: 2 авбал 1 үнэгүй\nХоосон байж болно.',
  active: 'TRUE = харагдана, FALSE = нуугдана.'
};

const REVIEW_NOTES = {
  product: 'Аль барааны сэтгэгдэл вэ (slug).\nХООСОН орхивол БҮХ бараан дээр харагдана.',
  name: 'Сэтгэгдэл бичсэн хүний нэр.\nЖишээ: Б.Хулан',
  text: 'Сэтгэгдлийн текст.',
  rating: '1-5 хүртэлх од. Хоосон бол од харагдахгүй.',
  image: 'Screenshot-ын зураг (Drive линк). Хоосон байж болно.',
  active: 'TRUE = харагдана, FALSE = нуугдана.'
};

const ORDER_HEADERS = [
  'Огноо', 'Захиалгын код', 'Нэр', 'Утас', 'Хаяг',
  'Бараа', 'Өнгө', 'Хэмжээ', 'Тоо',
  'Нэгж үнэ', 'Хүргэлт', 'Нийт дүн', 'Төлбөрийн сонголт', 'Төлөв',
  'Нэмэлт утас'
];

/* ====================================================================
   SETUP — дахин ажиллуулахад аюулгүй
   ==================================================================== */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Sheet олдсонгүй. Sheet дотроос Extensions → Apps Script гэж нээгээрэй.');
  }

  // Огноо Улаанбаатарын цагаар бичигдэхийн тулд. Үүнгүй бол Google-ийн
  // үндсэн бүс (Америк) хэрэглэгдэж, захиалгын цаг 15 цагаар хоцордог.
  ss.setSpreadsheetTimeZone(CONFIG.timeZone);

  const first = ss.getSheets()[0];
  if (!ss.getSheetByName(SHEETS.products)) first.setName(SHEETS.products);

  ensureSheet_(ss, SHEETS.categories, ['slug', 'name', 'image', 'order', 'active'], [
    ['undaanii-sav', 'УНДААНЫ САВ', 'assets/p/bottle-a.jpg', 1, true],
    ['ger-ahui', 'ГЭР АХУЙ', 'assets/product-clock.png', 2, true],
    ['duu-hugjim', 'ДУУ ХӨГЖИМ', 'assets/product-turntable.png', 3, true]
  ]);
  ensureSheet_(ss, SHEETS.bundles, BUNDLE_COLS, []);
  ensureSheet_(ss, SHEETS.reviews, ['product', 'name', 'text', 'rating', 'image', 'active'], []);
  ensureSheet_(ss, SHEETS.orders, ORDER_HEADERS, []);
  ensureSheet_(ss, SHEETS.archive, ORDER_HEADERS, []);

  orderProductColumns_(ss);
  [SHEETS.orders, SHEETS.archive].forEach(function (n) { syncHeaders_(ss, n, ORDER_HEADERS); });

  // Тайлбарууд — гарчиг дээр хулгана авчрахад тусламж гарч ирнэ
  annotate_(ss, SHEETS.products, PRODUCT_NOTES);
  annotate_(ss, SHEETS.categories, CATEGORY_NOTES);
  annotate_(ss, SHEETS.bundles, BUNDLE_NOTES);
  annotate_(ss, SHEETS.reviews, REVIEW_NOTES);

  buildGuide_(ss);

  const has = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'archiveOld';
  });
  if (!has) ScriptApp.newTrigger('archiveOld').timeBased().everyHours(12).create();

  Logger.log('Бэлэн. Хуудсууд: ' + ss.getSheets().map(function (s) { return s.getName(); }).join(', '));
  Logger.log('Цагийн бүс: ' + ss.getSpreadsheetTimeZone());
}

function upgrade() { setup(); }

function ensureSheet_(ss, name, headers, rows) {
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.getRange(1, 1, 1, headers.length).setValues([headers]);
    if (rows.length) s.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  s.setFrozenRows(1);
  s.getRange(1, 1, 1, Math.max(headers.length, s.getLastColumn()))
    .setFontWeight('bold')
    .setBackground('#1c1c1c')
    .setFontColor('#ffffff');
  return s;
}

/** Гарчиг дээр тайлбар (hover note) тавина. */
function annotate_(ss, sheetName, notes) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastColumn() < 1) return;
  const width = sheet.getLastColumn();
  const head = sheet.getRange(1, 1, 1, width).getValues()[0];
  head.forEach(function (h, i) {
    const key = String(h).trim();
    if (notes[key]) sheet.getRange(1, i + 1).setNote(notes[key]);
  });
}

/**
 * Products хуудсыг PRODUCT_COLS дараалалд оруулна. Танихгүй багана байвал
 * төгсгөлд нь хэвээр үлдээнэ — гараар нэмсэн зүйл алдагдахгүй.
 */
function orderProductColumns_(ss) {
  const sheet = ss.getSheetByName(SHEETS.products);
  const lastCol = sheet.getLastColumn();
  const lastRow = Math.max(1, sheet.getLastRow());
  if (lastCol < 1) return;

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const head = values[0].map(function (h) { return String(h).trim(); });

  const extras = head.filter(function (h) {
    return h && PRODUCT_COLS.indexOf(h) === -1;
  });
  const target = PRODUCT_COLS.concat(extras);

  // Аль хэдийн зөв дараалалтай бол хөндөхгүй
  if (head.length === target.length && head.every(function (h, i) { return h === target[i]; })) return;

  const rebuilt = values.map(function (row, r) {
    return target.map(function (col) {
      if (r === 0) return col;
      const idx = head.indexOf(col);
      return idx === -1 ? '' : row[idx];
    });
  });

  sheet.clear();
  sheet.getRange(1, 1, rebuilt.length, target.length).setValues(rebuilt);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, target.length)
    .setFontWeight('bold').setBackground('#1c1c1c').setFontColor('#ffffff');
}

function syncHeaders_(ss, name, headers) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) return;
  const width = Math.max(1, sheet.getLastColumn());
  const head = sheet.getRange(1, 1, 1, width).getValues()[0].map(function (h) {
    return String(h).trim();
  });
  headers.forEach(function (h) {
    if (head.indexOf(h) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h).setFontWeight('bold');
    }
  });
}

/** Заавар хуудас — багана бүрийг юу гэж бөглөхийг бичсэн лавлах. */
function buildGuide_(ss) {
  let s = ss.getSheetByName(SHEETS.guide);
  if (!s) s = ss.insertSheet(SHEETS.guide);
  s.clear();

  const rows = [['ХУУДАС', 'БАГАНА', 'ЮУ БИЧИХ', 'ЖИШЭЭ']];
  const push = function (sheetName, notes, cols) {
    cols.forEach(function (c) {
      if (!notes[c]) return;
      const lines = notes[c].split('\n');
      rows.push([sheetName, c, lines[0], lines.slice(1).join(' ')]);
    });
  };
  push('Products', PRODUCT_NOTES, PRODUCT_COLS);
  push('Categories', CATEGORY_NOTES, ['slug', 'name', 'image', 'order', 'active']);
  push('Bundles', BUNDLE_NOTES, BUNDLE_COLS);
  push('Reviews', REVIEW_NOTES, ['product', 'name', 'text', 'rating', 'image', 'active']);

  s.getRange(1, 1, rows.length, 4).setValues(rows);
  s.setFrozenRows(1);
  s.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#1c1c1c').setFontColor('#ffffff');
  s.setColumnWidth(1, 110);
  s.setColumnWidth(2, 120);
  s.setColumnWidth(3, 420);
  s.setColumnWidth(4, 300);
  s.getRange(2, 1, rows.length - 1, 4).setVerticalAlignment('top').setWrap(true);
}

/* ====================================================================
   READ
   ==================================================================== */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({
      shop: CONFIG.shop,
      categories: readCategories(),
      products: readProducts(),
      bundles: readBundles(),
      reviews: readReviews()
    }))
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

function splitList(v) {
  return String(v || '')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s !== ''; });
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
        sizes: splitList(r.sizes),
        sizePrices: splitList(r.sizePrices).map(Number),
        colors: splitList(r.colors),
        colorImages: splitList(r.colorImages),
        sizeImages: splitList(r.sizeImages),
        stock: Number(r.stock) || 0,
        active: true
      };
    });
}

function readBundles() {
  return rowsOf(SHEETS.bundles)
    .filter(function (r) { return r.product && Number(r.qty) > 1 && truthy(r.active); })
    .map(function (r) {
      return {
        product: String(r.product).trim(),
        qty: Number(r.qty),
        price: Number(r.price) || 0,
        label: String(r.label || '').trim()
      };
    });
}

function readReviews() {
  return rowsOf(SHEETS.reviews)
    .filter(function (r) { return (r.text || r.image) && truthy(r.active); })
    .map(function (r) {
      return {
        product: String(r.product || '').trim(),
        name: String(r.name || '').trim(),
        text: String(r.text || '').trim(),
        rating: Number(r.rating) || 0,
        image: String(r.image || '').trim()
      };
    });
}

/* ====================================================================
   WRITE
   ==================================================================== */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // дугаар давхцахаас сэргийлнэ
  try {
    const body = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.orders);

    const code = nextOrderCode(sheet);
    const qty = Number(body.qty) || 1;
    const unit = Number(body.price) || 0;
    const ship = Number(body.delivery) || 0;
    const total = Number(body.total) || unit * qty + ship;

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
      total,
      String(body.payment || ''),
      'Шинэ',
      String(body.phone2 || '')
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
   NOTIFY
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
    html += '<tr><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td>'
      + '<td>' + r[5] + '</td><td>' + r[8] + '</td><td>' + r[11] + '₮</td></tr>';
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
  if (keep.length) orders.getRange(2, 1, keep.length, ORDER_HEADERS.length).setValues(keep);
}
