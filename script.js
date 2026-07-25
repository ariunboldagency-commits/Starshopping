gsap.registerPlugin(ScrollTrigger);

/* ========================================================================
   DATA
   The shape below is the contract with the sheet. When the Apps Script web
   app is deployed, only this one line changes — it returns the same JSON,
   so nothing downstream has to be touched.
   ===================================================================== */
const DATA_SOURCE = "data/catalog.json";

let DB = { shop: {}, categories: [], products: [] };

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

const money = (n) => Number(n).toLocaleString("en-US").replace(/,/g, ",") + "₮";

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

/* ========================================================================
   IMAGE FRAMES — every product photo comes from the sheet at an unknown
   size and aspect, so each sits in a fixed frame and the set slides through
   on its own.
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
    const count = Number(frame.dataset.count || 1);
    if (count < 2) return;
    const track = frame.querySelector(".frame__track");
    let idx = 0;
    const tick = () => {
      idx = (idx + 1) % count;
      track.style.transform = `translateX(-${idx * 100}%)`;
      frame.dispatchEvent(new CustomEvent("frame:index", { detail: idx }));
    };
    // stagger so a list of rows doesn't flip in lockstep
    const timer = setInterval(tick, 2600 + (i % 4) * 320);
    frameTimers.push(timer);
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
          ${lines.map((l) => `<span>${l}</span>`).join("")}
        </h2>
        <a class="cat__cta" href="#/c/${c.slug}">
          <span class="cat__count">${count} бараа</span>
          <span class="cat__go">Үзэх →</span>
        </a>
      </div>
      <div class="cat__img"><img src="${imageUrl(c.image)}" alt="${c.name}"></div>`;
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
   HOME · motion. Created on entering home and torn down on leaving, so the
   pinned hero never fights a hidden section.
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
     lens (transform-origin in CSS) while the lens itself travels to the
     middle of the screen, so it reads as entering rather than drifting by. */
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
      {
        scale: 1, opacity: 1, ease: "power2.out",
        scrollTrigger: { trigger: "#cats", start: "top 92%", end: "top 12%", scrub: 0.5 },
      }
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
   CATEGORY VIEW · one product per row
   ===================================================================== */
const plist = document.getElementById("plist");

function renderCategory(slug) {
  const cat = categoryBy(slug);
  const items = productsIn(slug);
  document.getElementById("catTitle").textContent = cat ? cat.name : "Категори";
  document.getElementById("catMeta").textContent = `${items.length} БАРАА`;

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
      <span class="prow__name">${p.name}</span>
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
const pdp = document.getElementById("pdp");

function renderProduct(slug) {
  const p = productBy(slug);
  if (!p) return goHome();
  const pr = priceOf(p);
  const colors = listOf(p.colors);
  const sizes = listOf(p.sizes);
  const cat = categoryBy(p.category);

  pdp.innerHTML = "";

  const back = document.createElement("a");
  back.className = "back";
  back.href = `#/c/${p.category}`;
  back.textContent = `← ${cat ? cat.name : "Буцах"}`;
  pdp.appendChild(back);

  const wrap = document.createElement("div");
  wrap.className = "pdp";

  const left = document.createElement("div");
  left.className = "pdp__left";
  const gallery = buildFrame(p.images, "pdp__gallery");
  left.appendChild(gallery);

  const count = Number(gallery.dataset.count || 1);
  if (count > 1) {
    const dots = document.createElement("div");
    dots.className = "pdp__dots";
    for (let i = 0; i < count; i++) {
      const d = document.createElement("span");
      d.className = "pdot" + (i === 0 ? " is-active" : "");
      dots.appendChild(d);
    }
    left.appendChild(dots);
    gallery.addEventListener("frame:index", (e) => {
      dots.querySelectorAll(".pdot").forEach((d, n) => d.classList.toggle("is-active", n === e.detail));
    });
  }
  wrap.appendChild(left);

  const right = document.createElement("div");
  right.innerHTML = `
    <h1 class="pdp__name">${p.name}</h1>
    ${p.desc ? `<p class="pdp__desc">${p.desc}</p>` : ""}
    <div class="pdp__prices">
      <span class="price-now">${money(pr.now)}</span>
      ${pr.on ? `<span class="price-was">${money(pr.was)}</span>` : ""}
      ${pr.on ? `<span class="tag">-${pr.pct}%</span>` : ""}
    </div>

    ${colors.length ? `<div class="opt"><span class="opt__label">ӨНГӨ</span>
      <div class="opt__row" data-opt="color">
        ${colors.map((c, i) => `<button class="chip${i === 0 ? " is-active" : ""}">${c}</button>`).join("")}
      </div></div>` : ""}

    ${sizes.length ? `<div class="opt"><span class="opt__label">ХЭМЖЭЭ</span>
      <div class="opt__row" data-opt="size">
        ${sizes.map((s, i) => `<button class="chip${i === 0 ? " is-active" : ""}">${s}</button>`).join("")}
      </div></div>` : ""}

    <div class="opt"><span class="opt__label">ТОО ШИРХЭГ</span>
      <div class="qty">
        <button class="qty__btn" data-step="-1">−</button>
        <span class="qty__val" id="qtyVal">1</span>
        <button class="qty__btn" data-step="1">+</button>
      </div>
    </div>

    <a class="buy" href="#" id="buyBtn">ЗАХИАЛАХ</a>
    <p class="note">Хүргэлт: энгийн 6,000₮ · шуурхай 12,000₮<br>Утас: 8810-4640 · 9411-4495</p>`;
  wrap.appendChild(right);
  pdp.appendChild(wrap);

  // option chips
  right.querySelectorAll(".opt__row").forEach((row) =>
    row.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      row.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-active", c === chip));
    })
  );

  // quantity
  let qty = 1;
  const qtyVal = right.querySelector("#qtyVal");
  right.querySelectorAll(".qty__btn").forEach((b) =>
    b.addEventListener("click", () => {
      qty = Math.max(1, qty + Number(b.dataset.step));
      qtyVal.textContent = String(qty);
    })
  );

  /* The automated order flow (sheet + order code) is the next phase, so the
     button is honest about it and offers the phone line meanwhile. */
  right.querySelector("#buyBtn").addEventListener("click", (e) => {
    e.preventDefault();
    if (window.fbq) fbq("track", "InitiateCheckout", { content_name: p.name, value: pr.now, currency: "MNT" });
    alert(
      `${p.name}\nТоо: ${qty}\n\nЗахиалгын автомат форм дараагийн шатанд холбогдоно ` +
      `(Google Sheet + SS-0001 код).\n\nОдоохондоо утсаар захиалах боломжтой:\n8810-4640 / 9411-4495`
    );
  });

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
   ROUTER — hash based, so deep links survive GitHub Pages without any
   server rewrites and every product still has its own address for the pixel.
   ===================================================================== */
const views = {
  home: document.getElementById("viewHome"),
  category: document.getElementById("viewCategory"),
  product: document.getElementById("viewProduct"),
};

const goHome = () => (location.hash = "#/");

function show(name) {
  Object.entries(views).forEach(([k, el]) => (el.hidden = k !== name));
  railEl.hidden = name !== "home";
  if (name !== "home") edgeEl.classList.remove("is-shown");
}

function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [kind, slug] = hash.split("/");

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
fetch(DATA_SOURCE)
  .then((r) => r.json())
  .then((data) => {
    DB = {
      shop: data.shop || {},
      categories: data.categories || [],
      products: (data.products || []).map((p) => ({ ...p, images: listOf(p.images) })),
    };
    renderCategories();
    showCat(0);
    route();
  })
  .catch((err) => {
    console.error("Каталог ачаалж чадсангүй:", err);
    document.getElementById("catsStage").innerHTML =
      '<p style="opacity:.6;font-size:.85rem">Каталог ачаалж чадсангүй.</p>';
  });
