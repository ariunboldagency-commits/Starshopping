// Run computeOrder_ from Code.gs with the sheet stubbed by the offline catalogue.
const fs = require('fs'); const vm = require('vm');
const src = fs.readFileSync('apps-script/Code.gs', 'utf8');
const cat = JSON.parse(fs.readFileSync('data/catalog.json', 'utf8'));
const ctx = { Logger: { log(){} }, console };
vm.createContext(ctx);
vm.runInContext(src, ctx);
vm.runInContext(`
  readProducts = () => ${JSON.stringify(cat.products)};
  readBundles = () => ${JSON.stringify(cat.bundles)};
  availableFor_ = (slug) => null;
`, ctx);
const tryIt = (label, body) => console.log(label.padEnd(44), JSON.stringify(ctx.computeOrder_(body)));
tryIt('short payload (name, phone, district only)', { slug: 'Huuhdiin-hashiwch', phone: '99112233', name: 'Тест', address: 'Баянзүрх', qty: 1, deliveryName: 'Энгийн хүргэлт', payment: 'Хүргэлтээр төлөх' });
tryIt('no address at all', { slug: 'Huuhdiin-hashiwch', phone: '99112233', qty: 1, deliveryName: 'Энгийн хүргэлт', payment: 'Хүргэлтээр төлөх' });
tryIt('client sends price 1 (must be ignored)', { slug: 'Huuhdiin-hashiwch', phone: '99112233', qty: 1, unit: 1, total: 1, deliveryName: 'Энгийн хүргэлт', payment: 'Хүргэлтээр төлөх' });
tryIt('bad phone', { slug: 'Huuhdiin-hashiwch', phone: '9911', qty: 1, deliveryName: 'Энгийн хүргэлт', payment: 'Хүргэлтээр төлөх' });
tryIt('rural without prepay', { slug: 'Huuhdiin-hashiwch', phone: '99112233', qty: 1, deliveryName: 'Орон нутаг', payment: 'Хүргэлтээр төлөх' });
tryIt('unknown slug', { slug: 'nope', phone: '99112233', qty: 1, deliveryName: 'Энгийн хүргэлт', payment: 'Хүргэлтээр төлөх' });
