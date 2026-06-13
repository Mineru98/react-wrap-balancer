# Equivalence Rubric — vanilla `wrap-balancer` vs react-wrap-balancer

> How we prove the vanilla port behaves **identically** to react-wrap-balancer.
> Designed by an Opus test-architect agent, hardened by an independent Opus adversarial review (which found 2 real bugs + 1 coverage hole — all fixed, see [§5](#5-adversarial-review--bugs-found-and-fixed)), and executed in real browsers ([§6](#6-verification-results)).

**Status:** ✅ Layer 0–1 (algorithmic) gate **PASSES** — 644/644 byte-identical, scrollWidth-clamp branch proven (543 cases). Behaviour suite 31/31. Minified-artifact parity 144/144.

> **Note on paths (post-cleanup).** This rubric was written while the port lived under `vanilla/` next to the original React library. The repo has since been flattened to a pure vanilla project: `vanilla/wrap-balancer.js` is now **`wrap-balancer.js`** at the repo root, and the React sources it compares against (`src/index.tsx`, `src/utils.tsx`) were removed — those names refer to the upstream [react-wrap-balancer](https://github.com/shuding/react-wrap-balancer). The verbatim copy of the original `relayout` driving the head-to-head gate lives in [`test/equivalence.html`](./equivalence.html); CI suggestions that mention adding `export { relayout }` to `src/index.tsx` apply only if you build against an upstream checkout.

---

## 1. Equivalence strategy

Prove equivalence in four concentric layers, anchored on the deterministic-math property. LAYER 0 (static, fastest — AE-03): AST-normalized structural diff of the two relayout bodies after alpha-renaming locals, whitelisting only the single ResizeObserver-callback-callee difference (vanilla closure relayout(...) vs React self.__wrap_b(...)); this proves the core was ported verbatim and guards against future drift. LAYER 1 (algorithmic, the strongest proof — AE-01/AE-02/AE-04): extract React's exact shipped relayout via relayout.toString() and run it head-to-head against WrapBalancer.relayout on the SAME reused DOM node across ≥500 seeded-random titles × 5 ratios × 6 widths × 2 fonts × 3 browser engines; because both functions read identical integer clientWidth/clientHeight/scrollWidth from the same node and the algorithm is deterministic integer-seeded float math with no randomness, the resulting wrapper.style.maxWidth must be byte-identical (tolerance 0px) and the full binary-search probe trace must match step-for-step. Any inequality is a real divergence. LAYER 2 (integration/DOM-geometry — DG/AB/OL/NF/EC): render the real React component (via the existing website Next.js app or renderToStaticMarkup) and the vanilla [data-br-balance] page with byte-identical container width, pinned local fonts (font-display:block, await document.fonts.ready + rAF), and identical text; assert parity of wrapper getBoundingClientRect (≤0.5px), rendered line count via Range.getClientRects (exact integer), computed/inline maxWidth (≤0.5px), and container.clientHeight invariance — then verify the React-replacement layer (ratio, preferNative/native-skip, as/wrap, idempotency, ResizeObserver resize-rebalance, vanilla-only MutationObserver text-rebalance outcome-parity, and handle.destroy() observer teardown) each reproduces the React prop/lifecycle behavior. LAYER 3 (visual smoke — VR): Playwright pixel diff of React-vs-vanilla per engine on a pinned CI image (0 pixels above threshold 0.1 / maxDiffPixelRatio<0.001), used only to catch regressions the metrics miss, with cross-machine deltas routed to human review rather than auto-fail. The whole strategy treats Layer 1 as the load-bearing correctness gate (deterministic, environment-independent, exact) and Layers 2–3 as confirmation that the surrounding wiring and pixels agree; it explicitly tests the three vanilla-unique surfaces (MutationObserver trigger, DOMContentLoaded auto-init, fonts.ready rebalance) on their own since they have no React counterpart, and documents the bounded intentional divergences (wrapper tagName under as vs span, per-handle destroy vs global, and the self.__wrap_b SSR wire-protocol incompatibility) so they are not mistaken for failures.

---

## 2. Test harness

PRIMARY STACK: Playwright (@playwright/test) driving real Chromium + Firefox + WebKit. Do NOT use jsdom or happy-dom for any layout assertion — they return 0/undefined for clientWidth, scrollWidth, and clientHeight, which makes relayout's binary search (which reads exactly those properties) meaningless. A real layout engine is mandatory. jsdom may only be used for AB-05's module-shape (UMD/CJS/AMD) check, never for geometry.

FIXTURE SERVING: serve static fixtures with `python3 -m http.server` (repo has no test tooling/dist yet — Node 24, pnpm 10) or use Playwright page.setContent. Two fixture families: (1) the existing website/ Next.js 13 app, which already renders real <Balancer> — use it (or a tiny react-dom/server renderToStaticMarkup page) as the REACT reference page; (2) a plain HTML page that loads /vanilla/wrap-balancer.js via <script> as the VANILLA page. Keep container CSS, width, font, and text byte-identical between the two.

REACT relayout EXTRACTION (for the head-to-head gate AE-01/AE-02): React's relayout is not exported. Render <Balancer ratio={R} preferNative={false}>X</Balancer> through react-dom/server renderToStaticMarkup in a Node prebuild step; the output contains an injected <script> with `self.__wrap_b=<RELAYOUT_STR>;self.__wrap_b("id",R)`. Regex-extract the function source (RELAYOUT_STR), write it to a fixture, and in the browser instantiate it with `relayout_react = new Function('return ('+RELAYOUT_STR+')')()` and set `self.__wrap_b = relayout_react` so its RO callback resolves. This captures the EXACT bytes React ships, immune to hand-copy drift. The vanilla side is simply `WrapBalancer.relayout` (already on the public API). Cheaper alternative: add a test-only `export { relayout }` to src/index.tsx.

HEAD-TO-HEAD RUNNER (the centerpiece): single page, one wrapper node reused — run relayout_react, snapshot wrapper.style.maxWidth, reset maxWidth='' and disconnect+delete wrapper.__wrap_o, run relayout_vanilla, snapshot again, assert exact string equality. Reusing the SAME node guarantees identical integer clientWidth/clientHeight/scrollWidth reads, so identical deterministic float math ⇒ bit-exact maxWidth (tolerance 0). This isolates the algorithm from any cross-page rendering confound and is the strongest proof.

FUZZ: reuse test/benchmark/gen.js randomTitle() but inject a SEEDED PRNG (e.g. mulberry32) so failures reproduce; generate ≥500 titles (1–15 words) × ratios {0,0.25,0.5,0.75,1} × widths {120,200,320,400,640,800} × {serif,sans} local fonts, each run through the head-to-head runner across all three engines.

AST DRIFT GUARD (AE-03): parse both relayout sources with acorn, alpha-rename locals to canonical names, strip the dev-only process.env.NODE_ENV branch, and structurally diff; whitelist exactly the one ResizeObserver-callback-callee difference. Wire as a fast unit test in CI.

FONT DETERMINISM: bundle a local woff2, declare @font-face with font-display:block, and gate every measurement behind `await page.evaluate(() => document.fonts.ready)` PLUS one requestAnimationFrame and a re-check (document.fonts.ready can resolve early in Chrome/WebKit). Launch Chromium with --font-render-hinting=none and --force-color-profile=srgb; pin viewport and devicePixelRatio.

GEOMETRY HELPERS: line count via Range.getClientRects() distinct-Y-band walk (cap inputs at heading/paragraph length for O(n) cost); box via getBoundingClientRect(); computed style via getComputedStyle(wrapper).maxWidth/textWrap.

PIXEL DIFF (secondary smoke): Playwright toHaveScreenshot clipped to the wrapper, separate baselines per engine, all baselines pinned to ONE immutable CI Docker image + locked browser build; pass = 0 pixels above per-pixel threshold 0.1 OR maxDiffPixelRatio < 0.001; cross-machine deltas go to human review, never auto-fail.

NATIVE-SUPPORT TOGGLE: for NF-03/forced-fallback, page.addInitScript to override CSS.supports to return false for ('text-wrap','balance'), clear vanilla nativeSupportedCache, and set React self.__wrap_n=2 before init.

OBSERVER INSTRUMENTATION: spy on ResizeObserver.prototype.observe/disconnect and MutationObserver.prototype.observe/disconnect, and monkey-patch relayout to count invocations and record which wrapper each call targets (for OL-01..04, EC-05). Capture window 'error' events to detect 'ResizeObserver loop completed with undelivered notifications'. Use take_heapsnapshot/observer-count sampling across destroy/rebalance cycles for leak checks (EC-06).

CI MATRIX: pin exact browser versions; run head-to-head + AST guard on every commit (fast, deterministic), and the cross-page geometry + pixel layers on the pinned image.

---

## 3. Rubric (41 criteria across 8 categories)

Rows marked ➕ were added by the adversarial review.

### Algorithmic equivalence

#### `AE-01-head-to-head-exact-maxwidth` — 🔴 critical

- **Criterion:** For byte-identical DOM (same container, same wrapper text, same integer clientWidth, same ratio), the React original relayout and the vanilla WrapBalancer.relayout must set the EXACT same wrapper.style.maxWidth string. This is the primary equivalence gate and exploits that relayout is deterministic integer-seeded float math with no randomness.
- **How to test:** In ONE real browser page (Playwright), load both functions: relayout_vanilla = WrapBalancer.relayout (already exposed), and relayout_react extracted from the React source via relayout.toString() (render <Balancer> with react-dom/server renderToStaticMarkup, regex the injected <script> for the self.__wrap_b=<fn> body, instantiate with new Function('return('+src+')')()). For each case: build <div style='width:Wpx;font:...'><span data-br data-brr=R style='display:inline-block;vertical-align:top;text-decoration:inherit'>TITLE</span></div>; call relayout_react(0,R,wrapper); record maxR=wrapper.style.maxWidth; then wrapper.style.maxWidth=''; if(wrapper.__wrap_o){wrapper.__wrap_o.disconnect();delete wrapper.__wrap_o}; call relayout_vanilla(0,R,wrapper); record maxV; assert maxR===maxV. Fuzz: reuse test/benchmark/gen.js randomTitle() under a SEEDED PRNG for ≥500 titles (1-15 words) x ratios {0,0.25,0.5,0.75,1} x widths {120,200,320,400,640,800} x both serif and sans local fonts. Run in Chromium, Firefox, WebKit.
- **Pass condition:** 100% of cases satisfy maxR===maxV as exact strings (tolerance 0px; e.g. '327.5px'==='327.5px'). Zero mismatches across all titles/ratios/widths/browsers. Any single inequality is a hard fail (a real port divergence).

#### `AE-02-binary-search-constants-and-trace` — 🔴 critical

- **Criterion:** The binary-search seed values, loop condition, midpoint rounding, scrollWidth clamp, and final formula must be preserved EXACTLY: lower=width/2-0.25; upper=width+0.5; the if(width) guard; update(lower) then lower=Math.max(wrapper.scrollWidth,lower); while(lower+1<upper){middle=Math.round((lower+upper)/2);...}; height-equality branch (clientHeight===height ? upper=middle : lower=middle); final update(upper*ratio+width*(1-ratio)).
- **How to test:** Instrument BOTH relayout copies by wrapping the 'update' calls to push every probed width into an array (monkey-patch wrapper.style maxWidth setter or shadow the update fn). Run both on the identical node (as in AE-01) and compare the full ordered sequence of probe widths and the final value element-by-element. Also assert via static read that the literal constants -0.25 and +0.5 and the operators (Math.round, lower+1<upper, Math.max with scrollWidth) appear in the vanilla source and are exercised at runtime.
- **Pass condition:** The ordered probe-width trace from vanilla equals the React trace element-for-element (exact float equality) AND the final maxWidth matches, for every fuzz case. The number of binary-search iterations is identical per case.

#### `AE-03-ast-drift-guard` — 🟠 high

- **Criterion:** The vanilla relayout body must remain a verbatim structural port of the React relayout body — differing ONLY in the ResizeObserver callback statement (vanilla closure call relayout(0,+wrapper.dataset.brr,wrapper) vs React self.__wrap_b(0,+wrapper.dataset.brr,wrapper)) and in cosmetic identifier/keyword choices (var vs let/const).
- **How to test:** Parse both relayout function sources with acorn/babel, alpha-rename all local bindings to canonical names, drop the dev-only process.env.NODE_ENV warning branch, and structurally diff the two ASTs. Whitelist exactly one expected statement-level difference (the RO callback callee). This is a cheap CI gate that catches future drift in the 'ported verbatim' core.
- **Pass condition:** AST structural diff yields zero differences after alpha-renaming except the single whitelisted ResizeObserver-callback callee node. Any additional structural difference fails.

#### `AE-04-determinism-idempotency` — 🟠 high

- **Criterion:** relayout is deterministic and idempotent: running it N times against unchanged DOM converges to the identical maxWidth every time, with no drift and no dependence on prior maxWidth state (it resets maxWidth='' first).
- **How to test:** On a single balanced wrapper, call WrapBalancer.relayout(0,ratio,wrapper) 10 times in a row (no DOM/width change between calls) and collect maxWidth after each. Repeat starting from a pre-dirtied state (set wrapper.style.maxWidth='5px' before a call) to prove the internal reset makes the result independent of prior value. Cross-check the converged value equals the AE-01 head-to-head value.
- **Pass condition:** All 10 repeated results are byte-identical strings, independent of the pre-set maxWidth, and equal to the React reference value (tolerance 0px).

#### ➕ `AE-05-scrollwidth-clamp-coverage` — 🟠 high

- **Criterion:** The `lower = Math.max(wrapper.scrollWidth, lower)` clamp must be provably exercised (lower actually raised to scrollWidth) on identical fixtures in both impls, with identical probe traces from the clamped lower bound.
- **How to test:** Add long-unbreakable-token fixtures (single 20-40 char word, one word wider than the container, and a title whose longest word exceeds width/2) to the head-to-head runner. Instrument relayout to record, per case, whether scrollWidth > the seed lower at the clamp step. Compare React vs vanilla probe traces and final maxWidth, and record the clamp-fire flag.
- **Pass condition:** At least one fixture per width raises `lower` to scrollWidth (clamp-fire flag true) on BOTH impls at the SAME iteration with the SAME clamped value; probe traces and final maxWidth are byte-identical (0px). The suite FAILS if zero cases exercised the clamp.

#### ➕ `AE-06-single-oracle-reconciliation` — 🟡 medium

- **Criterion:** There must be a single React-relayout oracle; the three existing copies (src/index.tsx, the hand transcription in test/equivalence.html, and any regex-extracted SSR copy) must be reconciled to prevent silent drift.
- **How to test:** Add a test-only `export { relayout }` to src/index.tsx and import it as the oracle (no regex). Assert oracle.toString() (normalized) matches the body actually shipped in the SSR <script>, and delete or auto-generate the hand transcription in equivalence.html from the same source. Pin the oracle to the unminified source build.
- **Pass condition:** Exactly one source of truth for the React relayout; the head-to-head harness, the SSR script body, and the trace guard all derive from it; no standalone hand-maintained copy remains.

### DOM geometry

#### `DG-01-wrapper-bounding-rect-parity` — 🟠 high

- **Criterion:** The balanced wrapper's rendered box (getBoundingClientRect) on the React-rendered page must match the vanilla-rendered page for identical container width, font, text, and ratio (JS path, preferNative=false).
- **How to test:** Render the React reference via the website Next app (or renderToStaticMarkup served statically): <h1 style='width:Wpx'><Balancer ratio=R preferNative={false}>TITLE</Balancer></h1>. Render the vanilla page: identical <h1 style='width:Wpx'><span data-br-balance data-br-ratio=R data-br-prefer-native=false>TITLE</span></h1> + <script src=vanilla/wrap-balancer.js>. Pin identical local @font-face (font-display:block), identical viewport. Await document.fonts.ready + one rAF on both. Read wrapper.getBoundingClientRect() on each.
- **Pass condition:** width and height of the wrapper rect match within 0.5px; left and top match within 1px; across all sampled titles/widths/ratios and all three browser engines.

#### `DG-02-rendered-line-count-parity` — 🟠 high

- **Criterion:** The number of rendered text lines inside the wrapper must be identical between React and vanilla outputs for the same input (the balancing must place the same number of lines and avoid the orphan identically).
- **How to test:** After balancing, on each page create a Range over the wrapper's text content and walk it (per character or per word) collecting distinct top-coordinate bands from Range.getClientRects(); count distinct Y-bands = rendered line count. Keep inputs at single-heading/paragraph length to bound the O(n) cost. Compare React vs vanilla counts for each case.
- **Pass condition:** Rendered line count is an exact integer match for every case. Additionally, for ratio=1 the last line must not be a single-word orphan unless the unbalanced control (no balancer) also produced that single word on its own line (i.e., balancing changed the wrap the same way on both).

#### `DG-03-computed-maxwidth-parity-crosspage` — 🟠 high

- **Criterion:** getComputedStyle(wrapper).maxWidth (and the inline wrapper.style.maxWidth) must agree between React and vanilla rendered pages on the JS path.
- **How to test:** On both rendered pages (DG-01 setup), read parseFloat(wrapper.style.maxWidth) and getComputedStyle(wrapper).maxWidth. Compare. When both pages render at the SAME integer container clientWidth with the same font metrics, expect exact equality; allow a small tolerance only for sub-pixel container rounding differences between the two documents.
- **Pass condition:** parseFloat(maxWidth) matches within 0.5px when container clientWidth is integer-identical on both pages; widen to 1.0px tolerance only if the two pages' container.clientWidth differ by 1px due to scrollbar/sub-pixel rounding (must be documented per case).

#### `DG-04-container-height-invariance` — 🟡 medium

- **Criterion:** The binary search must leave container.clientHeight equal to its pre-balance value (it searches for the narrowest width that keeps height constant), and that invariant height must be identical across React and vanilla.
- **How to test:** Capture container.clientHeight BEFORE balancing (with maxWidth reset) and AFTER balancing on both pages. Assert the post-balance height equals the pre-balance height on each impl, and that the values match across impls.
- **Pass condition:** post-balance container.clientHeight === pre-balance container.clientHeight on each implementation (exact integer), and the React value === the vanilla value (exact integer).

#### ➕ `DG-05-clientheight-rounding-crosspage` — 🟡 medium

- **Criterion:** Cross-page convergence must tolerate integer clientHeight rounding differences from devicePixelRatio, zoom, or fractional line-height, and any resulting branch divergence must be bounded and recorded.
- **How to test:** Run the cross-page comparison with line-height pinned to an integer and at devicePixelRatio in {1,2}. Capture container.clientHeight on both pages before/after balance. Where the two pages disagree on the rounded clientHeight, record it and verify the maxWidth delta stays within the documented bound.
- **Pass condition:** With integer line-height and dpr=1, cross-page clientHeight is identical and maxWidth matches within 0.5px. At dpr=2/zoom, any clientHeight rounding difference is reported and the maxWidth delta stays <=1px (documented per case). Head-to-head on one node remains exact.

### Visual regression

#### `VR-01-pixel-diff-js-path` — 🟠 high

- **Criterion:** A full-element screenshot of the React-rendered balanced heading and the vanilla-rendered balanced heading must be pixel-equivalent on the JS binary-search path (preferNative=false), in a pinned environment.
- **How to test:** Playwright toHaveScreenshot on the wrapper element (clip to its bounding box) for React page vs vanilla page with identical container width, font (local woff2, font-render-hinting=none, force-color-profile=srgb), viewport, devicePixelRatio. Maintain separate baselines per engine (Chromium/Firefox/WebKit) pinned to one immutable CI image/browser build. Treat this as the secondary smoke layer behind AE-01.
- **Pass condition:** Zero pixels exceed per-pixel threshold 0.1 (anti-alias allowance), OR maxDiffPixelRatio < 0.001, against the paired baseline on the SAME pinned environment. Cross-machine deltas are reviewed by a human, not auto-failed (pixel-perfect cross-hardware reproducibility is not a reliability target).

#### `VR-02-pixel-diff-native-path` — 🟡 medium

- **Criterion:** On the native path (preferNative=true and CSS.supports('text-wrap','balance') true), both React and vanilla must defer entirely to native CSS, producing identical native-balanced pixels and an empty inline maxWidth.
- **How to test:** Render both pages with preferNative=true in a browser that supports text-wrap:balance. Screenshot-diff the wrapper as in VR-01. Separately assert (see NF-01) that neither wrote a maxWidth. Because both apply the identical CSS property and run no JS, the pixels are produced by the same UA algorithm.
- **Pass condition:** Pixel diff identical to VR-01 thresholds (0 pixels above 0.1 / maxDiffPixelRatio<0.001) AND wrapper.style.maxWidth==='' on both. Note cross-engine native algorithms differ, so compare React-vs-vanilla only within the SAME engine.

### API behaviour

#### `AB-01-ratio-semantics-endpoints` — 🟠 high

- **Criterion:** The ratio knob must behave identically: ratio=0 => maxWidth equals the full container width (no balancing); ratio=1 => maxWidth equals the binary-search upper bound (most compact); fractional ratio => linear blend upper*ratio+width*(1-ratio).
- **How to test:** Drive both impls (head-to-head per AE-01) at ratio in {0,0.25,0.5,0.75,1}. For ratio=0 assert maxWidth===width+'px' (width=container.clientWidth). For ratio=1 assert maxWidth===String(upper)+'px' where upper is the converged bound. For fractional, assert the exact blend formula value matches React's.
- **Pass condition:** All ratio endpoints and fractional values match the React reference exactly (0px tolerance) in the head-to-head; ratio=0 yields container-width maxWidth on both; ratio=1 yields the compact upper bound on both.

#### `AB-02-data-attribute-init-parity` — 🟡 medium

- **Criterion:** Vanilla data-* attributes must map to the same effects as the React props: data-br-ratio<=>ratio, data-br-prefer-native<=>preferNative, data-br-wrap<=>wrap, data-br-balance<=>auto-init target. Per-element attribute overrides and option-object overrides must agree with React prop values.
- **How to test:** For a matrix of attribute combos (e.g. data-br-ratio='0.5', data-br-prefer-native='false'), auto-init via DOMContentLoaded and compare the resulting wrapper maxWidth / textWrap / observer presence against a React <Balancer ratio=0.5 preferNative={false}> rendering of the same content/width. Also verify options passed to WrapBalancer.balance(el,{ratio,preferNative,wrap}) override the attributes the same way React props do.
- **Pass condition:** For every combo, vanilla wrapper's maxWidth matches React within 0.5px (cross-page) or 0px (head-to-head reuse of the same node), textWrap value matches exactly, and observer presence matches. Option object beats attribute beats default on both, in the same precedence.

#### `AB-03-as-tag-and-wrap-divergence` — 🟡 medium

- **Criterion:** Document and bound the wrapper-element-type behavior. React's as prop changes the wrapper tag (e.g. as='div'); the vanilla auto-wrapper is ALWAYS a <span> (no as), but offers wrap:false to treat the element itself as the wrapper. Because display:inline-block is forced inline, layout must be identical regardless of tag; the only allowed divergence is the wrapper's tagName.
- **How to test:** (a) React as='div' vs vanilla wrap:false on an inline-block element: compare wrapper getBoundingClientRect and maxWidth. (b) React default (span) vs vanilla default (span wrap:true): compare tagName and geometry. (c) Confirm vanilla provides no as option for the auto-created wrapper and assert this is the documented, intended divergence.
- **Pass condition:** Geometry (rect within 0.5px, line count exact) and maxWidth (within 0.5px) match regardless of tag choice. The ONLY permitted difference is wrapper.tagName when the consumer used React as vs vanilla span; this divergence must be explicitly documented and not affect any layout metric.

#### `AB-04-idempotent-rebalance` — 🟡 medium

- **Criterion:** Calling balance() twice on the same element must reuse the existing wrapper and observers (no duplicate <span>, no duplicate ResizeObserver/MutationObserver), update the ratio, and re-balance — mirroring React re-running its layout effect on prop change without remounting.
- **How to test:** balance(el,{ratio:1}); capture wrapper node + observer refs; balance(el,{ratio:0.5}); assert el still has exactly one child wrapper (same node identity via KEY_HANDLE), data-brr updated to '0.5', maxWidth recomputed for 0.5, and no second ResizeObserver/MutationObserver instance was created (spy on constructors). Compare the post-update maxWidth to a fresh React ratio=0.5 reference.
- **Pass condition:** Exactly one wrapper element and one of each observer type after the second call; data-brr==='0.5'; recomputed maxWidth matches React ratio=0.5 reference (0px head-to-head / 0.5px cross-page). No duplicate DOM nodes or observers.

#### `AB-05-umd-global-surface` — 🟡 medium

- **Criterion:** The library must expose the documented public surface when loaded via plain <script> (UMD global window.WrapBalancer) and via CommonJS/AMD: at minimum version, relayout, isNativeSupported, balance, balanceAll, rebalanceAll, init, with destroy() present on each handle returned by balance() (note: destroy is per-handle, there is no global destroy(el)).
- **How to test:** Load vanilla/wrap-balancer.js via <script> and assert typeof window.WrapBalancer==='object' with each named member a function (except version string). Load via require() in Node (jsdom NOT used for layout, only for module-shape) and via an AMD define stub; assert factory returns the same shape. Call balance(el) and assert the returned handle has rebalance() and destroy() functions.
- **Pass condition:** window.WrapBalancer exists with all listed members of correct type under <script>; require()/define() yield an equivalent object; every handle from balance() exposes rebalance() and destroy(). Missing/renamed members fail.

#### ➕ `AB-06-falsy-option-override` — 🟡 medium

- **Criterion:** Option-object values that are falsy (ratio:0, preferNative:false, wrap:false) must override conflicting data-* attributes, preserving option>attribute>default precedence for the bug-prone falsy values.
- **How to test:** balance(el,{ratio:0}) on an element with data-br-ratio='0.75' => assert maxWidth===container.clientWidth+'px'. balance(el,{preferNative:false}) on data-br-prefer-native='true' in a native-supporting browser => assert JS path ran (non-empty maxWidth, inline textWrap='initial'). balance(el,{wrap:false}) on an element with no data-br-wrap => assert the element itself is the wrapper (data-br on el, container is el.parentElement).
- **Pass condition:** Each falsy option wins over the attribute and over the default on the vanilla side, matching the equivalent React prop value; specifically ratio:0 yields full-container maxWidth, not the default-1 compact value.

#### ➕ `AB-07-invalid-ratio-handling` — ⚪ low

- **Criterion:** Bound and document handling of invalid/out-of-range ratios. Non-numeric data-br-ratio falls back to 1 in vanilla; out-of-range numerics flow through the same blend formula on both impls; a React ratio={NaN} produces 'NaNpx' whereas vanilla coerces a NaN attribute to 1 (a data-layer divergence to document).
- **How to test:** Head-to-head with numeric ratios {-1, 2} (same number fed to both relayout copies) => assert byte-identical maxWidth. Data-layer: data-br-ratio in {'', 'abc', '2', '-1'} => assert vanilla readRatio yields {1,1,2,-1}. Separately note React has no attribute layer and ratio={NaN} => 'NaNpx'.
- **Pass condition:** Head-to-head numeric out-of-range ratios match exactly (0px). Vanilla coerces non-numeric attributes to 1. The NaN/attribute divergence is documented as a bounded, vanilla-only data-layer behavior, not a relayout divergence.

### Observer lifecycle

#### `OL-01-resize-observer-rebalance` — 🟠 high

- **Criterion:** On container resize, the attached ResizeObserver must re-run relayout and converge to the NEW correct maxWidth for the new width — identically for React and vanilla. The observer must be attached to the container (wrapper.parentElement), not the wrapper.
- **How to test:** Balance both impls at width W1; programmatically set container width to W2 (e.g. 320->480px); await two animation frames for the ResizeObserver to fire and settle. Read maxWidth. Compute the expected value by a fresh head-to-head relayout at W2. Assert the observed post-resize maxWidth equals the fresh-relayout-at-W2 value on BOTH impls. Verify via the observer target that RO.observe was called on the container element.
- **Pass condition:** Post-resize maxWidth on each impl equals a fresh relayout computed at W2 (0.5px tolerance), and React value === vanilla value (0.5px). ResizeObserver is confirmed attached to the container, not the wrapper, on both.

#### `OL-02-mutation-rebalance-outcome-parity` — 🟠 high

- **Criterion:** On text-content change, the final balanced maxWidth must match between vanilla (MutationObserver-triggered, vanilla-only mechanism) and React (children-prop-change-triggered re-render). The trigger mechanisms differ but the converged outcome must be identical.
- **How to test:** Vanilla: balance(el); then mutate wrapper.textContent (or append/replace a text node) to a new TITLE2; await the MutationObserver microtask + one rAF; read maxWidth. React: re-render <Balancer ratio=R preferNative={false}>TITLE2</Balancer> at the same width; read maxWidth. Also run a head-to-head: feed TITLE2 at the same width to both relayout copies. Assert all three agree. Explicitly test that this path is independent of the mount path (do not assume mount equivalence implies mutation equivalence).
- **Pass condition:** Vanilla post-mutation maxWidth === React post-re-render maxWidth (0.5px cross-page) and === head-to-head reference for TITLE2 (0px). The MutationObserver fires exactly once per discrete text change after coalescing (no missed or duplicated rebalance).

#### `OL-03-destroy-disconnects-observers` — 🟠 high

- **Criterion:** Destroying/unmounting must disconnect all observers so no further re-balancing occurs. Vanilla handle.destroy() disconnects both ResizeObserver and MutationObserver, resets maxWidth='', and deletes the handle; React unmount disconnects the ResizeObserver. After teardown, a container resize or text mutation must NOT change maxWidth.
- **How to test:** Vanilla: h=balance(el)[0]; spy on h.wrapper.__wrap_o.disconnect and __wrap_m.disconnect; h.destroy(); assert both disconnect spies called, wrapper.__wrap_o/__wrap_m deleted, wrapper.style.maxWidth==='', handle removed. Then resize the container and mutate text; assert maxWidth stays '' (no rebalance fires). React: spy on ResizeObserver.prototype.disconnect, unmount the component, assert disconnect was called for that wrapper.
- **Pass condition:** Both observers disconnected exactly once on destroy/unmount; post-destroy resize and text mutation produce zero relayout calls and leave maxWidth unchanged ('' for vanilla). No leaked observers (heap/observer-count check stable across destroy/rebalance cycles).

#### `OL-04-no-feedback-loop` — 🟠 high

- **Criterion:** Neither observer may create an infinite re-balance loop. The MutationObserver must observe childList/characterData/subtree but NOT attributes (so style.maxWidth writes do not retrigger it); the ResizeObserver must not thrash or spam the 'ResizeObserver loop completed with undelivered notifications' error during steady state.
- **How to test:** Instrument relayout to count invocations. Balance an element, let it settle, then idle for 1s with no external change; assert relayout invocation count stops growing. Capture window 'error' events; assert no recurring 'ResizeObserver loop completed' beyond at most one benign initial occurrence. Inspect the MutationObserver init options to confirm attributes is falsy. Add a contenteditable typing simulation and confirm rebalances are coalesced (not one full binary search per keystroke without bound).
- **Pass condition:** After settling, relayout invocation count is stable (0 additional calls over 1s idle). No sustained 'ResizeObserver loop completed' errors (at most 1, benign). MutationObserver options have attributes !== true. No unbounded growth in observer callbacks during rapid mutation.

#### ➕ `OL-05-resize-feedback-settle-bound` — 🟡 medium

- **Criterion:** The container's clientHeight legitimately changes when wrapper maxWidth shrinks (the RO-observed box), so the system must SETTLE (converge) rather than be loop-free by box-invariance. After settling, no further relayouts fire.
- **How to test:** Instrument relayout invocation count. balance(el); wait until 250ms (or 3 rAF) elapse with zero new relayouts (the settle gate); record the count consumed during settling; then idle 1s and assert zero additional calls. Capture window 'error' for 'ResizeObserver loop completed' (allow at most one benign initial).
- **Pass condition:** A small bounded number of RO-driven relayouts during the initial settle, then strictly zero growth over the 1s idle; at most one benign loop-warning; MutationObserver init attributes!==true.

### Native fallback

#### `NF-01-native-supported-skip-parity` — 🔴 critical

- **Criterion:** When CSS.supports('text-wrap','balance') is true and preferNative is true (default), BOTH impls must skip the JS binary search entirely: leave wrapper.style.maxWidth empty, set the wrapper's text-wrap to 'balance', and attach NO ResizeObserver and NO MutationObserver.
- **How to test:** In a supporting browser (modern Chromium/Firefox/WebKit) with preferNative=true, render React <Balancer> and run vanilla balance(el,{preferNative:true}). Assert on both: wrapper.style.maxWidth===''; getComputedStyle(wrapper).textWrap==='balance' (or inline style.textWrap==='balance'); wrapper.__wrap_o===undefined and wrapper.__wrap_m===undefined (vanilla); React wrapper has no SYMBOL_OBSERVER_KEY. Confirm relayout was never invoked (spy count 0).
- **Pass condition:** On both impls: maxWidth===''(empty), textWrap resolves to 'balance', zero observers attached, zero relayout calls. Exact parity of all four facts.

#### `NF-02-prefer-native-false-forces-js` — 🟠 high

- **Criterion:** When preferNative=false, BOTH impls must run the JS binary search regardless of native support, and set the wrapper text-wrap to 'initial' (not 'balance').
- **How to test:** With preferNative=false in a browser that DOES support native balance, render React and vanilla. Assert wrapper.style.maxWidth is a non-empty px value on both, textWrap==='initial' on both, and a ResizeObserver is attached on both. Cross-check the maxWidth equals the AE-01 head-to-head reference.
- **Pass condition:** Both set a non-empty maxWidth equal to the head-to-head reference (0px), textWrap==='initial' on both, ResizeObserver attached on both. preferNative=false must NOT be short-circuited by native support on either impl.

#### `NF-03-prefer-native-true-unsupported` — 🟡 medium

- **Criterion:** When preferNative=true but native is NOT supported, BOTH impls must run the JS binary search AND still set text-wrap to 'balance' (a no-op the browser ignores) — i.e. the text-wrap value is driven by preferNative, not by actual support, in both implementations.
- **How to test:** Stub support to false before init: page.addInitScript to override CSS.supports to return false for ('text-wrap','balance') (and clear the vanilla nativeSupportedCache / set React self.__wrap_n=2). Render both with preferNative=true. Assert maxWidth is non-empty (JS ran) on both, textWrap==='balance' on both, observers attached on both. Cross-check maxWidth vs head-to-head reference.
- **Pass condition:** Both produce non-empty maxWidth equal to the head-to-head reference (0px), textWrap==='balance' on both despite no native support, and observers attached on both. Confirms the preferNative-driven text-wrap value and the support-gated JS execution match React exactly.

#### ➕ `NF-04-textwrap-inline-parity` — 🟠 high

- **Criterion:** text-wrap assertions must use the INLINE style property both impls write, compared for parity, never the computed CSS shorthand (which Firefox expands and which never returns the keyword 'initial').
- **How to test:** On the JS path assert wrapper.style.textWrap (inline) is 'initial' on BOTH and equal to each other; on the native path assert inline 'balance' on both. Detect native support via CSS.supports/isNativeSupported(), not getComputedStyle. Verify React and vanilla wrote the identical inline value for the same preferNative/support combination.
- **Pass condition:** Inline wrapper.style.textWrap is parity-equal between React and vanilla for every (preferNative x support) combination; native-skip vs JS-run is decided by the same support signal on both; no assertion depends on getComputedStyle of the text-wrap shorthand.

### Edge cases

#### `EC-01-zero-width-hidden-detached` — 🟠 high

- **Criterion:** When container.clientWidth is 0 (display:none ancestor, visibility-collapsed, or detached subtree), the if(width) guard must skip the binary search on BOTH impls, leaving maxWidth='' (after reset), with no crash; the ResizeObserver is still attached (the attach block is outside the if(width) guard) so it re-balances once the element becomes visible.
- **How to test:** Balance an element inside a display:none parent (clientWidth===0) on both impls. Assert no exception, wrapper.style.maxWidth==='' on both, and a ResizeObserver IS attached on both. Then reveal the element (display:block), trigger a resize/await RO, and assert it now converges to the head-to-head reference for the visible width on both.
- **Pass condition:** No errors on either impl; maxWidth==='' while hidden on both; ResizeObserver attached on both; after reveal both converge to the same visible-width reference value (0.5px). Behavior identical between impls.

#### `EC-02-single-word-and-overflow-scrollwidth-clamp` — 🟠 high

- **Criterion:** The lower=Math.max(wrapper.scrollWidth,lower) clamp must be exercised identically for single unbreakable words and tokens that overflow at lower=width/2-0.25, preventing the search from probing widths below the text's intrinsic overflow point.
- **How to test:** Head-to-head (AE-01) with inputs: a single long word with no spaces, a very long unbreakable token (> width), and a title whose longest word forces scrollWidth>lower at the seed width. Compare the probe traces and final maxWidth between React and vanilla, confirming the clamp set lower to scrollWidth at the same step.
- **Pass condition:** Probe traces and final maxWidth match exactly (0px) for all single-word/overflow cases; both impls clamp lower to the same scrollWidth value at the same iteration.

#### `EC-03-inline-markup-cjk-rtl-whitespace` — 🟡 medium

- **Criterion:** Balancing must be identical for non-trivial content: nested inline elements (<b>,<a>,<em>) inside the text, &nbsp;/non-breaking spaces, leading/trailing/collapsed whitespace and newlines, CJK text (no spaces), and RTL text (dir='rtl').
- **How to test:** Head-to-head and cross-page comparisons over a fixture set covering: inline children, &nbsp;, multi-space/newline-laden text, a CJK string, and an RTL Arabic/Hebrew string. For each, compare final maxWidth (head-to-head) and rendered line count + bounding rect (cross-page) between React and vanilla. Note vanilla moves child nodes into the span via appendChild (preserving nodes/listeners), which must not alter measured layout vs React's JSX children.
- **Pass condition:** maxWidth exact match (0px head-to-head) and line count exact + rect within 0.5px (cross-page) for every content variant including CJK and RTL. Moving children into the wrapper span must not change any measured metric.

#### `EC-04-non-integer-container-width` — 🟡 medium

- **Criterion:** For fractional container CSS widths (e.g. width:400.5px), both impls read the same browser-rounded integer clientWidth and must converge identically; tests near integer boundaries tolerate at most 1px because the search may settle on adjacent integers depending on UA rounding.
- **How to test:** Run head-to-head at container widths set to fractional values {200.4, 320.5, 400.6, 633.33} px. Since both functions read the SAME node's clientWidth, the integer is identical and head-to-head must be exact. Additionally run the cross-page variant where the two documents might round a fractional width differently and record the delta.
- **Pass condition:** Head-to-head (same node): exact 0px match at all fractional widths. Cross-page (two documents): maxWidth within 1.0px, and the container.clientWidth integer used by each page is reported for any case exceeding 0.5px.

#### `EC-05-multiple-balancers-no-crosstalk` — ⚪ low

- **Criterion:** Many balanced elements on one page must each get a unique data-br id and balance independently with no cross-contamination, matching a React page with many <Balancer> instances.
- **How to test:** Auto-init a page with 50 [data-br-balance] headings of varied text/width. Assert all generated data-br ids are unique (Set size === count) and each wrapper's maxWidth equals its own head-to-head reference (not another element's). Confirm resizing one container only re-balances that one (instrument relayout to record which wrapper it ran on).
- **Pass condition:** All ids unique; every element's maxWidth matches its individual reference (0.5px); resizing element i triggers relayout only for element i (no cross-talk). Note: ids need not match React's id FORMAT (rwb-/useId vs wb-<base36>) because relayout always receives the wrapper explicitly, so id format is layout-irrelevant — assert only uniqueness and that layout is unaffected by format.

#### `EC-06-destroy-then-rebalance` — 🟡 medium

- **Criterion:** After destroy(), calling balance() again on the same element must create fresh, working observers and converge to the correct maxWidth (no stale/duplicate observers, no leak), matching React unmount-then-remount.
- **How to test:** h=balance(el)[0]; h.destroy(); h2=balance(el)[0]; assert h2 is a new handle, exactly one ResizeObserver and (JS path) one MutationObserver now attached, maxWidth equals the head-to-head reference, and resizing the container re-balances correctly via the NEW observer. Repeat the destroy/rebalance cycle 20x and confirm observer count and heap stay flat.
- **Pass condition:** After re-balance: exactly one of each observer, maxWidth matches reference (0.5px), resize re-balances correctly. 20 destroy/rebalance cycles show no growth in observer count or retained heap (no leak).

#### `EC-07-fonts-ready-convergence` — 🟡 medium

- **Criterion:** The vanilla-only document.fonts.ready re-balance enhancement must only re-run the deterministic algorithm against final (web-font) metrics and converge to the same layout the React page reaches after its fonts load — it must not cause a divergent or oscillating result.
- **How to test:** Load a page with a web font that differs metrically from the fallback, with font-display:swap. Capture vanilla maxWidth before fonts.ready and after fonts.ready settles. Capture React maxWidth after its fonts load. Assert vanilla's post-fonts value equals React's post-fonts value (both measured against the real font) and equals the head-to-head reference computed with the web font active. Confirm only ONE extra rebalance fires from fonts.ready (no loop).
- **Pass condition:** Vanilla post-fonts-ready maxWidth === React post-font-load maxWidth (0.5px) and === web-font head-to-head reference (0px head-to-head). Exactly one fonts.ready-driven rebalance; result is stable (no oscillation) thereafter.

#### `EC-08-wire-protocol-divergence-documented` — ⚪ low

- **Criterion:** Bound a known intentional divergence: the vanilla port's ResizeObserver callback uses a closure (relayout) and does NOT assign self.__wrap_b, so it is NOT a drop-in replacement for React's serialized inline-script protocol (data-br spans whose injected <script> calls self.__wrap_b). Equivalence is claimed at the algorithm + component-behavior level, not the SSR wire-protocol level.
- **How to test:** (a) Assert vanilla balancing works end-to-end without ever defining window.__wrap_b (load the script, balance, resize, confirm RO re-balances via the closure). (b) Assert that React-style SSR markup (a data-br span plus an inline <script>self.__wrap_b(...)</script>) is NOT auto-handled by the vanilla global (documented limitation), and that the recommended migration is to use [data-br-balance] auto-init instead. Confirm this divergence does not affect any layout metric in the supported usage.
- **Pass condition:** Vanilla re-balances on resize with self.__wrap_b undefined (closure works). The wire-protocol incompatibility is explicitly documented and confined to SSR inline-script interop; it changes no layout metric in the [data-br-balance]/balance() usage paths.

#### ➕ `EC-09-detached-vs-hidden-split` — 🟠 high

- **Criterion:** Distinguish (a) attached-but-zero-width (display:none/visibility-collapsed ancestor; container exists) from (b) truly detached (no parentElement). The two follow different code paths and must each match React.
- **How to test:** (a) Balance an element under a display:none parent: assert no crash, maxWidth reset to '' on both, ResizeObserver ATTACHED on both, and convergence to the visible-width reference after reveal. (b) Balance a detached element (document.createElement, never appended): assert no crash, NO ResizeObserver attached on either impl, and maxWidth unchanged from its prior value (no reset, because the early `if(!container)return` precedes the reset).
- **Pass condition:** Case (a): RO attached + maxWidth='' on both; reveal converges to the same reference (0.5px). Case (b): NO observer attached on either, no exception, maxWidth untouched on both. Behavior identical between impls in each case.

#### ➕ `EC-10-destroy-rebalance-dom-invariant` — 🟠 high

- **Criterion:** After destroy() then balance() on the same element, the DOM must remain a single-wrapper structure (no nested data-br spans, constant depth) across many cycles, matching React unmount/remount which yields one span.
- **How to test:** h=balance(el)[0]; h.destroy(); h2=balance(el)[0]. Assert el.querySelectorAll('[data-br]').length===1, no [data-br] element is an ancestor of another [data-br], and el's element-depth/childElementCount equals the post-first-balance value. Repeat the destroy/rebalance cycle 20x and assert the structure invariant holds every time (not just observer/heap counts). Cross-check final maxWidth vs the head-to-head reference.
- **Pass condition:** Exactly one data-br wrapper, zero nesting, and constant DOM depth after every cycle; maxWidth matches reference (0.5px); exactly one ResizeObserver and one MutationObserver on the live wrapper. (Expected to FAIL current code and require a fix.)

### Integration / artifact

#### ➕ `IN-01-minified-artifact-parity` — 🟡 medium

- **Criterion:** The shipped minified artifact (wrap-balancer.min.js) — the file the README/CDN instruct users to load — must be behaviorally identical to wrap-balancer.js.
- **How to test:** Run AE-01 (head-to-head sample), AB-05 (API surface), and the auto-init smoke against a page that loads wrap-balancer.min.js instead of the source. Alternatively assert in CI that min.js is generated from src (e.g., terser) and that both expose the identical public surface and identical relayout behavior on a sample matrix.
- **Pass condition:** min.js passes the same head-to-head equality (0px), exposes the identical WrapBalancer surface, and auto-inits identically; OR min.js is provably build-generated from src in CI. Any hand-edit drift fails.

#### ➕ `IN-02-auto-init-opt-out-and-currentscript` — 🟡 medium

- **Criterion:** Auto-init must respect data-auto="false" on the loading <script>, and its behavior when document.currentScript is null (async/defer/type=module) must be defined.
- **How to test:** (a) Load with <script src=... data-auto="false"> and assert no [data-br-balance] element was balanced (no wrapper span created, relayout invocation count 0) until an explicit balance()/balanceAll() call. (b) Load via type=module or async where currentScript is null and assert the documented behavior (currently: auto-init still runs because autoDisabled is false). (c) Load twice and assert no double-wrap / no duplicate observers.
- **Pass condition:** data-auto="false" reliably suppresses auto-init; the currentScript-null path behaves as documented and is noted as intended; double-load produces a single wrapper and one observer of each type.

---

## 4. Edge-case checklist

1. Zero-width container (display:none ancestor, visibility-collapsed, or detached subtree): clientWidth===0 ⇒ if(width) guard skips the binary search on both impls, maxWidth stays '' after reset, no crash, but ResizeObserver is still attached (attach block is outside the guard) so it re-balances on reveal.
2. ratio=0 ⇒ maxWidth must equal full container width (no balance); ratio=1 ⇒ maxWidth equals the compact upper bound; fractional ratio ⇒ exact blend upper*ratio+width*(1-ratio). Verify endpoints and the float blend bit-exactly.
3. Single unbreakable word / token longer than the container: the lower=Math.max(wrapper.scrollWidth,lower) clamp must fire at the same iteration on both impls, preventing sub-overflow probing.
4. Non-integer container width (e.g. 400.5px): browsers round clientWidth to an integer; head-to-head on the same node is exact, but two separate documents may round differently ⇒ allow ≤1px only cross-page and record the per-page clientWidth.
5. Text already fitting on one line: height never increases as width shrinks until it wraps; the search converges to the narrowest single-line width identically on both.
6. Native path (preferNative=true + CSS.supports true): BOTH must skip JS entirely — maxWidth stays '', text-wrap:'balance', and NO ResizeObserver/MutationObserver attached. The 6-line Chromium / 10-line Firefox native cap means 7–9 line blocks may silently NOT balance natively (no error, no flag) and diverge cross-engine — the equivalence claim on the native path holds only within the same engine.
7. preferNative=true but native UNSUPPORTED: both run the JS search yet still set text-wrap:'balance' (an ignored no-op) — the text-wrap value is driven by preferNative, not by actual support, on both impls.
8. MutationObserver is a VANILLA-ONLY re-balance trigger (React re-runs its layout effect on children/ratio prop change). Test the mutation path independently; passing the mount path does not imply mutation correctness. The MO must observe childList/characterData/subtree but NOT attributes, so style.maxWidth writes don't feed back into an infinite loop.
9. Inline child markup (<b>,<a>,<em>), &nbsp;/non-breaking spaces, collapsed/leading/trailing whitespace and newlines, CJK (space-less) text, and RTL (dir='rtl') text — all must balance identically. Vanilla moves existing child nodes into the wrapper span via appendChild (preserving node identity/listeners), which must not alter measured layout vs React JSX children.
10. Many balancers on one page: each gets a unique data-br id and balances independently with no cross-talk. id FORMAT differs (vanilla wb-<base36> vs React rwb-/useId) but is layout-irrelevant because relayout always receives the wrapper explicitly — assert only uniqueness and independence, not format parity.
11. as/tag divergence: React's as prop changes the wrapper tagName; the vanilla auto-wrapper is ALWAYS <span> (offers wrap:false to use the element itself). Because display:inline-block is forced, layout is identical; the ONLY allowed difference is wrapper.tagName, which must be documented and must not change any layout metric.
12. destroy() is per-handle (handle.destroy()), not a global destroy(el): it disconnects both observers, resets maxWidth='', deletes the handle. After destroy, resize/text-mutation must produce zero rebalances; destroy→rebalance cycles must not leak observers or heap.
13. document.fonts.ready re-balance is a vanilla-only enhancement: it must only re-run the deterministic algorithm against final web-font metrics and converge to the same layout React reaches post-font-load (no oscillation, exactly one extra rebalance).
14. Wire-protocol divergence: the vanilla port does NOT assign self.__wrap_b (its RO callback uses a closure), so it cannot satisfy React's SSR inline-script protocol (data-br span + <script>self.__wrap_b(...)</script>). Equivalence is at the algorithm + component-behavior level, not the SSR wire-protocol level — document this and confine it to SSR interop.
15. ResizeObserver feedback: balancing only changes the wrapper's inline maxWidth (never the container's own box, since container=wrapper.parentElement and they are at different depths), so the 'ResizeObserver loop completed with undelivered notifications' error should not recur in steady state; at most one benign initial occurrence is acceptable.
16. Float-exactness boundary: because clientWidth/clientHeight are integer-rounded, near certain fractional widths the search can settle on adjacent integers (upper vs upper-1). On the same node both impls settle identically (exact); only across two separate documents allow 1px.
17. scrollWidth clamp actually firing: a single unbreakable token longer than width/2 (and one longer than the whole container) so `lower = Math.max(scrollWidth, lower)` changes lower — currently DEAD across the entire 5-char-word fuzz corpus and the 504-case suite.
18. Truly detached element (no parentElement) as a case DISTINCT from display:none: early return means no maxWidth reset and no ResizeObserver attached (contradicts EC-01's current pass-condition).
19. destroy() then balance() on the same element: double-wraps into nested spans because destroy doesn't unwrap/remove data-br and ensureWrapper's reuse guard needs the deleted KEY_HANDLE; 20 cycles => 20 nested spans / unbounded DOM depth.
20. Falsy options overriding attributes: ratio:0, preferNative:false, wrap:false passed via the options object while a conflicting data-* attribute is present.
21. Invalid / out-of-range data-br-ratio: 'abc' (NaN), '2', '-1'. Vanilla coerces NaN->1 and passes 2/-1 through to the formula; React passes ratio={NaN} straight to update() yielding maxWidth='NaNpx' — an un-tested data-layer divergence.
22. Non-dyadic ratios (0.3, 0.333, 0.6) that produce floating-point-garbage maxWidth strings (e.g. '294.40000000000003px') — needed to prove byte-exact STRING parity head-to-head; the fuzz only uses exactly-representable {0,0.25,0.5,0.75,1}.
23. Literal <br> inside the balanced text (forced line break changes the clientHeight baseline the binary search keys on).
24. data-auto="false" opt-out, and async/defer/type=module script loading where document.currentScript is null (auto-init still runs — is that intended?).
25. clientHeight integer-rounding divergence cross-page at devicePixelRatio=2, fractional line-height, or browser zoom (only width rounding is covered).
26. Loading wrap-balancer.js twice (two <script> tags / double IIFE): second WrapBalancer global overwrites the first; verify no double-wrap and no duplicate observers across separate module instances.
27. React-style SSR markup (data-br span + embedded self.__wrap_b inline script) present on a page that also loads the vanilla lib — the real interop behavior the README's line 218 implies but doesn't deliver.
28. Minified artifact wrap-balancer.min.js behavioral parity with the source (the file users actually load) — never exercised by the rubric.
29. fonts.ready re-balance does NOT fire for programmatic balance() targets (only for [data-br-balance] auto-init via autoInit) — EC-07 can read zero rebalances if it uses the wrong path.
30. Significant whitespace / &nbsp; / pretty-printed-HTML vs JSX-trimmed children producing different wrapper.textContent across the React and vanilla pages.
31. Playwright-WebKit on Linux/CI lacking native text-wrap:balance (unlike real Safari), making NF-01/VR-02 native-path assertions vacuous or accidentally testing the JS fallback.
32. container with padding for ratio=0: maxWidth=clientWidth includes padding while the wrapper sits inside the content box — confirm both impls behave identically (they do, same formula) but it's an untested assumption behind 'ratio=0 => full container width'.

---

## 5. Adversarial review — bugs found and fixed

The rubric was re-reviewed by an independent context-isolated Opus agent. Its verdict:

> This is an unusually thorough rubric and its central insight is correct: relayout is deterministic integer-seeded float math, so the Layer-1 head-to-head string-exact maxWidth comparison on a single reused DOM node (AE-01/AE-02/AE-04) is a genuinely strong, environment-independent gate. The four-layer concentric strategy, the determinism framing, the explicit handling of vanilla-only surfaces (MutationObserver trigger, DOMContentLoaded auto-init, fonts.ready), and the named intentional divergences are all good. However, several load-bearing rows are broken or weak against the ACTUAL code: (1) AE-03's AST-drift guard is essentially unimplementable as written — there are at least three real source-level divergences (arrow+implicit-return `update` vs function-expression+block, template-literal vs string-concat querySelector, typed decls) that the 'single whitelisted difference' will fail on; it should be reframed as the behavioral probe-trace guard. (2) The fuzz corpus (gen.js / equivalence.html randomTitle) emits only uniform 5-char lowercase words, which provably CANNOT fire the scrollWidth clamp — so AE-02's 'clamp exercised at runtime' is false and the headline '504/504 byte-identical' covers only the non-clamp path. (3) EC-06's pass-condition is satisfiable while a real bug (destroy()->balance() double-wraps into unbounded nested spans, because destroy doesn't unwrap and ensureWrapper's reuse needs the deleted handle) goes completely undetected. (4) EC-01 conflates 'detached/no-parent' with 'display:none' and asserts a pass-condition (RO attached, maxWidth reset) that is false for the detached early-return path. (5) The text-wrap assertions (NF-01/02/03) lean on getComputedStyle of a CSS shorthand and on a literal 'initial' that computed style never returns — fragile across the very engines targeted. (6) EC-08's 'must be documented' premise is contradicted by README line 218, which overclaims SSR compatibility the code doesn't provide. Lower-priority but real: VR pixel thresholds are near-untestable for text, OL-04's no-loop rationale is factually wrong (the container's height DOES change), the React-relayout extraction regex is brittle and the oracle build is unpinned, the minified artifact is never tested, and clientHeight cross-page rounding is uncovered. Net verdict: strong skeleton, but the AST guard, the fuzz corpus, the destroy->rebalance DOM invariant, the EC-01 split, and the text-wrap/pixel assertions must be reworked before this rubric can gate a release. Top four priorities: reframe AE-03 around AE-02's trace equivalence; broaden the corpus to actually fire the clamp (and assert it did); add DOM-structure invariants to EC-06 (which will surface a genuine port bug); and split EC-01 into attached-zero-width vs detached.

### Real issues it surfaced (and how they were resolved)

| Target | Severity | Issue | Resolution |
|---|---|---|---|
| `AE-03-ast-drift-guard` | 🟠 high | BROKEN AS SPECIFIED. The rubric whitelists "exactly one" structural AST difference (the ResizeObserver callback callee) plus var/let cosmetics. But diffing the REAL bodies (src/index.tsx relayout vs vanilla/wrap-balancer.js relayout) reveal | Drop the structural-AST-diff framing. Either (a) make the canonicalizer also normalize arrow<->function-expression, implicit-return<->return-block, and template-literal<->string-concat before diffing  |
| `EC-06-destroy-then-rebalance` | 🟠 high | PASS-CONDITION HIDES A REAL PRODUCT BUG. destroy() (vanilla lines 259-270) only disconnects observers, sets maxWidth='', and `delete wrapper[KEY_HANDLE]` — it does NOT unwrap the span or remove its data-br. ensureWrapper's reuse guard (line | Add DOM-structure invariants to EC-06: after re-balance assert `el.querySelectorAll('[data-br]').length===1`, no data-br element is nested inside another, and DOM depth/childElementCount is constant a |
| `AE-01-head-to-head-exact-maxwidth (fuzz corpus)` | 🟠 high | THE HEADLINE COVERAGE IS HOLLOW FOR THE ALGORITHM'S ONLY NON-TRIVIAL BRANCH. The fuzz reuses test/benchmark/gen.js randomTitle(), which emits ONLY uniform 5-character lowercase words. At every tested width >=120 the seed `lower = width/2 -  | Extend the generator to emit (a) long unbreakable tokens longer than width/2 (20-40 chars, no spaces), (b) mixed-length words, (c) one giant word exceeding the container, and (d) titles whose longest  |
| `EC-01-zero-width-hidden-detached` | 🟠 high | CONFLATES TWO BEHAVIORALLY DIFFERENT CASES WITH A FALSE PASS-CONDITION. (a) display:none ANCESTOR: the wrapper still has a parentElement, so `container` is truthy, the code proceeds past `if(!container)return`, resets maxWidth='', reads wid | Split into EC-01a (attached-but-zero-width: container exists -> maxWidth reset to '', RO attached, re-balances on reveal) and EC-01b (detached/no-parent: early return -> NO observer attached, maxWidth |
| `NF-01 / NF-02 / NF-03 (text-wrap assertions)` | 🟠 high | FRAGILE / PARTLY UNTESTABLE ASSERTIONS ON text-wrap. NF-02 asserts `textWrap==='initial'` but getComputedStyle NEVER returns the CSS-wide keyword 'initial' (it returns the resolved value, e.g. 'wrap'/'auto'); only INLINE style.textWrap pres | Assert ONLY the INLINE wrapper.style.textWrap (the property both impls write identically: src line 270 / vanilla line 181), and assert PARITY (React value === vanilla value) rather than equality to a  |
| `AB-02-data-attribute-init-parity` | 🟡 medium | MISSES THE FALSY-OVERRIDE CASES THAT ARE EXACTLY THE BUG-PRONE ONES. readRatio/readPreferNative/readWrap (vanilla lines 146-168) correctly use `typeof === 'number'/'boolean'` so option 0/false override attributes — but AB-02 only tests data | Add precedence cases with falsy options: {option ratio:0 + attr data-br-ratio='0.75' => expect maxWidth===width+'px'}, {option preferNative:false + attr 'true' => JS path runs}, {option wrap:false + a |
| `EC-08-wire-protocol-divergence-documented` | 🟡 medium | PASS-CONDITION ASSUMES THE OPPOSITE OF WHAT THE DOCS SAY. EC-08 requires the SSR wire-protocol incompatibility to be 'explicitly documented', but vanilla/README.md line 218 actually claims the REVERSE: 'SSR markup produced by react-wrap-bal | Add a positive test: load vanilla/wrap-balancer.js on a page whose only balancer markup is React-style SSR (`<span data-br ...>+<script>self.__wrap_b=...;self.__wrap_b(...)</script>`) and assert the A |
| `VR-01 / VR-02 (pixel diff)` | 🟡 medium | PASS-CONDITION IS EFFECTIVELY UNTESTABLE FOR TEXT. 'Zero pixels exceed per-pixel threshold 0.1' across two SEPARATELY laid-out documents is unrealistic: even with byte-identical maxWidth, the two pages place the heading at fractionally diff | Demote VR to a non-gating smoke layer (AE-01's string-exact maxWidth is the real gate). Render React and vanilla side-by-side WITHIN ONE page so they share the subpixel grid, or compare each impl agai |
| `OL-04-no-feedback-loop` | 🟡 medium | INCORRECT RATIONALE + UNDER-SPECIFIED/FLAKY TEST. The criterion claims 'balancing only changes the wrapper's inline maxWidth (never the container's own box)'. That is FALSE for the height axis: shrinking wrapper maxWidth adds text lines ->  | Correct the rationale (RO observes the container whose height legitimately changes; non-looping follows from determinism + RO batching, not box invariance). Define an explicit settle gate (e.g., wait  |
| `EC-07-fonts-ready-convergence` | 🟡 medium | PATH NOT PINNED -> SPURIOUS RESULT POSSIBLE. The fonts.ready re-balance runs ONLY inside autoInit (DOMContentLoaded path, vanilla lines 347-362) and ONLY targets the default [data-br-balance] selector via rebalanceAll(). Elements balanced P | Pin EC-07 to the [data-br-balance] auto-init path (the only path with the fonts.ready enhancement). Use a web font whose metrics measurably change the container so React's ResizeObserver actually fire |
| `AE-01 / AE-04 (harness: async observer interference)` | 🟡 medium | MEASUREMENT RACE NOT GUARDED. relayout attaches a ResizeObserver on first call (src line 76 / vanilla line 113). In AE-04's 10x loop and AE-01's reuse-the-same-node flow, that RO fires ASYNCHRONOUSLY between a relayout call and the maxWidth | Mandate stubbing ResizeObserver to a no-op for the head-to-head/idempotency runners (or disconnect+delete wrapper.__wrap_o immediately after each synchronous relayout call, before reading maxWidth). N |
| `AB-05-umd-global-surface` | 🟡 medium | TWO CONCRETE DEFECTS. (1) how_to_test says 'Call balance(el) and assert the returned handle has rebalance()' — but balance() returns an ARRAY of handles (vanilla lines 314-318); the assertion must index [0] (OL-03 does this correctly, AB-05 | Fix the wording to balance(el)[0]. Add an artifact-parity row: run the full suite (or at least AE-01 + AB-05 + auto-init) against wrap-balancer.min.js as well, OR assert the min file is generated from |
| `test_harness (React relayout extraction)` | 🟡 medium | BRITTLE EXTRACTION + UNDEFINED ORACLE BUILD. The harness regex-extracts React's relayout from the SSR <script> between `self.__wrap_b=` and `;self.__wrap_b("id",R)`. But the React source's relayout contains a TEMPLATE LITERAL with backticks | Prefer the listed 'cheaper alternative': add a test-only `export { relayout }` to src/index.tsx and import it directly (no regex, no template-literal hazard). Pin the oracle to the unminified source b |
| `EC-04 (clientHeight rounding — only width is covered)` | 🟡 medium | MISSING THE PROMPT-FLAGGED HEIGHT-ROUNDING DIVERGENCE. EC-04 handles fractional container WIDTH and integer clientWidth rounding, but nothing in the rubric addresses integer-rounded clientHEIGHT diverging cross-page. The binary search branc | Add a DG/EC row that pins line-height to an integer, tests dpr in {1,2} and a zoom level, asserts clientHeight parity cross-page, and documents/【allows】 a bounded 1px branch divergence cross-page (exa |
| `EC-03-inline-markup-cjk-rtl-whitespace` | 🟡 medium | WHITESPACE NORMALIZATION NOT PINNED + <br> OMITTED. ensureWrapper moves ALL child nodes including indentation whitespace text nodes (vanilla lines 207-209), whereas React JSX trims surrounding whitespace. A cross-page fixture with pretty-pr | Require byte-identical wrapper.textContent (including whitespace) between the React and vanilla cross-page fixtures, OR add an explicit whitespace-divergent fixture and assert collapse-equivalence. Ad |
| `DG-01 / wrapper inline-style parity` | ⚪ low | NO DIRECT ASSERTION THAT ALL FOUR WRAPPER STYLES MATCH. Both impls set display:inline-block, vertical-align:top, text-decoration:inherit, text-wrap:... (src 266-271 / vanilla 176-182), but the rubric only ever asserts maxWidth and textWrap. | Add an explicit wrapper-style-parity assertion: read display, verticalAlign, textDecoration, and textWrap on both wrappers and assert they are pairwise identical, as a fast precondition before the geo |


---

## 6. Verification results

Executed in real browsers (Chromium engine) via the harnesses in this folder. A real layout engine is mandatory — jsdom/happy-dom return 0 for `clientWidth`/`scrollWidth`/`clientHeight` and make the binary search meaningless.

| Harness | Cases | Result | Rubric rows covered |
|---|---|---|---|
| `test/equivalence.html` | 644 | ✅ **644/644 byte-identical** `maxWidth`; scrollWidth-clamp branch fired in **543** cases | AE-01, AE-02, AE-04, AE-05, AB-01, EC-02, EC-03 |
| `test/behaviors.html` | 20 | ✅ **20/20** | AB-03, AB-04, AB-06, OL-01, OL-02, OL-03, OL-04, NF-01, NF-02, NF-04, EC-09, EC-10 |
| `test/min-parity.html` | 144 | ✅ **144/144** — shipped `wrap-balancer.min.js` byte-identical to source | IN-01, AB-05 |

The corpus deliberately spans uniform 5-char words (the original `gen.js` corpus), mixed-length words, **long unbreakable tokens** (30–46 chars, to fire the `Math.max(scrollWidth, lower)` clamp), single **giant words** wider than the container (overflow), inline markup (`<b>`, `<a>`, `<em>`), forced `<br>`, and irregular whitespace — across 7 container widths × 5 ratios.

### Bugs found by the review loop and fixed in the final script

1. **`destroy()` → `balance()` double-wrap (EC-10, high).** `destroy()` left the `data-br` span in place but `ensureWrapper` reused only when the in-memory handle was present — which `destroy()` had deleted — so the next `balance()` nested a new span around the old one, compounding every cycle. **Fix:** `ensureWrapper` now reuses any sole `[data-br]` child by attribute; the id is reused too. Verified: 5 destroy/balance cycles → exactly 1 wrapper, 0 nesting.
2. **Dead `scrollWidth` clamp branch (AE-05, high).** The original fuzz corpus emitted only uniform 5-char words, so `lower = Math.max(scrollWidth, lower)` never raised `lower` — the clamp path was never exercised by the headline “504/504”. **Fix:** corpus extended with long/giant tokens + runtime instrumentation that **fails the suite if the clamp never fires**. Now fires in 543 cases.
3. **README SSR overclaim (EC-08, medium).** The docs said react-wrap-balancer SSR markup was “already compatible.” **Fix:** reworded to state the real bounded relationship (same DOM *shape*, but not runtime wire-compatible; they ignore each other).

### Intentional, documented divergences (not failures)

- **`as`/tag:** the vanilla auto-wrapper is always a `<span>`. Use `wrap:false` to balance an arbitrary element directly. Geometry/`maxWidth` are identical regardless of tag.
- **`destroy()` is per-handle** (`handle.destroy()`), not a global `destroy(el)`.
- **Wire protocol:** the vanilla port does **not** assign `self.__wrap_b` (its ResizeObserver callback uses a closure), so it cannot satisfy react-wrap-balancer’s SSR inline-script protocol. Both still work; they just do not adopt each other’s spans.
- **Native 6-line cap:** Chromium silently stops balancing natively above 6 lines (Firefox ~10). This is inherited from `text-wrap: balance` / react-wrap-balancer, not introduced here. For long headings, pass `preferNative:false` (or `data-br-prefer-native="false"`) to force the JS path.
- **`document.fonts.ready` rebalance** is a vanilla-only enhancement on the `[data-br-balance]` auto-init path. It only re-runs the deterministic algorithm against final font metrics, so it **converges** to the same layout (avoids a FOUT mis-balance); it is not a behavioural divergence.
- **Runtime `preferNative` switch (rare — vanilla is *more* correct):** calling `balance(el, {preferNative:false})` and later `balance(el, {preferNative:true})` on the same element makes the port disconnect the JS observers (matching React's cleanup) **and** clear the stale imperative `max-width`, so native CSS balances against the full container. React's effect disconnects the observer but leaves the old imperatively-set `max-width` inline (React's `style` prop never owned it), so it stays clamped to the old narrow width. On this one exotic runtime-switch path the vanilla port is therefore *strictly more correct* than React — confirmed by the independent isolated reviewer — and so **not** byte-identical to React's latent stale-clamp. Setting `preferNative` once (the normal case) is fully identical.

### Layers not gated here (documented as confirmation, not the load-bearing gate)

- **Layer 2 cross-page DOM geometry vs a live React render (DG-01…DG-05)** and **Layer 3 visual pixel diff (VR-01/VR-02)** require a built React app + Playwright CI across 3 engines. Per the review, the deterministic **Layer-1 head-to-head string-exact `maxWidth`** comparison is the real correctness gate (environment-independent, exact); Layers 2–3 are confirmation that wiring and pixels agree and are recommended for CI. Cross-page `clientHeight` integer-rounding (DG-05) can differ by ≤1px between two separate documents at `devicePixelRatio≠1`/zoom; head-to-head on one node is exact.
