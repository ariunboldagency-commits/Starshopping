gsap.registerPlugin(ScrollTrigger);

/* ========================================================================
   DATA
   Live catalogue comes from the Apps Script web app bound to the shop's
   sheet, so products, prices, discounts and photos are edited there rather
   than in code. The bundled JSON stays as a fallback: if Google is slow,
   over quota, or the deployment is mid-update, the shop still renders
   instead of showing an empty page.
   ===================================================================== */
const DATA_SOURCE =
  "https://script.google.com/macros/s/AKfycbyRz34Hm9SqKxFSAxbQ9L83lfn3WzBn-wWYl_3jTMbEali3DpgAisWJ9O_JxhN-qd7QiQ/exec";
const DATA_FALLBACK = "data/catalog.json";

let DB = { shop: {}, categories: [], products: [], reviews: [] };

/* Sheets get pasted full of Google Drive share links rather than direct
   image URLs, so normalise those into something an <img> can actually load. */
function imageUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const drive = s.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([\w-]+)/);
  if (drive) return `https://drive.google.com/thumbnail?id=${drive[1]}&sz=w1200`;
  return s;
}

/* A cell can arrive as a real array (json) or as "Улаан, Хөх" (sheet). */
function listOf(v) {
  if (Array.isArray(v)) return v.filter((x) => String(x).trim() !== "");
  return String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const money = (n) => Number(n).toLocaleString("en-US") + "₮";
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Discount column holds a percentage. Empty means the product simply has no
   sale — nothing renders, rather than a 0% badge. */
function priceOf(p) {
  const d = Number(p.discount);
  const on = p.discount !== null && p.discount !== "" && !Number.isNaN(d) && d > 0;
  return {
    on,
    pct: d,
    was: Number(p.price),
    now: on ? Math.round((Number(p.price) * (1 - d / 100)) / 100) * 100 : Number(p.price),
  };
}

const productsIn = (slug) => DB.products.filter((p) => p.active !== false && p.category === slug);
const categoryBy = (slug) => DB.categories.find((c) => c.slug === slug);
const productBy = (slug) => DB.products.find((p) => p.slug === slug);
const reviewsFor = (slug) => DB.reviews.filter((r) => !r.product || r.product === slug);

/* ========================================================================
   IMAGE FRAMES
   ===================================================================== */
let frameTimers = [];

function buildFrame(images, className = "frame") {
  const urls = images.map(imageUrl).filter(Boolean);
  const el = document.createElement("div");
  el.className = className;
  const track = document.createElement("div");
  track.className = "frame__track";
  (urls.length ? urls : [""]).forEach((u) => {
    const img = document.createElement("img");
    img.src = u;
    img.alt = "";
    img.loading = "lazy";
    track.appendChild(img);
  });
  el.appendChild(track);
  el.dataset.count = String(urls.length || 1);
  return el;
}

function startFrames(root) {
  stopFrames();
  root.querySelectorAll(".frame, .pdp__gallery").forEach((frame, i) => {
    if (frame.dataset.manual === "1") return; // gallery driven by option picks
    const count = Number(frame.dataset.count || 1);
    if (count < 2) return;
    const track = frame.querySelector(".frame__track");
    let idx = 0;
    frameTimers.push(
      setInterval(() => {
        idx = (idx + 1) % count;
        track.style.transform = `translateX(-${idx * 100}%)`;
        frame.dispatchEvent(new CustomEvent("frame:index", { detail: idx }));
      }, 2600 + (i % 4) * 320)
    );
  });
}

function stopFrames() {
  frameTimers.forEach(clearInterval);
  frameTimers = [];
}

/* ========================================================================
   HOME · category browser
   ===================================================================== */
const catsStage = document.getElementById("catsStage");
const catIndexEl = document.getElementById("catIndex");
const catTotalEl = document.getElementById("catTotal");
let current = 0;
let cycle = null;

function renderCategories() {
  const cats = DB.categories.filter((c) => c.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
  catsStage.innerHTML = "";
  catTotalEl.textContent = String(cats.length).padStart(2, "0");

  cats.forEach((c, i) => {
    // "УНДААНЫ САВ" stacks as two lines; the longest one sets the type size
    const words = String(c.name).trim().split(/\s+/);
    const lines = words.length > 1 ? [words[0], words.slice(1).join(" ")] : [words[0]];
    const chars = Math.max(...lines.map((l) => l.length));
    const count = productsIn(c.slug).length;

    const art = document.createElement("article");
    art.className = "cat" + (i === 0 ? " is-active" : "");
    art.innerHTML = `
      <div class="cat__side">
        <h2 class="cat__name" style="--chars:${chars}">
          ${lines.map((l) => `<span>${esc(l)}</span>`).join("")}
        </h2>
        <a class="cat__cta" href="#/c/${esc(c.slug)}">
          <span class="cat__count">${count} бараа</span>
          <span class="cat__go">Үзэх →</span>
        </a>
      </div>
      <div class="cat__img"><img src="${imageUrl(c.image)}" alt="${esc(c.name)}"></div>`;
    catsStage.appendChild(art);
  });
}

function showCat(i) {
  const cards = catsStage.querySelectorAll(".cat");
  if (!cards.length) return;
  current = (i + cards.length) % cards.length;
  cards.forEach((c, n) => c.classList.toggle("is-active", n === current));
  catIndexEl.textContent = String(current + 1).padStart(2, "0");
}

const startCycle = () => {
  stopCycle();
  cycle = setInterval(() => showCat(current + 1), 5000);
};
const stopCycle = () => {
  if (cycle) clearInterval(cycle);
  cycle = null;
};

document.querySelectorAll(".arrow").forEach((arrow) =>
  arrow.addEventListener("click", () => {
    showCat(current + Number(arrow.dataset.dir));
    startCycle();
  })
);

/* ========================================================================
   HOME · motion
   ===================================================================== */
const heroEl = document.getElementById("hero");
const camImg = document.querySelector(".hero__cam img");
let homeTriggers = [];
let heroTl = null;

const lensOffset = (axis) => () => {
  const hero = heroEl.getBoundingClientRect();
  const img = camImg.getBoundingClientRect();
  const lensX = img.left - hero.left + img.width * 0.521;
  const lensY = img.top - hero.top + img.height * 0.875;
  return axis === "x" ? hero.width / 2 - lensX : hero.height / 2 - lensY;
};

function buildHomeMotion() {
  if (heroTl) return;

  /* Scrolling flies the viewer into the lens: the image scales about the
     lens while the lens itself travels to the middle of the screen, so it
     reads as entering rather than drifting by. */
  heroTl = gsap
    .timeline({
      scrollTrigger: {
        trigger: "#hero",
        start: "top top",
        end: "+=190%",
        scrub: 0.5,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    })
    .to(".hero__cue", { opacity: 0, duration: 0.12 }, 0)
    .to(".hero__word", { opacity: 0, duration: 0.34, ease: "power1.in" }, 0.04)
    .to(camImg, { scale: 11, x: lensOffset("x"), y: lensOffset("y"), duration: 1, ease: "power2.in" }, 0)
    .to(".hero__veil", { opacity: 1, duration: 0.3 }, 0.7);

  homeTriggers.push(
    gsap.fromTo(
      ".cats__emerge",
      { scale: 0.3, opacity: 0 },
      { scale: 1, opacity: 1, ease: "power2.out",
        scrollTrigger: { trigger: "#cats", start: "top 92%", end: "top 12%", scrub: 0.5 } }
    ).scrollTrigger,
    ScrollTrigger.create({
      trigger: "#cats",
      start: "top 80%",
      end: "bottom 20%",
      onToggle: (self) => (self.isActive ? startCycle() : stopCycle()),
    })
  );

  ["hero", "cats"].forEach((id) =>
    homeTriggers.push(
      ScrollTrigger.create({
        trigger: `#${id}`,
        start: "top 55%",
        end: "bottom 45%",
        onEnter: () => setRail(id),
        onEnterBack: () => setRail(id),
      })
    )
  );
}

function destroyHomeMotion() {
  stopCycle();
  if (heroTl) {
    heroTl.scrollTrigger && heroTl.scrollTrigger.kill();
    heroTl.kill();
    heroTl = null;
  }
  homeTriggers.forEach((t) => t && t.kill());
  homeTriggers = [];
  gsap.set([camImg, ".hero__word", ".hero__veil", ".hero__cue", ".cats__emerge"], { clearProps: "all" });
}

const railEl = document.getElementById("rail");
const edgeEl = document.getElementById("edge");
const railLines = Array.from(document.querySelectorAll(".rail__line"));

function setRail(id) {
  railLines.forEach((l) => l.classList.toggle("is-active", l.dataset.goto === id));
  edgeEl.classList.add("is-shown");
}

railLines.forEach((line) =>
  line.addEventListener("click", () =>
    document.getElementById(line.dataset.goto)?.scrollIntoView({ behavior: "smooth" })
  )
);

/* ========================================================================
   CATEGORY VIEW
   ===================================================================== */
function renderCategory(slug) {
  const cat = categoryBy(slug);
  const items = productsIn(slug);
  document.getElementById("catTitle").textContent = cat ? cat.name : "Категори";
  document.getElementById("catMeta").textContent = `${items.length} БАРАА`;

  const plist = document.getElementById("plist");
  plist.innerHTML = "";
  items.forEach((p) => {
    const pr = priceOf(p);
    const row = document.createElement("a");
    row.className = "prow";
    row.href = `#/p/${p.slug}`;
    row.appendChild(buildFrame(p.images));

    const info = document.createElement("div");
    info.className = "prow__info";
    info.innerHTML = `
      <span class="prow__name">${esc(p.name)}</span>
      <span class="prow__prices">
        <span class="price-now">${money(pr.now)}</span>
        ${pr.on ? `<span class="price-was">${money(pr.was)}</span>` : ""}
      </span>
      ${pr.on ? `<span class="tag">-${pr.pct}%</span>` : ""}
      ${Number(p.stock) > 0 && Number(p.stock) <= 5 ? `<span class="tag tag--soft">Үлдсэн ${p.stock}ш</span>` : ""}`;
    row.appendChild(info);
    plist.appendChild(row);
  });

  if (window.fbq) fbq("trackCustom", "ViewCategory", { category: cat ? cat.name : slug });
}

/* ========================================================================
   PRODUCT VIEW
   ===================================================================== */
const DELIVERY_DEFAULT = 0;

function renderProduct(slug) {
  const p = productBy(slug);
  if (!p) return goHome();
  const pr = priceOf(p);
  const colors = listOf(p.colors);
  const sizes = listOf(p.sizes);
  const colorImgs = listOf(p.colorImages).map(imageUrl);
  const sizeImgs = listOf(p.sizeImages).map(imageUrl);
  const cat = categoryBy(p.category);
  const revs = reviewsFor(p.slug);

  const pdp = document.getElementById("pdp");
  pdp.innerHTML = "";

  const back = document.createElement("a");
  back.className = "back";
  back.href = `#/c/${p.category}`;
  back.textContent = `← ${cat ? cat.name : "Буцах"}`;
  pdp.appendChild(back);

  const wrap = document.createElement("div");
  wrap.className = "pdp";

  /* ---- gallery ---- */
  const left = document.createElement("div");
  left.className = "pdp__left";
  const gallery = buildFrame(p.images, "pdp__gallery");
  left.appendChild(gallery);

  const track = gallery.querySelector(".frame__track");
  const galleryCount = Number(gallery.dataset.count || 1);
  let dots = null;
  if (galleryCount > 1) {
    dots = document.createElement("div");
    dots.className = "pdp__dots";
    for (let i = 0; i < galleryCount; i++) {
      const d = document.createElement("span");
      d.className = "pdot" + (i === 0 ? " is-active" : "");
      dots.appendChild(d);
    }
    left.appendChild(dots);
    gallery.addEventListener("frame:index", (e) => {
      dots.querySelectorAll(".pdot").forEach((d, n) => d.classList.toggle("is-active", n === e.detail));
    });
  }

  /* Picking a colour or size jumps the gallery to that variant's photo, so
     the picture always matches what is actually being ordered. The sheet
     supplies those photos in colorImages / sizeImages, in the same order as
     the options themselves. */
  const showVariantImage = (url) => {
    if (!url) return;
    const imgs = Array.from(track.querySelectorAll("img"));
    let idx = imgs.findIndex((im) => im.src === url || im.getAttribute("src") === url);
    if (idx === -1) {
      const extra = document.createElement("img");
      extra.src = url;
      extra.alt = "";
      track.appendChild(extra);
      idx = imgs.length;
      gallery.dataset.count = String(idx + 1);
      if (dots) {
        const d = document.createElement("span");
        d.className = "pdot";
        dots.appendChild(d);
      }
    }
    gallery.dataset.manual = "1"; // stop the auto-rotation fighting the pick
    stopFrames();
    track.style.transform = `translateX(-${idx * 100}%)`;
    if (dots) dots.querySelectorAll(".pdot").forEach((d, n) => d.classList.toggle("is-active", n === idx));
  };

  wrap.appendChild(left);

  /* ---- info + options ---- */
  const right = document.createElement("div");
  right.innerHTML = `
    <h1 class="pdp__name">${esc(p.name)}</h1>
    ${p.desc ? `<p class="pdp__desc">${esc(p.desc)}</p>` : ""}
    <div class="pdp__prices">
      <span class="price-now">${money(pr.now)}</span>
      ${pr.on ? `<span class="price-was">${money(pr.was)}</span>` : ""}
      ${pr.on ? `<span class="tag">-${pr.pct}%</span>` : ""}
    </div>

    ${colors.length ? `<div class="opt"><span class="opt__label">ӨНГӨ</span>
      <div class="opt__row" data-opt="color">
        ${colors.map((c, i) => `<button class="chip${i === 0 ? " is-active" : ""}" data-i="${i}">${esc(c)}</button>`).join("")}
      </div></div>` : ""}

    ${sizes.length ? `<div class="opt"><span class="opt__label">ХЭМЖЭЭ</span>
      <div class="opt__row" data-opt="size">
        ${sizes.map((s, i) => `<button class="chip${i === 0 ? " is-active" : ""}" data-i="${i}">${esc(s)}</button>`).join("")}
      </div></div>` : ""}

    <div class="opt"><span class="opt__label">ТОО ШИРХЭГ</span>
      <div class="qty">
        <button class="qty__btn" data-step="-1">−</button>
        <span class="qty__val" id="qtyVal">1</span>
        <button class="qty__btn" data-step="1">+</button>
      </div>
    </div>

    <a class="buy" href="#" id="buyBtn">
      <span class="buy__total" id="buyTotal"></span>
      <span class="buy__label">ЗАХИАЛАХ</span>
    </a>

    <div class="trust">
      <div><b>Хүргэлт</b>Энгийн 6,000₮ · Шуурхай 12,000₮</div>
      <div><b>Төлбөр</b>Хүргэлтээр эсвэл шилжүүлгээр</div>
      <div><b>Холбоо</b>8810-4640 · 9411-4495</div>
      <div><b>Захиалгын код</b>Бүртгэл, хяналттай</div>
    </div>`;
  wrap.appendChild(right);
  pdp.appendChild(wrap);

  /* ---- selection state ---- */
  let qty = 1;
  let color = colors[0] || "";
  let size = sizes[0] || "";
  const qtyVal = right.querySelector("#qtyVal");
  const buyTotal = right.querySelector("#buyTotal");

  const refreshTotal = () => {
    buyTotal.textContent = `${qty} ширхэг · ${money(pr.now * qty)}`;
  };
  refreshTotal();

  right.querySelectorAll(".opt__row").forEach((row) =>
    row.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      const i = Number(chip.dataset.i);
      row.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-active", c === chip));
      if (row.dataset.opt === "color") {
        color = colors[i];
        showVariantImage(colorImgs[i]);
      } else {
        size = sizes[i];
        showVariantImage(sizeImgs[i]);
      }
    })
  );

  right.querySelectorAll(".qty__btn").forEach((b) =>
    b.addEventListener("click", () => {
      qty = Math.max(1, qty + Number(b.dataset.step));
      qtyVal.textContent = String(qty);
      refreshTotal();
    })
  );

  right.querySelector("#buyBtn").addEventListener("click", (e) => {
    e.preventDefault();
    setDraft({ slug: p.slug, name: p.name, image: (p.images[0] || ""), unit: pr.now, qty, color, size });
    if (window.fbq) fbq("track", "InitiateCheckout", { content_name: p.name, value: pr.now * qty, currency: "MNT" });
    location.hash = "#/order";
  });

  /* ---- reviews ---- */
  if (revs.length) {
    const box = document.createElement("section");
    box.className = "reviews";
    box.innerHTML =
      `<h2 class="reviews__head">Хэрэглэгчдийн сэтгэгдэл</h2>` +
      revs
        .map(
          (r) => `<article class="rev">
            ${r.rating ? `<div class="rev__stars">${"★".repeat(Math.min(5, r.rating))}${"☆".repeat(Math.max(0, 5 - r.rating))}</div>` : ""}
            ${r.text ? `<p class="rev__text">${esc(r.text)}</p>` : ""}
            ${r.name ? `<span class="rev__name">— ${esc(r.name)}</span>` : ""}
            ${r.image ? `<div class="rev__shot"><img src="${imageUrl(r.image)}" alt="" loading="lazy"></div>` : ""}
          </article>`
        )
        .join("");
    pdp.appendChild(box);
  }

  if (window.fbq)
    fbq("track", "ViewContent", {
      content_ids: [p.slug],
      content_name: p.name,
      content_type: "product",
      value: pr.now,
      currency: "MNT",
    });
}

/* ========================================================================
   ORDER
   The pick made on the product page has to survive the hop to the form (and
   a refresh), so it is parked in sessionStorage rather than a bare variable.
   ===================================================================== */
const DRAFT_KEY = "ss_draft";
const setDraft = (d) => sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
const getDraft = () => {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
  } catch {
    return null;
  }
};

function renderOrder() {
  const d = getDraft();
  if (!d) return goHome();

  const ship = (DB.shop.delivery || []).length
    ? DB.shop.delivery
    : [{ name: "Энгийн хүргэлт", price: 6000 }, { name: "Шуурхай хүргэлт", price: 12000 }];

  const page = document.getElementById("orderPage");
  page.innerHTML = `
    <a class="back" href="#/p/${esc(d.slug)}">← Бараа руу буцах</a>
    <h1 class="page__title" style="font-size:clamp(1.8rem,9vw,3rem)">Захиалга</h1>

    <div class="order-grid" style="margin-top:1.6rem">
      <div>
        <div class="sum">
          <div class="sum__img"><img src="${imageUrl(d.image)}" alt=""></div>
          <div>
            <div class="sum__name">${esc(d.name)}</div>
            <div class="sum__meta">
              ${d.color ? esc(d.color) + " · " : ""}${d.size ? esc(d.size) + " · " : ""}${d.qty} ширхэг
            </div>
          </div>
        </div>

        <div class="field">
          <span class="field__label">ХҮРГЭЛТИЙН СОНГОЛТ</span>
          <div class="pick" id="shipPick">
            ${ship
              .map(
                (s, i) => `<div class="pick__item${i === 0 ? " is-active" : ""}" data-price="${s.price}" data-name="${esc(s.name)}">
                  <span class="pick__dot"></span>
                  <span class="pick__body">
                    <span class="pick__title">${esc(s.name)}</span>
                    ${s.priceMax ? `<span class="pick__sub">Оператор утсаар баталгаажуулна</span>` : ""}
                  </span>
                  <span class="pick__price">${s.priceMax ? money(s.price) + "–" + money(s.priceMax) : money(s.price)}</span>
                </div>`
              )
              .join("")}
          </div>
        </div>

        <div class="field">
          <span class="field__label">ТӨЛБӨРИЙН СОНГОЛТ</span>
          <div class="pick" id="payPick">
            <div class="pick__item is-active" data-pay="Хүргэлтээр төлөх">
              <span class="pick__dot"></span>
              <span class="pick__body">
                <span class="pick__title">Хүргэлтээр төлөх</span>
                <span class="pick__sub">Бараагаа хүлээж авахдаа төлнө</span>
              </span>
            </div>
            <div class="pick__item" data-pay="Шилжүүлгээр төлөх">
              <span class="pick__dot"></span>
              <span class="pick__body">
                <span class="pick__title">Шилжүүлгээр төлөх</span>
                <span class="pick__sub">Дансны мэдээлэл дараагийн алхамд</span>
              </span>
            </div>
          </div>
        </div>

        <div class="totals">
          <div class="totals__row"><span>Бараа (${d.qty}ш)</span><span id="tGoods"></span></div>
          <div class="totals__row"><span>Хүргэлт</span><span id="tShip"></span></div>
          <div class="totals__row totals__row--big"><span>Нийт</span><span id="tAll"></span></div>
        </div>
      </div>

      <div>
        <div class="field">
          <span class="field__label">НЭР</span>
          <input class="input" id="fName" type="text" placeholder="Таны нэр" autocomplete="name">
        </div>
        <div class="field">
          <span class="field__label">УТАСНЫ ДУГААР</span>
          <input class="input" id="fPhone" type="tel" inputmode="numeric" maxlength="8" placeholder="8 оронтой дугаар" autocomplete="tel">
        </div>
        <div class="field">
          <span class="field__label">ХҮРГҮҮЛЭХ ХАЯГ</span>
          <textarea class="input" id="fAddr" placeholder="Дүүрэг, хороо, байр, орц, тоот" autocomplete="street-address"></textarea>
        </div>

        <p class="err" id="formErr"></p>

        <a class="buy" href="#" id="submitBtn">
          <span class="buy__total" id="submitTotal"></span>
          <span class="buy__label">ЗАХИАЛГА БАТАЛГААЖУУЛАХ</span>
        </a>
        <p class="note">Илгээснээр таны захиалгын код үүсэж, бид тантай утсаар холбогдоно.</p>
      </div>
    </div>`;

  /* ---- live totals ---- */
  let shipPrice = Number(ship[0].price) || 0;
  let shipName = ship[0].name;
  let payment = "Хүргэлтээр төлөх";

  const goods = d.unit * d.qty;
  const tGoods = page.querySelector("#tGoods");
  const tShip = page.querySelector("#tShip");
  const tAll = page.querySelector("#tAll");
  const submitTotal = page.querySelector("#submitTotal");

  const refresh = () => {
    tGoods.textContent = money(goods);
    tShip.textContent = money(shipPrice);
    tAll.textContent = money(goods + shipPrice);
    submitTotal.textContent = `Нийт ${money(goods + shipPrice)}`;
  };
  refresh();

  page.querySelector("#shipPick").addEventListener("click", (e) => {
    const item = e.target.closest(".pick__item");
    if (!item) return;
    page.querySelectorAll("#shipPick .pick__item").forEach((n) => n.classList.toggle("is-active", n === item));
    shipPrice = Number(item.dataset.price) || 0;
    shipName = item.dataset.name;
    refresh();
  });

  page.querySelector("#payPick").addEventListener("click", (e) => {
    const item = e.target.closest(".pick__item");
    if (!item) return;
    page.querySelectorAll("#payPick .pick__item").forEach((n) => n.classList.toggle("is-active", n === item));
    payment = item.dataset.pay;
  });

  /* ---- submit ---- */
  const btn = page.querySelector("#submitBtn");
  const err = page.querySelector("#formErr");
  let sending = false;

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    if (sending) return;

    const name = page.querySelector("#fName").value.trim();
    const phone = page.querySelector("#fPhone").value.trim();
    const addr = page.querySelector("#fAddr").value.trim();

    if (!name) return (err.textContent = "Нэрээ бичнэ үү.");
    if (!/^\d{8}$/.test(phone)) return (err.textContent = "Утасны дугаар 8 оронтой тоо байх ёстой.");
    if (!addr) return (err.textContent = "Хүргүүлэх хаягаа бичнэ үү.");
    err.textContent = "";

    sending = true;
    btn.querySelector(".buy__label").textContent = "ИЛГЭЭЖ БАЙНА…";

    try {
      // text/plain keeps the browser from firing a CORS preflight that Apps
      // Script cannot answer; doPost reads the raw body either way.
      const res = await fetch(DATA_SOURCE, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          name, phone, address: addr,
          product: d.name, color: d.color, size: d.size,
          qty: d.qty, price: d.unit,
          delivery: shipPrice, deliveryName: shipName,
          payment,
        }),
      });
      const out = await res.json();
      if (!out.ok) throw new Error(out.error || "Тодорхойгүй алдаа");

      if (window.fbq)
        fbq("track", "Purchase", { value: goods + shipPrice, currency: "MNT", content_name: d.name });

      sessionStorage.setItem(
        "ss_done",
        JSON.stringify({ code: out.code, total: goods + shipPrice, payment, name, phone })
      );
      location.hash = "#/done";
    } catch (ex) {
      console.error(ex);
      err.textContent = "Илгээхэд алдаа гарлаа. Дахин оролдоно уу, эсвэл 8810-4640 руу залгана уу.";
      btn.querySelector(".buy__label").textContent = "ЗАХИАЛГА БАТАЛГААЖУУЛАХ";
      sending = false;
    }
  });
}

/* ========================================================================
   CONFIRMATION
   ===================================================================== */
function renderDone() {
  let info = null;
  try {
    info = JSON.parse(sessionStorage.getItem("ss_done") || "null");
  } catch {}
  if (!info) return goHome();

  const s = DB.shop || {};
  const transfer = info.payment === "Шилжүүлгээр төлөх";

  document.getElementById("donePage").innerHTML = `
    <div class="done">
      <div class="done__mark">✓</div>
      <h1 class="done__title">Захиалга хүлээн авлаа</h1>
      <p class="done__lead">
        ${esc(info.name)}, баярлалаа. Бид ${esc(info.phone)} дугаараар тантай холбогдож<br>
        захиалгыг баталгаажуулна.
      </p>

      <div class="code">
        <div class="code__label">ТАНЫ ЗАХИАЛГЫН КОД</div>
        <div class="code__value" id="codeVal">${esc(info.code)}</div>
        <button class="copy" id="copyBtn">Кодыг хуулах</button>
      </div>

      ${
        transfer
          ? `<div class="warn">
              <b>Гүйлгээний утга дээр яг <u>${esc(info.code)}</u> гэж бичнэ үү.</b><br>
              Утга буруу бол таны шилжүүлгийг захиалгатай тааруулахад хүндрэлтэй.
              Дээрх товчоор хуулж тавибал алдахгүй.
            </div>
            <div class="bank">
              <div class="bank__row"><span class="bank__k">Банк</span><span class="bank__v">${esc(s.bank || "")}</span></div>
              <div class="bank__row"><span class="bank__k">Данс</span><span class="bank__v">${esc(s.account || "")}</span></div>
              <div class="bank__row"><span class="bank__k">Хүлээн авагч</span><span class="bank__v">${esc(s.holder || "")}</span></div>
              <div class="bank__row"><span class="bank__k">Шилжүүлэх дүн</span><span class="bank__v">${money(info.total)}</span></div>
            </div>`
          : `<div class="bank">
              <div class="bank__row"><span class="bank__k">Төлбөр</span><span class="bank__v">Хүргэлтээр төлнө</span></div>
              <div class="bank__row"><span class="bank__k">Төлөх дүн</span><span class="bank__v">${money(info.total)}</span></div>
            </div>`
      }

      <p class="note">
        Асуух зүйл байвал: 8810-4640 · 9411-4495<br>
        Захиалгын кодоо хэлэхэд бид шууд олно.
      </p>
      <a class="buy" href="#/" style="margin-top:1.4rem">
        <span class="buy__label">НҮҮР ХУУДАС РУУ</span>
      </a>
    </div>`;

  const btn = document.getElementById("copyBtn");
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(info.code);
    } catch {
      const r = document.createRange();
      r.selectNode(document.getElementById("codeVal"));
      getSelection().removeAllRanges();
      getSelection().addRange(r);
      document.execCommand("copy");
      getSelection().removeAllRanges();
    }
    btn.textContent = "Хуулагдлаа ✓";
    btn.classList.add("is-done");
  });
}

/* ========================================================================
   POLICIES
   Meta requires these to be reachable before ads can run. The wording below
   is a working draft — the shop owner should read it through and adjust the
   terms it commits to.
   ===================================================================== */
const POLICIES = {
  delivery: {
    title: "Хүргэлтийн нөхцөл",
    body: `
      <h2>Хүргэлтийн төрөл, төлбөр</h2>
      <ul>
        <li>Энгийн хүргэлт — 6,000₮</li>
        <li>Шуурхай хүргэлт — 12,000₮</li>
        <li>Алслагдсан бүс — 8,000₮–12,000₮ (оператор утсаар баталгаажуулна)</li>
      </ul>
      <h2>Хугацаа</h2>
      <p>Захиалга баталгаажсанаас хойш 8–12 цагийн дотор хүргэнэ. Хүргэлтийн ажилтан
      очихоосоо өмнө таны утсанд заавал холбогдоно.</p>
      <h2>Анхаарах</h2>
      <p>Хаяг буруу, эсвэл заасан хугацаанд утсаа авахгүй тохиолдолд хүргэлт хойшлох
      боломжтой. Ийм тохиолдолд дахин хүргэлтийн төлбөр нэмж гарч болно.</p>
      <h2>Лавлах</h2>
      <p>8810-4640 · 9411-4495</p>`,
  },
  refund: {
    title: "Буцаалтын бодлого",
    body: `
      <h2>Буцаах боломжтой тохиолдол</h2>
      <ul>
        <li>Захиалсанаас өөр бараа ирсэн</li>
        <li>Бараа гэмтэлтэй, эвдэрсэн байдалтай ирсэн</li>
        <li>Үйлдвэрийн доголдолтой болох нь тогтоогдсон</li>
      </ul>
      <h2>Хугацаа</h2>
      <p>Бараагаа хүлээн авснаас хойш <b>48 цагийн дотор</b> бидэнтэй холбогдож мэдэгдэнэ үү.
      Энэ хугацаанаас хойш ирсэн хүсэлтийг шийдвэрлэх боломж хязгаарлагдмал.</p>
      <h2>Нөхцөл</h2>
      <ul>
        <li>Бараа хэрэглээгүй, анхны сав баглаа боодолтойгоо байх</li>
        <li>Захиалгын код эсвэл утасны дугаараар баталгаажуулах</li>
      </ul>
      <h2>Буцаан олголт</h2>
      <p>Хүсэлт зөвшөөрөгдсөн тохиолдолд барааг солих, эсвэл төлсөн дүнг таны дансанд
      3–5 ажлын өдрийн дотор буцаана.</p>
      <h2>Буцаалт хийгдэхгүй</h2>
      <p>Хэрэглэсэн, эвдэрсэн, эсвэл хэрэглэгчийн буруугаас гэмтсэн бараанд буцаалт
      хийгдэхгүй.</p>`,
  },
  terms: {
    title: "Үйлчилгээний нөхцөл",
    body: `
      <h2>Ерөнхий</h2>
      <p>Энэхүү сайтаар захиалга өгснөөр та доорх нөхцөлийг хүлээн зөвшөөрч байна.</p>
      <h2>Захиалга</h2>
      <ul>
        <li>Захиалга өгөхөд үнэн зөв нэр, утас, хаяг оруулах шаардлагатай</li>
        <li>Захиалга бүрт давтагдашгүй код олгогдоно</li>
        <li>Бид тантай утсаар холбогдож захиалгыг баталгаажуулна</li>
      </ul>
      <h2>Үнэ</h2>
      <p>Сайт дээрх үнэ Монгол төгрөгөөр илэрхийлэгдэнэ. Үнэ, хямдрал урьдчилан
      мэдэгдэлгүй өөрчлөгдөж болно. Захиалга баталгаажсан үеийн үнэ хүчинтэй.</p>
      <h2>Хариуцлага</h2>
      <p>Бид барааг зөв, бүрэн бүтэн хүргэх үүрэгтэй. Хүргэлтийн дараа хэрэглэгчийн
      буруутай үйлдлээс үүдсэн гэмтэлд хариуцлага хүлээхгүй.</p>`,
  },
  privacy: {
    title: "Нууцлалын бодлого",
    body: `
      <h2>Цуглуулдаг мэдээлэл</h2>
      <p>Захиалга биелүүлэхэд шаардлагатай доорх мэдээллийг л цуглуулна:</p>
      <ul>
        <li>Нэр</li>
        <li>Утасны дугаар</li>
        <li>Хүргүүлэх хаяг</li>
      </ul>
      <h2>Хэрхэн ашигладаг</h2>
      <p>Зөвхөн захиалгыг боловсруулах, хүргэх, тантай холбогдоход ашиглана.
      Бид таны мэдээллийг гуравдагч этгээдэд зардаггүй.</p>
      <h2>Хадгалалт</h2>
      <p>Мэдээлэл Google Sheets дээр хамгаалалттай хадгалагдана. Идэвхтэй захиалгын
      бүртгэл 48 цагийн дараа архивын хэсэгт шилжинэ.</p>
      <h2>Күүки ба хэмжилт</h2>
      <p>Сайт Meta Pixel ашиглан зочилсон хуудас, худалдан авалтын үйлдлийг хэмждэг.
      Энэ нь сурталчилгааны үр дүнг тооцоход зориулагдана.</p>
      <h2>Таны эрх</h2>
      <p>Өөрийн мэдээллийг устгуулах хүсэлтэй бол Ariunbold.agency@gmail.com хаягаар
      хандана уу.</p>`,
  },
  contact: {
    title: "Холбоо барих",
    body: `
      <h2>Утас</h2>
      <p>8810-4640 · 9411-4495</p>
      <h2>Имэйл</h2>
      <p>Ariunbold.agency@gmail.com</p>
      <h2>Ажиллах цаг</h2>
      <p>Даваа–Ням, 09:00–20:00</p>
      <h2>Захиалгын талаар асуух</h2>
      <p>Захиалгын кодоо (жишээ: SS-0001) хэлэхэд бид таны захиалгыг шууд олох
      боломжтой.</p>`,
  },
};

function renderPolicy(key) {
  const p = POLICIES[key] || POLICIES.contact;
  document.getElementById("policyPage").innerHTML = `
    <a class="back" href="#/">← Нүүр</a>
    <h1 class="page__title" style="font-size:clamp(1.8rem,9vw,3rem)">${esc(p.title)}</h1>
    <div class="prose">${p.body}</div>`;
}

/* ========================================================================
   ROUTER
   ===================================================================== */
const views = {
  home: document.getElementById("viewHome"),
  category: document.getElementById("viewCategory"),
  product: document.getElementById("viewProduct"),
  order: document.getElementById("viewOrder"),
  done: document.getElementById("viewDone"),
  policy: document.getElementById("viewPolicy"),
};

const goHome = () => (location.hash = "#/");

function show(name) {
  Object.entries(views).forEach(([k, el]) => (el.hidden = k !== name));
  railEl.hidden = name !== "home";
  if (name !== "home") edgeEl.classList.remove("is-shown");
}

function route() {
  const [kind, slug] = location.hash.replace(/^#\/?/, "").split("/");
  stopFrames();

  if (kind === "c" && slug) {
    destroyHomeMotion();
    show("category");
    renderCategory(slug);
    startFrames(views.category);
  } else if (kind === "p" && slug) {
    destroyHomeMotion();
    show("product");
    renderProduct(slug);
    startFrames(views.product);
  } else if (kind === "order") {
    destroyHomeMotion();
    show("order");
    renderOrder();
  } else if (kind === "done") {
    destroyHomeMotion();
    show("done");
    renderDone();
  } else if (kind === "policy") {
    destroyHomeMotion();
    show("policy");
    renderPolicy(slug);
  } else {
    show("home");
    buildHomeMotion();
    setRail("hero");
  }

  window.scrollTo(0, 0);
  ScrollTrigger.refresh();
  if (window.fbq) fbq("track", "PageView");
}

window.addEventListener("hashchange", route);

/* ========================================================================
   BOOT
   ===================================================================== */
document.getElementById("year").textContent = new Date().getFullYear();

function loadCatalog() {
  return fetch(DATA_SOURCE)
    .then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .catch((err) => {
      console.warn("Sheet-ээс уншиж чадсангүй, локал каталог руу шилжлээ:", err);
      return fetch(DATA_FALLBACK).then((r) => r.json());
    });
}

loadCatalog()
  .then((data) => {
    DB = {
      shop: data.shop || {},
      categories: data.categories || [],
      products: (data.products || []).map((p) => ({ ...p, images: listOf(p.images) })),
      reviews: data.reviews || [],
    };
    renderCategories();
    showCat(0);
    route();
  })
  .catch((err) => {
    console.error("Каталог ачаалж чадсангүй:", err);
    catsStage.innerHTML = '<p style="opacity:.6;font-size:.85rem">Каталог ачаалж чадсангүй.</p>';
  });
