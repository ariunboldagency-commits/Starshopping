gsap.registerPlugin(ScrollTrigger);

/* ---------- 1) simple, calm load-in (no falling/bounce) ---------- */
const loadTl = gsap.timeline({ defaults: { ease: "power2.out" } });

loadTl
  .from(".hero__nav", { y: -12, opacity: 0, duration: 0.5 })
  .from(".hero__badges span", { y: -8, opacity: 0, duration: 0.4, stagger: 0.06 }, "-=0.25")
  .from(".hero__product", { opacity: 0, scale: 0.96, duration: 0.6, stagger: 0.08 }, "-=0.2")
  .from(".hero__title", { y: 16, opacity: 0, duration: 0.45 }, "-=0.25")
  .from(".hero__subtitle", { y: 12, opacity: 0, duration: 0.4 }, "-=0.25")
  .from(".hero__cta", { y: 12, opacity: 0, duration: 0.4 }, "-=0.2");

/* ---------- 2) scroll: only ONE product drifts smoothly downward ---------- */
const driftTarget = document.querySelector("[data-scroll-drift]");

if (driftTarget) {
  gsap.to(driftTarget, {
    y: "+=220",
    ease: "none",
    scrollTrigger: {
      trigger: "#hero",
      start: "top top",
      end: "bottom top",
      scrub: 0.6,
    },
  });
}

/* ---------- 3) next section arrives as hero scrolls away ---------- */
gsap.from("#categories", {
  scrollTrigger: {
    trigger: "#categories",
    start: "top bottom",
    end: "top center",
    scrub: 0.6,
  },
  y: 50,
  opacity: 0,
  ease: "none",
});
