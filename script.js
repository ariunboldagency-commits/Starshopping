gsap.registerPlugin(ScrollTrigger);

/* ---------- 1) calm load-in ---------- */
const loadTl = gsap.timeline({ defaults: { ease: "power2.out" } });

loadTl
  .from(".hero__nav", { y: -12, opacity: 0, duration: 0.5 })
  .from(".hero__badges span", { y: -8, opacity: 0, duration: 0.4, stagger: 0.06 }, "-=0.25")
  .from(".hero__product, .drift-product", { opacity: 0, scale: 0.96, duration: 0.6, stagger: 0.08 }, "-=0.2")
  .from(".hero__title", { y: 16, opacity: 0, duration: 0.45 }, "-=0.25")
  .from(".hero__subtitle", { y: 12, opacity: 0, duration: 0.4 }, "-=0.25")
  .from(".hero__cta", { y: 12, opacity: 0, duration: 0.4 }, "-=0.2");

/* ---------- 2) the drift product descends from the hero into the
   category section's left column as the page scrolls — tracks the
   scrollbar 1:1 (scrub:true), no easing lag ---------- */
gsap.to("#driftProduct", {
  top: "62%",
  left: "3%",
  width: "30%",
  rotate: -4,
  ease: "none",
  scrollTrigger: {
    trigger: "#hero",
    start: "top top",
    endTrigger: "#categories",
    end: "30% top",
    scrub: true,
  },
});

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
