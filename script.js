gsap.registerPlugin(ScrollTrigger);

/* ========================================================================
   1 · HERO — scrolling flies the viewer into the camera lens.

   Two things have to happen together. The image scales about the lens
   (transform-origin, set in CSS), and the lens itself travels to the middle
   of the screen — otherwise the zoom races off toward wherever the lens
   happened to sit, which reads as drifting past the subject rather than
   entering it. Because the origin sits on the lens, the lens ends up exactly
   at origin + translation regardless of scale, so the offsets below are just
   the gap between the lens and the centre of the hero.
   ===================================================================== */
const heroEl = document.getElementById("hero");
const camImg = document.querySelector(".hero__cam img");

const lensOffset = (axis) => () => {
  const hero = heroEl.getBoundingClientRect();
  const img = camImg.getBoundingClientRect();
  const lensX = img.left - hero.left + img.width * 0.521;
  const lensY = img.top - hero.top + img.height * 0.875;
  return axis === "x" ? hero.width / 2 - lensX : hero.height / 2 - lensY;
};

gsap
  .timeline({
    scrollTrigger: {
      trigger: "#hero",
      start: "top top",
      end: "+=190%",
      scrub: 0.5,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true, // re-measure the lens after a resize
    },
  })
  .to(".hero__cue", { opacity: 0, duration: 0.12 }, 0)
  .to(".hero__word", { opacity: 0, duration: 0.34, ease: "power1.in" }, 0.04)
  .to(
    camImg,
    {
      scale: 11,
      x: lensOffset("x"),
      y: lensOffset("y"),
      duration: 1,
      ease: "power2.in",
    },
    0
  )
  .to(".hero__veil", { opacity: 1, duration: 0.3 }, 0.7);

/* ========================================================================
   2 · CATEGORIES — the next screen grows back out of that darkness.
   ===================================================================== */
gsap.fromTo(
  ".cats__emerge",
  { scale: 0.3, opacity: 0 },
  {
    scale: 1,
    opacity: 1,
    ease: "power2.out",
    scrollTrigger: {
      trigger: "#cats",
      start: "top 92%",
      end: "top 12%",
      scrub: 0.5,
    },
  }
);

/* ---- browsing the categories: arrows step through them, and they also
   advance on their own while the section is on screen ---- */
const cards = Array.from(document.querySelectorAll(".cat"));
const arrows = Array.from(document.querySelectorAll(".arrow"));
const counter = document.getElementById("catIndex");
let current = 0;
let timer = null;

const showCat = (i) => {
  current = (i + cards.length) % cards.length;
  cards.forEach((c, n) => c.classList.toggle("is-active", n === current));
  counter.textContent = String(current + 1).padStart(2, "0");
};

const startCycle = () => {
  stopCycle();
  timer = setInterval(() => showCat(current + 1), 5000);
};
const stopCycle = () => {
  if (timer) clearInterval(timer);
  timer = null;
};

arrows.forEach((arrow) =>
  arrow.addEventListener("click", () => {
    showCat(current + Number(arrow.dataset.dir));
    startCycle(); // a manual pick gets a full turn before auto-advance resumes
  })
);

ScrollTrigger.create({
  trigger: "#cats",
  start: "top 80%",
  end: "bottom 20%",
  onToggle: (self) => (self.isActive ? startCycle() : stopCycle()),
});

/* ========================================================================
   3 · chrome that follows the active section
   ===================================================================== */
const railLines = Array.from(document.querySelectorAll(".rail__line"));
const edge = document.querySelector(".edge");

const setSection = (id) => {
  railLines.forEach((l) => l.classList.toggle("is-active", l.dataset.goto === id));
  edge.classList.add("is-shown");
};

["hero", "cats"].forEach((id) => {
  ScrollTrigger.create({
    trigger: `#${id}`,
    start: "top 55%",
    end: "bottom 45%",
    onEnter: () => setSection(id),
    onEnterBack: () => setSection(id),
  });
});
setSection("hero");

railLines.forEach((line) =>
  line.addEventListener("click", () =>
    document.getElementById(line.dataset.goto)?.scrollIntoView({ behavior: "smooth" })
  )
);
