# Starshopping — шинэ session-д өгөх даалгавар

> **2026-09-08: ДУУССАН.** Бүх 5 ажил хийгдэж хэмжигдсэн — `REPORT-2026-09-08-DONE.md`
> ба `patches/0001…0005`-ыг үз. Үлдсэн нь амьд repo-д тавих (`apply.sh`).

Энэ файлыг `starshopping-mn/starshopping-mn.github.io` repo дээр эхлүүлсэн
session уншина. Эзэн бүх ажлыг асуулгүй дуусгахыг хүссэн.

---

You are working in the live Starshopping shop repository (Mongolian dropshipping site, GitHub Pages + Google Apps Script). The owner is non-technical, speaks Mongolian, and has asked for all of this to be finished without further questions. Reply to them in Mongolian, briefly. Work autonomously; do not use plan mode; do not stop to ask unless something would be destructive.

FIRST read CLAUDE.md in full. Its §3 lists things that must never break (hero lens zoom, pin order, no third-party resources on the critical path, no filter on the zoomed image, veil timing is a Safari safeguard), §4 the deploy rules, §6 how to measure, §8 working style ("measure, don't guess"). Follow them.

A review was done on 2026-09-08 by measurement. Its report, a ready patch, and the measurement harness live on a branch of the old repository. Fetch them:

    git fetch https://github.com/ariunboldagency-commits/Starshopping claude/fable-5-1-web-upgrade-vcd9jp
    git show FETCH_HEAD:HANDOVER/REVIEW-2026-09-08.md > /tmp/REVIEW.md
    git show FETCH_HEAD:HANDOVER/patches/0001-open-a-product-link-on-the-product.patch > /tmp/0001.patch
    mkdir -p /tmp/measure && for f in measure.js home.js deadzone.js; do git show FETCH_HEAD:HANDOVER/measure/$f > /tmp/measure/$f; done

Read /tmp/REVIEW.md. Then do these, in order, verifying each by measurement before pushing:

1. DEEP-LINK FIX. `git am /tmp/0001.patch` (touches only index.html). Verify locally: `python3 -m http.server 8777` in the repo, then run the harness (edit ORIGIN/paths in the scripts as needed; Playwright and Chromium are preinstalled, see the env vars). Expected: on `#/p/<slug>` the home view is never visible and the hero image is not fetched; on `/` the hero preload still fires at parse time; zoom invariants at 1280x800, 390x844, 390x600 are scale 11, lens offset 0/0, pin gap 0, no console errors. Push to main per CLAUDE.md §4 so Pages deploys, then re-run the deep-link measurement against the live site.

2. FEED REDRAW. When the Apps Script feed lands 5-8 s after the page, `paint(first:false)` redraws the product page and the gallery restarts at photo 1 — a visible jump. Skip the redraw when the product's data is unchanged (compare the product's JSON from the offline copy with the feed's). Keep the redraw when it differs. Measure that the gallery index survives.

3. ZOOM DEAD ZONE. Measured: the veil is fully opaque from hero progress 0.6 to 1.0 — 642 px of blank scroll on a 390x844 phone before the categories emerge. In `buildHomeMotion()` change the hero pin `end: "+=190%"` to `"+=130%"`. Do NOT touch the veil's progress timings or the scale curve (progress↔scale is unchanged, so the Safari safeguard is unchanged). Re-run the invariant check and deadzone.js; the blank stretch should drop to roughly 440 px with pin gap still 0. Do not change the veil colour — that is a design decision left to the owner.

4. ORDER FLOW (product page and order form, script.js + style.css; keep the design language: cream ground, dark brown type, Montserrat display, Inter body):
   a. Sticky bottom bar on the product page: price + the ЗАХИАЛАХ button always visible on phones (the buy button currently sits 1.8 screens down). Hide it when the real button is in view. Respect safe-area insets. Do not cover the gallery controls.
   b. Order form: make only name, phone and district/sum required. Keep city; make хороо/баг, байр/гудамж, орц, тоот optional, collapsing them into one optional free-text address line if that reads cleaner. Move НЭР/УТАС above the delivery and payment pickers. Update `apps-script/Code.gs` (`computeOrder_`/`doPost`) so the server accepts the shorter payload — it already requires only phone + slug; verify, and keep price recomputation server-side per CLAUDE.md. Say in the report that the Apps Script must be redeployed by the owner if Code.gs changed.
   c. Under ЗАХИАЛАХ add two secondary links: "Залгаж захиалах" (tel: link — read the helpline number the site already uses) and "Messenger-ээр захиалах" (`m.me/<page>?ref=<slug>`) ONLY if a Facebook page handle exists in the sheet/shop config or CLAUDE.md; if none is found, add only the call link and say so.
   d. A one-line trust note next to the button: хүргэлтээр төлнө · урьдчилгаа шаардахгүй · the helpline number.
   Validate the order form never hangs (CLAUDE.md §3 "Захиалгын форм — гацаж болохгүй"): submit with empty and with partial data and confirm the error names the field. Do a test order only if CLAUDE.md permits it, and if you do, say which row to delete.

5. Update CLAUDE.md: add what changed and the new measurements to §3, §7, §9. Push. Do not open a PR unless CLAUDE.md §4 says to; this repository's history is direct commits to main.

Commit messages: explain the why, in English, in the style of the existing history. Do not include any model identifier in commits.

When done, reply in Mongolian with: what was deployed, the before/after numbers for each item, anything skipped and why, and what the owner should check on a real phone (product link from Instagram, front page with `?diag`).
