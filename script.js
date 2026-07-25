/* Chaptered scroll experience — no animation library needed.
   Scroll snapping is CSS; this file only tracks which chapter is on screen
   and drives the small pieces of state that follow from it. */

const chapters = Array.from(document.querySelectorAll(".chapter"));
const lines = Array.from(document.querySelectorAll(".progress__line"));
const corner = document.querySelector(".corner");

/* ---- active chapter → entrance animations, progress rail, corner mark ---- */
const setActive = (id) => {
  chapters.forEach((c) => c.classList.toggle("is-active", c.id === id));
  lines.forEach((l) => l.classList.toggle("is-active", l.dataset.goto === id));
  // the corner mark is noise on the hero, useful everywhere after it
  corner.classList.toggle("is-shown", id !== "c1");
};

const observer = new IntersectionObserver(
  (entries) => {
    // the most-visible chapter wins, so fast scrolls don't leave a stale state
    const visible = entries
      .filter((e) => e.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) setActive(visible.target.id);
  },
  { threshold: [0.35, 0.6, 0.9] }
);

chapters.forEach((c) => observer.observe(c));
setActive("c1");

/* ---- progress rail doubles as navigation ---- */
lines.forEach((line) => {
  line.addEventListener("click", () => {
    document.getElementById(line.dataset.goto)?.scrollIntoView({ behavior: "smooth" });
  });
});

/* ---- colour swatches cross-fade the stacked product layers ----
   Layers are placeholders today; each will become a real per-colour photo
   pulled from the product sheet. */
const swatches = document.querySelectorAll(".swatch");
const layers = document.querySelectorAll(".layer");

swatches.forEach((swatch) => {
  swatch.addEventListener("click", () => {
    const variant = swatch.dataset.variant;
    swatches.forEach((s) => s.classList.toggle("is-active", s === swatch));
    layers.forEach((l) => l.classList.toggle("is-active", l.dataset.variant === variant));
  });
});

/* ---- size selection ---- */
const sizes = document.querySelectorAll(".size");
sizes.forEach((size) => {
  size.addEventListener("click", () => {
    sizes.forEach((s) => s.classList.toggle("is-active", s === size));
  });
});
