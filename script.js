gsap.registerPlugin(ScrollTrigger);

/* ---------- 1) calm load-in ---------- */
gsap.timeline({ defaults: { ease: "power2.out" } })
  .from(".hero__nav", { y: -12, opacity: 0, duration: 0.5 })
  .from(".hero__badges span", { y: -8, opacity: 0, duration: 0.4, stagger: 0.06 }, "-=0.25")
  .from(".product", { opacity: 0, scale: 0.96, duration: 0.6, stagger: 0.08 }, "-=0.2")
  .from(".hero__title", { y: 16, opacity: 0, duration: 0.45 }, "-=0.25")
  .from(".hero__subtitle", { y: 12, opacity: 0, duration: 0.4 }, "-=0.25")
  .from(".hero__cta", { y: 12, opacity: 0, duration: 0.4 }, "-=0.2");

/* ---------- 2) the front product drifts down into the category column ----------
   Rather than guessing offsets, we measure the product and its landing box and
   tween the exact delta between their centres. invalidateOnRefresh re-measures
   on resize, so the landing stays accurate at any viewport size. */
const drift = document.getElementById("driftProduct");
const target = document.getElementById("driftTarget");

if (drift && target) {
  const delta = (axis) => () => {
    const d = drift.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    return axis === "x"
      ? (t.left + t.width / 2) - (d.left + d.width / 2)
      : (t.top + t.height / 2) - (d.top + d.height / 2);
  };

  gsap.to(drift, {
    x: delta("x"),
    y: delta("y"),
    scale: 0.86,
    rotate: -5,
    ease: "none",
    scrollTrigger: {
      trigger: "#hero",
      start: "top top",
      endTrigger: "#categories",
      end: "center center",
      scrub: true,
      invalidateOnRefresh: true,
    },
  });
}

/* ---------- 3) category copy arrives as its column comes into view ---------- */
gsap.from(".next-section__zone--content", {
  scrollTrigger: {
    trigger: "#categories",
    start: "top bottom",
    end: "top center",
    scrub: 0.6,
  },
  y: 40,
  opacity: 0,
  ease: "none",
});
