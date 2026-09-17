# Starshopping — шинэ session-д өгөх даалгавар

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

0. ATTRIBUTION FIRST (the owner's new backend spec depends on it). Ad links are `https://<host>/p/<slug>?ref=<creative_id>`. The crawler card pages under `p/<slug>/index.html` redirect with `location.replace("https://starshopping-mn.github.io/#/p/<slug>")`, which DROPS the query string, so `ref` never reaches the shop. Fix the template in `tools/build-og.py` (and the committed card pages) to forward `location.search`. In `script.js`, on first load read `new URLSearchParams(location.search).get('ref')` and store it as `ss_ref` in localStorage (keep it after an order; never clear it). Measure: open `/p/<slug>/?ref=TEST-01` and confirm `localStorage.ss_ref === 'TEST-01'` on the product page.

1. DEEP-LINK FIX. `git am /tmp/0001.patch` (touches only index.html). Verify locally: `python3 -m http.server 8777` in the repo, then run the harness (edit ORIGIN/paths in the scripts as needed; Playwright and Chromium are preinstalled). Expected: on `#/p/<slug>` the home view is never visible and the hero image is not fetched; on `/` the hero preload still fires at parse time; zoom invariants at 1280x800, 390x844, 390x600 are scale 11, lens offset 0/0, pin gap 0, no console errors.

2. ORDER FORM → the owner's new backend. Replace the order POST to Apps Script with `POST https://starshopping.app.n8n.cloud/webhook/order-intake`, JSON body `{ product_id, name, phone (8 digits), address (one free-text line), quantity, channel: "web", creative_id: localStorage.ss_ref || "" }`. Do NOT send a price. The form keeps only: name, phone, address (one line), quantity — nothing else required. Move name/phone above delivery/payment pickers. Handle the reply: `ok:true` → confirmation page with `order_id`, product, total_mnt; `is_duplicate:true` is NOT an error — show the normal confirmation; `ok:false` → show `message` if present, else map `out_of_stock`/`product_not_found`/`product_inactive`/`phone_required`/`price_not_set` to the Mongolian strings in the owner's spec. Keep the 30 s abort and the never-hang rule (CLAUDE.md §3). `product_id` must come from the catalogue item (see step 3); until Supabase products exist, send the slug as `product_id` and say so in the report.

3. CATALOGUE → Supabase, only if the owner confirms products exist there. Read via `POST https://tdnjnqftxschbliumwwm.supabase.co/rest/v1/rpc/web_products` with headers `apikey` + `Authorization: Bearer` = the anon key the owner supplies (public key; never the service_role key). Map `price_mnt`, `compare_at_mnt`, `images`, `in_stock`, `slug`, `product_id` onto the existing product shape so the page code stays unchanged. Keep `data/catalog.json` as the offline fallback. If the anon key or products are missing, leave the Sheet feed in place and report it.

4. PRODUCT PAGE: sticky bottom bar (price + ЗАХИАЛАХ always visible on phones, hidden when the real button is in view, safe-area aware), a "Залгаж захиалах" tel: link under it using the helpline already on the site, and a one-line trust note (хүргэлтээр төлнө · урьдчилгаа шаардахгүй · the helpline).

5. FEED REDRAW: when the live catalogue lands seconds after the page, `paint(first:false)` redraws the product page and the gallery restarts at photo 1. Skip the redraw when that product's data is unchanged.

6. ZOOM DEAD ZONE: in `buildHomeMotion()` change the hero pin `end: "+=190%"` to `"+=130%"`. Do NOT touch the veil timings or the scale curve. Re-run the invariant check and deadzone.js; blank stretch should drop from ~642 px to ~440 px with pin gap still 0.

7. Update CLAUDE.md (§2 architecture now names Supabase + n8n, §3, §7, §9) and push per §4. Direct commits to main are this repository's convention.

Do NOT build: a cart, coupons, online payment, an order-status page. Two products and zero completed tests do not justify them.

Commit messages: explain the why, in English, in the style of the existing history. No model identifiers in commits.

When done, reply in Mongolian, briefly: what was deployed, before/after numbers per item, anything skipped and why, and what the owner should check on a real phone (a product link with `?ref=` from Instagram, the front page with `?diag`, one test order and which row to delete).
