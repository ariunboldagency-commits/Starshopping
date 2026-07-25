gsap.registerPlugin(ScrollTrigger);

const panels = gsap.utils.toArray(".category-panel");

panels.forEach((panel, i) => {
  const product = panel.querySelector(".category-panel__product");
  const label = panel.querySelector(".category-panel__label");
  const fromSide = i % 2 === 0 ? -1 : 1;

  gsap.set(product, {
    xPercent: fromSide * 140,
    rotate: fromSide * -18,
    scale: 0.7,
    opacity: 0,
  });
  gsap.set(label, { opacity: 0, y: 24 });

  const entrance = gsap.timeline({
    scrollTrigger: {
      trigger: panel,
      start: "top bottom",
      end: "top center",
      scrub: 0.6,
    },
  });

  entrance
    .to(product, {
      xPercent: 0,
      rotate: 0,
      scale: 1,
      opacity: 1,
      ease: "power2.out",
    })
    .to(label, { opacity: 1, y: 0, ease: "power2.out" }, "<0.15");

  // gentle idle float once the product has settled into view
  gsap.to(product, {
    y: "+=14",
    rotate: fromSide * 1.5,
    duration: 2.6,
    ease: "sine.inOut",
    repeat: -1,
    yoyo: true,
    scrollTrigger: {
      trigger: panel,
      start: "top center",
      end: "bottom top",
      toggleActions: "play pause resume pause",
    },
  });
});
