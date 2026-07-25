gsap.registerPlugin(ScrollTrigger);

/* ========================================================================
   1 · HERO — scrolling drives the camera toward the viewer until we are
   inside the lens. The image pivots on the lens centre (set in CSS as
   --lens-x/--lens-y) so that one point stays put while everything else
   expands past the edges of the screen. The veil closes the last of the
   gap so the section hands off as unbroken black.
   ===================================================================== */
gsap
  .timeline({
    scrollTrigger: {
      trigger: "#hero",
      start: "top top",
      end: "+=190%",
      scrub: 0.5,
      pin: true,
      anticipatePin: 1,
    },
  })
  .to(".hero__cue", { opacity: 0, duration: 0.12 }, 0)
  .to(".hero__word", { opacity: 0, duration: 0.34, ease: "power1.in" }, 0.04)
  .to(".hero__cam", { scale: 10, duration: 1, ease: "power2.in" }, 0)
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

/* ---- the two categories trade places, the way the reference cycles its
   colourways. Auto-advance pauses while the section is off screen. ---- */
const cards = Array.from(document.querySelectorAll(".cat"));
const dots = Array.from(document.querySelectorAll(".dot"));
let current = 0;
let timer = null;

const showCat = (i) => {
  current = i;
  cards.forEach((c, n) => c.classList.toggle("is-active", n === i));
  dots.forEach((d, n) => d.classList.toggle("is-active", n === i));
};

const startCycle = () => {
  stopCycle();
  timer = setInterval(() => showCat((current + 1) % cards.length), 3800);
};
const stopCycle = () => {
  if (timer) clearInterval(timer);
  timer = null;
};

dots.forEach((dot) =>
  dot.addEventListener("click", () => {
    showCat(Number(dot.dataset.cat));
    startCycle(); // restart the clock so a manual pick gets its full turn
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
  edge.classList.toggle("is-shown", id !== "detail");
};

["hero", "cats", "detail"].forEach((id) => {
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

/* ========================================================================
   4 · product options
   ===================================================================== */
const bars = document.querySelectorAll(".bar");
const layers = document.querySelectorAll(".layer");

bars.forEach((bar) =>
  bar.addEventListener("click", () => {
    const v = bar.dataset.variant;
    bars.forEach((b) => b.classList.toggle("is-active", b === bar));
    layers.forEach((l) => l.classList.toggle("is-active", l.dataset.variant === v));
  })
);

const sizes = document.querySelectorAll(".size");
sizes.forEach((size) =>
  size.addEventListener("click", () => {
    sizes.forEach((s) => s.classList.toggle("is-active", s === size));
  })
);
