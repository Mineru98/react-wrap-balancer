# vanilla-wrap-balancer

> A dependency-free, framework-free port of [**react-wrap-balancer**](https://github.com/shuding/react-wrap-balancer). Drop one `<script>` tag onto any plain HTML page and your titles stop dropping a single lonely word onto the last line.

🇰🇷 한국어 문서: [README.ko.md](./README.ko.md)

![vanilla-wrap-balancer demo — Korean text, default wrapping vs balanced](./.github/demo.gif)

<sub>Same sentence, same width: **기본 줄바꿈 (default)** strands a single word on the last line, while **vanilla-wrap-balancer** evens the lines out. (Korean, `word-break: keep-all`.)</sub>

The core binary-search algorithm (`relayout`) is **ported verbatim** from react-wrap-balancer (MIT © Shu Ding). This package only re-implements the parts React used to provide — unique id generation, inline styling, native feature detection, "re-balance on content change", and observer cleanup — so it can run with no build step and no framework.

- ✅ **~3.8 KB minified**, zero dependencies
- ✅ Works with a plain `<script>` tag → exposes a global `WrapBalancer` (UMD)
- ✅ Auto-initialises `[data-br-balance]` elements; also a small programmatic API
- ✅ Uses native CSS `text-wrap: balance` when available, JS binary-search otherwise
- ✅ Re-balances on container resize (`ResizeObserver`) and content change (`MutationObserver`)
- ✅ **Proven byte-identical** to the React original across 644 randomized cases — see [Equivalence & testing](#equivalence--testing)

---

## The problem

When a heading wraps, the browser greedily fills each line, which often leaves a single word stranded on the last line:

```
Make your titles more
readable on every screen
size                          ← lonely orphan
```

Balancing redistributes the words so every line is roughly equal width:

```
Make your titles
more readable on
every screen size             ← balanced
```

---

## Install

### Option A — `<script>` tag (recommended for plain HTML pages)

Load it straight from the **jsDelivr CDN** — nothing to install or build:

```html
<script src="https://cdn.jsdelivr.net/gh/Mineru98/vanilla-wrap-balancer@main/wrap-balancer.min.js"></script>
```

`@main` always serves the latest commit (jsDelivr mirrors GitHub). Prefer to self-host? Download `wrap-balancer.min.js` and reference it locally instead:

```html
<script src="wrap-balancer.min.js"></script>
```

### Option B — ES module / bundler

The UMD file also exposes `module.exports`, so bundlers can import it:

```js
import WrapBalancer from './wrap-balancer.js'
WrapBalancer.balance('.title')
```

For native `<script type="module">`, the file attaches the global as a side effect:

```html
<script type="module">
  import './wrap-balancer.js'
  WrapBalancer.balance('.title')
</script>
```

---

## Quick start (no JavaScript to write)

Add `data-br-balance` to any text element. The script balances it on load, after web fonts settle, and on every resize:

```html
<h1 data-br-balance>The quick brown fox jumps over the lazy dog tonight</h1>

<script src="https://cdn.jsdelivr.net/gh/Mineru98/vanilla-wrap-balancer@main/wrap-balancer.min.js"></script>
```

That's the whole integration. See [`examples/01-quickstart.html`](./examples/01-quickstart.html).

> **Tip — where to put the marker.** Put `data-br-balance` on the element that *contains* the text (e.g. the `<h1>`). The library wraps that element's children in an inline-block `<span>` and balances the span inside it — structurally identical to `<h1><Balancer>…</Balancer></h1>` in React.

---

## Usage patterns

| Pattern | File |
|---|---|
| Zero-JS auto-init | [`examples/01-quickstart.html`](./examples/01-quickstart.html) |
| Programmatic API | [`examples/02-programmatic.html`](./examples/02-programmatic.html) |
| Balance ratio slider | [`examples/03-ratio.html`](./examples/03-ratio.html) |
| Dynamic content | [`examples/04-dynamic.html`](./examples/04-dynamic.html) |
| Before / after comparison | [`examples/05-comparison.html`](./examples/05-comparison.html) |

### Programmatic

Disable auto-init via `data-auto="false"` and drive it yourself:

```html
<script src="https://cdn.jsdelivr.net/gh/Mineru98/vanilla-wrap-balancer@main/wrap-balancer.min.js" data-auto="false"></script>
<script>
  const handles = WrapBalancer.balance('.title', { ratio: 1, preferNative: true })
  // handles[0].rebalance()
  // handles[0].destroy()
</script>
```

### Per-element options via data attributes

```html
<h1 data-br-balance data-br-ratio="0.75" data-br-prefer-native="false">…</h1>
```

---

## API

The global `WrapBalancer` object:

### `WrapBalancer.balance(target, options?) → handle[]`

Balance one or many elements. `target` is a CSS selector string, an `Element`, a `NodeList`, or an array of elements. Idempotent — calling it again on the same element just updates options and re-balances (no double-wrapping). Returns an array of [handles](#handle).

```js
WrapBalancer.balance('h1.title')
WrapBalancer.balance(document.querySelector('#hero'), { ratio: 0.5 })
WrapBalancer.balance(document.querySelectorAll('.card h2'))
```

### `WrapBalancer.balanceAll(options?) → handle[]`

Balance every element matching the selector (default `[data-br-balance]`).

```js
WrapBalancer.balanceAll()
WrapBalancer.balanceAll({ selector: '.balance-me', ratio: 1 })
```

### `WrapBalancer.rebalanceAll(selector?)`

Re-run the balance on all currently-managed elements (e.g. after a layout change the observers can't see).

### `WrapBalancer.isNativeSupported() → boolean`

`true` if the browser supports native CSS `text-wrap: balance` (cached).

### `WrapBalancer.relayout(id, ratio, wrapper)`

The low-level algorithm, ported verbatim from react-wrap-balancer. You normally don't call this directly; `balance()` calls it for you.

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `ratio` | `number` (0–1) | `1` | `0` = browser default, `1` = fully compact balance. |
| `preferNative` | `boolean` | `true` | Use native CSS `text-wrap: balance` when supported and skip the JS path. |
| `wrap` | `boolean` | `true` | `true`: wrap the element's children in an inline-block span (element = container). `false`: treat the element itself as the wrapper (its parent = container). |
| `selector` | `string` | `[data-br-balance]` | (`balanceAll` only) which elements to balance. |

### Data attributes

| Attribute | Maps to |
|---|---|
| `data-br-balance` | marks an element for auto-init |
| `data-br-ratio="0.5"` | `ratio` |
| `data-br-prefer-native="false"` | `preferNative` |
| `data-br-wrap="false"` | `wrap` |
| `data-auto="false"` *(on the `<script>` tag)* | disable auto-init entirely |

### Handle

`balance()` returns one handle per element:

```ts
{
  element,        // the element you targeted (the container)
  wrapper,        // the inline-block <span> that gets max-width tuned
  id,             // generated data-br id
  ratio, preferNative, usingNative,
  rebalance(),    // recompute now
  destroy(),      // disconnect observers, clear max-width
}
```

---

## How it works

1. **Wrap.** The targeted element's children are moved into an inline-block `<span>` (the *wrapper*). The element becomes the *container*.
2. **Binary search.** `relayout` shrinks the wrapper's `max-width` via binary search to the **narrowest width that does not add any line** (i.e. keeps `container.clientHeight` constant). The `ratio` then interpolates between that compact width and the full container width.
3. **Stay balanced.** A `ResizeObserver` on the container re-balances on resize; a `MutationObserver` on the wrapper re-balances when the text changes.
4. **Native first.** If `preferNative` is on and the browser supports `text-wrap: balance`, the JS is skipped entirely and the browser does the work in CSS.

The algorithm is **deterministic**: for an identical container width, text, and ratio it always produces the identical `max-width`. That property is what makes byte-for-byte equivalence with the React original testable.

---

## Coming from react-wrap-balancer?

| react-wrap-balancer (React) | vanilla-wrap-balancer |
|---|---|
| `<Balancer>text</Balancer>` | `<h1 data-br-balance>text</h1>` or `WrapBalancer.balance(el)` |
| `ratio` prop | `ratio` option / `data-br-ratio` |
| `preferNative` prop | `preferNative` option / `data-br-prefer-native` |
| `as` prop | use whatever tag you like; pass `wrap:false` to balance it directly |
| `<Provider>` | not needed — there is a single global |
| `nonce` prop | not needed — no inline script is injected at runtime |
| re-balance on `children` change | `MutationObserver` (automatic) |
| unmount cleanup | `handle.destroy()` |

The wrapper inline styles (`display:inline-block; vertical-align:top; text-decoration:inherit; text-wrap:…`) and the `data-br` / `data-brr` attributes match what react-wrap-balancer emits, so both produce the same *shape* of DOM.

> **SSR interop (read this if you mix both).** react-wrap-balancer's server-rendered markup already balances itself through its own embedded inline `<script>` (it defines `self.__wrap_b` and calls it) — so it does **not** need this library, and this library does **not** adopt those `data-br` spans (auto-init targets `[data-br-balance]`, not `data-br`, and never defines `self.__wrap_b`). The two are compatible in spirit but **not wire-compatible at runtime**: pick one per element. There is no crash if both are present — they simply ignore each other.

---

## Equivalence & testing

Because `relayout` is deterministic, equivalence is **provable**, not hand-waved. The harness in [`test/equivalence.html`](./test/equivalence.html) feeds byte-identical DOM to:

- the **original** react-wrap-balancer `relayout` (transcribed verbatim from upstream [react-wrap-balancer](https://github.com/shuding/react-wrap-balancer), kept inside the harness), and
- the **vanilla** `WrapBalancer.relayout` / high-level `balance()`,

across 7 container widths × 5 ratios × many randomized titles, and asserts the resulting `max-width` is **byte-identical**.

**Result: 644 / 644 cases byte-identical** (the `scrollWidth`-clamp branch fires in 543 of them; behaviour suite 31/31; minified-artifact parity 144/144). See the rubric in [`test/rubric.md`](./test/rubric.md) for the full equivalence criteria.

Run it locally:

```bash
cd vanilla
python3 -m http.server 8771
# open http://localhost:8771/test/equivalence.html — the banner shows PASS/FAIL,
# and window.__RESULTS__ holds the machine-readable summary.
```

---

## Browser support

Same as react-wrap-balancer. The JS path needs `ResizeObserver`:

| Chrome/Edge | Safari | Firefox | Opera |
|:---:|:---:|:---:|:---:|
| 64+ | 13.1+ | 69+ | 51+ |

Browsers with native `text-wrap: balance` skip the JS entirely (when `preferNative` is on). For older browsers, add a [`ResizeObserver` polyfill](https://github.com/que-etc/resize-observer-polyfill).

---

## Agent skills (Claude Code & Codex)

This repo ships more than the library. It also bundles two **agent skills** that teach an AI coding agent — **Claude Code** or **OpenAI Codex** — to apply this balancer for you and then *verify* the result: it renders Korean before/after screenshots and grades the improvement against a rubric.

| Skill | What it does |
|---|---|
| **`wrap-balancer`** | Balances one heading (or a few). Injects the CDN `<script>`, adds `data-br-balance` + Korean `word-break: keep-all`, then renders before/after and scores the improvement. |
| **`linebreak-audit`** | Sweeps a whole page or slide deck. Renders it headless, finds every awkward break (mid-word splits, last-line orphans, uneven lines, overflow), scores it 0–100, fixes it, and re-scans to confirm. |

Both skills ship in two runtime-specific copies — same workflow, wired to each agent's tools:

- **`.claude/skills/`** — for Claude Code (auto-discovered from the repo; uses the built-in `Agent` tool, no plugin required)
- **`.codex/skills/`** — for OpenAI Codex (adds an `agents/openai.yaml` interface manifest; triggered with `$wrap-balancer`)

### Install

**Claude Code**

- *Project skills (zero setup):* open this cloned repo with Claude Code and it auto-discovers `.claude/skills/`. Just ask in plain language ("balance this heading", or in Korean "이 제목 줄바꿈 예쁘게 해줘"), or call `/wrap-balancer` / `/linebreak-audit` explicitly.
- *Personal skills (available in every project):* copy the two folders into your home skills dir (run from the repo root):

  ```bash
  mkdir -p ~/.claude/skills
  cp -R .claude/skills/wrap-balancer .claude/skills/linebreak-audit ~/.claude/skills/
  ```

**Codex CLI**

- *Project skills:* keep `.codex/skills/` in the repo — Codex scans it from your working directory up to the repo root. Trigger explicitly with `$wrap-balancer` / `$linebreak-audit`, or run `/skills` to list them.
- *Personal skills (available everywhere):* copy the two folders into your home skills dir (run from the repo root):

  ```bash
  mkdir -p ~/.codex/skills
  cp -R .codex/skills/wrap-balancer .codex/skills/linebreak-audit ~/.codex/skills/
  ```

Each skill is a self-contained folder — `SKILL.md` plus `scripts/`, `references/`, `agents/`, and `assets/` (a local copy of `wrap-balancer.min.js` for offline / CSP-blocked rendering). Restart the agent if a freshly-copied skill doesn't show up.

---

## License

MIT. Core algorithm © [Shu Ding](https://github.com/shuding) (react-wrap-balancer). Vanilla port maintained in this fork.
