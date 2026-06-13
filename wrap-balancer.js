/*!
 * wrap-balancer v1.0.0
 * A dependency-free, vanilla-JS port of react-wrap-balancer.
 * Balances multi-line text so the last line is never a lonely orphan word.
 *
 * The core `relayout` binary-search algorithm is ported VERBATIM from
 * react-wrap-balancer (MIT © Shu Ding). This package only replaces the parts
 * that React used to provide: unique id generation, inline styling, native
 * feature detection, "re-balance on content change", and observer cleanup.
 *
 * Works with a plain <script> tag. Exposes a global `WrapBalancer` (UMD).
 *
 * @license MIT
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define([], factory)
  } else if (typeof module === 'object' && module.exports) {
    // CommonJS / bundlers
    module.exports = factory()
  } else {
    // Browser global
    root.WrapBalancer = factory()
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  // Property keys stashed directly on the wrapper DOM node.
  // `__wrap_o` matches react-wrap-balancer so behaviour is byte-identical.
  var KEY_RESIZE_OBSERVER = '__wrap_o'
  var KEY_MUTATION_OBSERVER = '__wrap_m'
  var KEY_HANDLE = '__wrap_h'

  var DEFAULT_SELECTOR = '[data-br-balance]'

  var idCounter = 0
  var nativeSupportedCache

  /**
   * Does the browser support native CSS `text-wrap: balance`?
   * Cached after the first call. Mirrors react-wrap-balancer's
   * `CSS.supports("text-wrap","balance")` gate.
   */
  function isNativeSupported() {
    if (nativeSupportedCache === undefined) {
      nativeSupportedCache =
        typeof CSS !== 'undefined' &&
        typeof CSS.supports === 'function' &&
        CSS.supports('text-wrap', 'balance')
    }
    return nativeSupportedCache
  }

  // -------------------------------------------------------------------------
  // CORE ALGORITHM — ported verbatim from react-wrap-balancer `relayout`.
  // Do not "improve" this. Its byte-for-byte behaviour is the equivalence
  // contract: identical DOM (container width, wrapper, ratio) => identical
  // final maxWidth. There is no randomness.
  // -------------------------------------------------------------------------
  /**
   * @param {string|number} id     value of the wrapper's [data-br] attribute
   * @param {number}        ratio  0..1 balance ratio
   * @param {HTMLElement=}  wrapper the inline-block wrapper element
   */
  function relayout(id, ratio, wrapper) {
    wrapper = wrapper || document.querySelector('[data-br="' + id + '"]')
    var container = wrapper && wrapper.parentElement

    if (!container) {
      return
    }

    var update = function (width) {
      wrapper.style.maxWidth = width + 'px'
    }

    // Reset wrapper width
    wrapper.style.maxWidth = ''

    // Get the initial container size
    var width = container.clientWidth
    var height = container.clientHeight

    // Synchronously do binary search and calculate the layout
    var lower = width / 2 - 0.25
    var upper = width + 0.5
    var middle

    if (width) {
      // Ensure we don't search widths lower than when the text overflows
      update(lower)
      lower = Math.max(wrapper.scrollWidth, lower)

      while (lower + 1 < upper) {
        middle = Math.round((lower + upper) / 2)
        update(middle)
        if (container.clientHeight === height) {
          upper = middle
        } else {
          lower = middle
        }
      }

      // Update the wrapper width
      update(upper * ratio + width * (1 - ratio))
    }

    // Create a new observer if we don't have one, so the text re-balances when
    // the container is resized. Identical to react-wrap-balancer.
    if (!wrapper[KEY_RESIZE_OBSERVER]) {
      if (typeof ResizeObserver !== 'undefined') {
        ;(wrapper[KEY_RESIZE_OBSERVER] = new ResizeObserver(function () {
          relayout(0, +wrapper.dataset.brr, wrapper)
        })).observe(container)
      }
    }
  }

  // -------------------------------------------------------------------------
  // Helpers (the "React" replacement layer)
  // -------------------------------------------------------------------------

  function toArray(listLike) {
    return Array.prototype.slice.call(listLike)
  }

  /**
   * Normalise `target` (CSS selector | Element | NodeList | Array) to an
   * array of Elements.
   */
  function resolveTargets(target) {
    if (!target) return []
    if (typeof target === 'string') {
      try {
        return toArray(document.querySelectorAll(target))
      } catch (e) {
        // Invalid selector -> no-op instead of throwing.
        return []
      }
    }
    if (target.nodeType === 1) {
      return [target]
    }
    if (typeof target.length === 'number') {
      // NodeList / array — keep only real elements, so a stray null (e.g. from a
      // missed querySelector) or a Window doesn't crash balanceElement.
      return toArray(target).filter(function (n) {
        return n && n.nodeType === 1
      })
    }
    return []
  }

  function readRatio(el, optRatio) {
    if (typeof optRatio === 'number') return optRatio
    var attr = el.getAttribute('data-br-ratio')
    if (attr !== null && attr !== '') {
      var n = parseFloat(attr)
      if (!isNaN(n)) return n
    }
    return 1
  }

  function readPreferNative(el, optPreferNative) {
    if (typeof optPreferNative === 'boolean') return optPreferNative
    var attr = el.getAttribute('data-br-prefer-native')
    if (attr === 'false') return false
    if (attr === 'true') return true
    return true // default, same as react-wrap-balancer
  }

  function readWrap(el, optWrap) {
    if (typeof optWrap === 'boolean') return optWrap
    if (el.getAttribute('data-br-wrap') === 'false') return false
    return true // default: wrap children in an inline-block span
  }

  /**
   * Apply the exact inline styles react-wrap-balancer puts on its wrapper.
   * `text-wrap` mirrors the React component: 'balance' when preferNative,
   * otherwise 'initial'. (On browsers without native support, 'balance' is an
   * ignored no-op and the JS path does the real work.)
   */
  function applyWrapperStyles(wrapper, preferNative) {
    var s = wrapper.style
    s.display = 'inline-block'
    s.verticalAlign = 'top'
    s.textDecoration = 'inherit'
    s.textWrap = preferNative ? 'balance' : 'initial'
  }

  /**
   * Resolve the wrapper element.
   * - wrap === true  (default): wrap the element's children in an inline-block
   *   <span>. The element becomes the CONTAINER and the span the WRAPPER —
   *   structurally identical to `<h1><Balancer>…</Balancer></h1>` in React.
   * - wrap === false: the element itself is the WRAPPER and its parent the
   *   CONTAINER.
   */
  function ensureWrapper(el, wrap) {
    if (!wrap) return el

    // Reuse a wrapper we created earlier (idempotency). We key off the
    // `data-br` attribute, NOT the in-memory handle: after destroy() the
    // handle is gone but the span remains, and re-balancing must reuse that
    // span instead of nesting a new one inside it (which would compound on
    // every destroy()->balance() cycle).
    var firstEl = el.firstElementChild
    if (
      firstEl &&
      firstEl === el.lastElementChild &&
      firstEl.hasAttribute('data-br')
    ) {
      return firstEl
    }

    var span = document.createElement('span')
    while (el.firstChild) {
      span.appendChild(el.firstChild)
    }
    el.appendChild(span)
    return span
  }

  function teardownObservers(wrapper) {
    if (wrapper[KEY_RESIZE_OBSERVER]) {
      wrapper[KEY_RESIZE_OBSERVER].disconnect()
      delete wrapper[KEY_RESIZE_OBSERVER]
    }
    if (wrapper[KEY_MUTATION_OBSERVER]) {
      wrapper[KEY_MUTATION_OBSERVER].disconnect()
      delete wrapper[KEY_MUTATION_OBSERVER]
    }
  }

  // Re-balance when the wrapper's text content changes. This mirrors React
  // re-running the layout effect when `children` change. We only observe
  // childList/characterData (NOT attributes), so the style.maxWidth writes from
  // relayout cannot feed back into this observer. Idempotent: no-op if present.
  function attachMutationObserver(wrapper, id) {
    if (wrapper[KEY_MUTATION_OBSERVER]) return
    if (typeof MutationObserver === 'undefined') return
    var mo = new MutationObserver(function () {
      relayout(id, +wrapper.dataset.brr, wrapper)
    })
    mo.observe(wrapper, { childList: true, characterData: true, subtree: true })
    wrapper[KEY_MUTATION_OBSERVER] = mo
  }

  /**
   * Balance a single element. Returns a handle object:
   *   { element, wrapper, id, ratio, preferNative, usingNative,
   *     rebalance(), destroy() }
   */
  function balanceElement(el, options) {
    options = options || {}

    var wrap = readWrap(el, options.wrap)
    var wrapper = ensureWrapper(el, wrap)
    var ratio = readRatio(el, options.ratio)
    var preferNative = readPreferNative(el, options.preferNative)

    // Idempotent: already managed -> update options + re-balance, reuse handle.
    if (wrapper[KEY_HANDLE]) {
      var existing = wrapper[KEY_HANDLE]
      existing.ratio = ratio
      existing.preferNative = preferNative
      wrapper.dataset.brr = String(ratio)
      applyWrapperStyles(wrapper, preferNative)
      var nowNative = preferNative && isNativeSupported()
      existing.usingNative = nowNative
      if (nowNative) {
        // Transition (back) to native: tear down the JS machinery and clear the
        // stale max-width so native CSS balances cleanly. Mirrors React
        // disconnecting its ResizeObserver when preferNative flips on.
        teardownObservers(wrapper)
        wrapper.style.maxWidth = ''
      } else {
        // JS path: run the search (lazily (re)attaches the ResizeObserver) and
        // ensure the MutationObserver exists — it is NOT attached by relayout,
        // and would be missing if this element was previously on the native path.
        relayout(existing.id, ratio, wrapper)
        attachMutationObserver(wrapper, existing.id)
      }
      return existing
    }

    // Assign identity (data-br / data-brr), exactly like react-wrap-balancer.
    // Reuse an existing id if the span survived a previous destroy().
    var id = wrapper.dataset.br || 'wb-' + (++idCounter).toString(36)
    wrapper.dataset.br = id
    wrapper.dataset.brr = String(ratio)
    applyWrapperStyles(wrapper, preferNative)

    var usingNative = preferNative && isNativeSupported()

    var handle = {
      element: el,
      wrapper: wrapper,
      id: id,
      ratio: ratio,
      preferNative: preferNative,
      usingNative: usingNative,
      rebalance: function () {
        // When relying on native CSS, the browser re-balances automatically.
        if (this.usingNative) return
        relayout(this.id, this.ratio, this.wrapper)
      },
      destroy: function () {
        teardownObservers(wrapper)
        wrapper.style.maxWidth = ''
        delete wrapper[KEY_HANDLE]
      },
    }

    wrapper[KEY_HANDLE] = handle

    // Native path: rely entirely on CSS text-wrap: balance. No JS, no
    // observers — identical to react-wrap-balancer when preferNative && support.
    if (usingNative) {
      return handle
    }

    // JS path: run the binary search now (also lazily attaches the
    // ResizeObserver via `relayout`), then watch for content changes.
    relayout(id, ratio, wrapper)
    attachMutationObserver(wrapper, id)

    return handle
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Balance one or many elements.
   * @param {string|Element|NodeList|Element[]} target
   * @param {{ratio?:number, preferNative?:boolean, wrap?:boolean}=} options
   * @returns {object[]} array of handles
   */
  function balance(target, options) {
    return resolveTargets(target).map(function (el) {
      return balanceElement(el, options)
    })
  }

  /**
   * Balance every element matching `[data-br-balance]` (or a custom selector).
   * @param {{selector?:string, ratio?:number, preferNative?:boolean, wrap?:boolean}=} options
   */
  function balanceAll(options) {
    options = options || {}
    var selector = options.selector || DEFAULT_SELECTOR
    return balance(selector, options)
  }

  // ---- Auto-init -----------------------------------------------------------

  var autoInitDone = false

  function rebalanceAll(selector) {
    var els = document.querySelectorAll(selector || DEFAULT_SELECTOR)
    for (var i = 0; i < els.length; i++) {
      var el = els[i]
      var wrapper =
        (el.firstElementChild && el.firstElementChild.hasAttribute('data-br')
          ? el.firstElementChild
          : el)
      var handle = wrapper[KEY_HANDLE]
      if (handle) handle.rebalance()
    }
  }

  function autoInit() {
    if (autoInitDone) return
    autoInitDone = true
    balanceAll()

    // One intentional enhancement over the React component: re-balance once
    // web fonts have finished loading. This only re-runs the deterministic
    // algorithm against the (now correct) metrics, so it converges to the
    // same final layout — it just avoids a wrong balance computed against a
    // fallback font (FOUT).
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        rebalanceAll()
      })
    }
  }

  // Kick off automatically unless the loading <script> opts out via
  // `data-auto="false"`.
  if (typeof document !== 'undefined') {
    var currentScript = document.currentScript
    var autoDisabled =
      currentScript && currentScript.getAttribute('data-auto') === 'false'

    if (!autoDisabled) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit)
      } else {
        autoInit()
      }
    }
  }

  return {
    version: '1.0.0',
    relayout: relayout,
    isNativeSupported: isNativeSupported,
    balance: balance,
    balanceAll: balanceAll,
    rebalanceAll: rebalanceAll,
    init: balanceAll,
  }
})
