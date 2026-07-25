gsap.registerPlugin(ScrollTrigger);

/* ---------- 1) load-in: products drop and settle ---------- */
const loadTl = gsap.timeline({ defaults: { ease: "power2.out" } });

loadTl
  .from(".hero__nav", { y: -20, opacity: 0, duration: 0.6 })
  .from(".hero__badges span", { y: -10, opacity: 0, duration: 0.5, stagger: 0.08 }, "-=0.3")
  .from(".hero__product--1", {
    y: -260, rotate: -22, opacity: 0, duration: 1,
    ease: "bounce.out",
  }, "-=0.2")
  .from(".hero__product--2", {
    y: -320, rotate: 16, opacity: 0, duration: 1.1,
    ease: "bounce.out",
  }, "-=0.85")
  .from(".hero__seal", { scale: 0, rotate: -90, opacity: 0, duration: 0.5, ease: "back.out(2)" }, "-=0.3")
  .from(".hero__title", { y: 20, opacity: 0, duration: 0.5 }, "-=0.25")
  .from(".hero__subtitle", { y: 16, opacity: 0, duration: 0.45 }, "-=0.3")
  .from(".hero__cta", { y: 16, opacity: 0, duration: 0.45 }, "-=0.25");

/* subtle idle float once settled */
gsap.to(".hero__product--1", { y: "+=10", rotate: "+=2", duration: 2.4, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 1.4 });
gsap.to(".hero__product--2", { y: "+=14", rotate: "-=1.5", duration: 2.8, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 1.6 });

/* ---------- 2) scroll: hero recedes like a camera pulling back/down ---------- */
gsap.timeline({
  scrollTrigger: {
    trigger: "#hero",
    start: "top top",
    end: "bottom top",
    scrub: 0.6,
    pin: true,
    pinSpacing: true,
  },
})
  .to("#hero", { scale: 0.88, y: -30, opacity: 0.35, ease: "none" })
  .to(".hero__stage img", { y: "-=40", ease: "none" }, "<");

gsap.from("#categories", {
  scrollTrigger: {
    trigger: "#categories",
    start: "top bottom",
    end: "top center",
    scrub: 0.6,
  },
  y: 60,
  opacity: 0,
  ease: "none",
});
