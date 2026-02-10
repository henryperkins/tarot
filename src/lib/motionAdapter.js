/**
 * Motion adapter — anime.js-compatible API wrapping the motion library.
 *
 * Provides the same function signatures anime.js v4 exposes so that
 * consuming components only need to change their import path.
 *
 * Key differences handled:
 *  - duration / delay: milliseconds → seconds
 *  - easing names: anime.js names → cubic-bezier arrays
 *  - transform shorthands: translateX/Y → x/y
 *  - loop → repeat: Infinity
 *  - createTimeline → sequential animate via motion
 *  - createLayout → FLIP helper built on motion animate
 *  - createScope → cleanup tracker
 */

import {
  animate as motionAnimateImport,
  stagger as motionStaggerImport,
} from 'motion';

const DELAY_IN_SECONDS_FLAG = '__motionDelayInSeconds';

let _activeScope = null;
let motionAnimate = motionAnimateImport;
let motionStagger = motionStaggerImport;

export function __setMotionAdapterTestImpl({
  animateImpl,
  staggerImpl,
} = {}) {
  if (typeof animateImpl === 'function') {
    motionAnimate = animateImpl;
  }
  if (typeof staggerImpl === 'function') {
    motionStagger = staggerImpl;
  }
}

export function __resetMotionAdapterTestImpl() {
  motionAnimate = motionAnimateImport;
  motionStagger = motionStaggerImport;
}

function normalizeDelay(delay) {
  if (delay == null) return undefined;

  if (typeof delay === 'number') {
    return delay / 1000;
  }

  if (typeof delay === 'function') {
    if (delay[DELAY_IN_SECONDS_FLAG]) {
      return delay;
    }

    return (...args) => {
      const value = delay(...args);
      return typeof value === 'number' ? value / 1000 : value;
    };
  }

  return delay;
}

function mergeDelay(baseDelay, extraDelaySeconds) {
  if (!(typeof extraDelaySeconds === 'number' && extraDelaySeconds > 0)) {
    return baseDelay;
  }

  if (baseDelay == null) {
    return extraDelaySeconds;
  }

  if (typeof baseDelay === 'number') {
    return baseDelay + extraDelaySeconds;
  }

  if (typeof baseDelay === 'function') {
    return (...args) => {
      const value = baseDelay(...args);
      return typeof value === 'number' ? value + extraDelaySeconds : extraDelaySeconds;
    };
  }

  return baseDelay;
}

function getTargetCount(target) {
  if (!target) return 1;
  if (typeof target === 'string') {
    const root = _activeScope?.root;
    const base = root && typeof root.querySelectorAll === 'function'
      ? root
      : (typeof document !== 'undefined' ? document : null);
    const matches = base?.querySelectorAll?.(target);
    return matches?.length || 1;
  }
  if (Array.isArray(target)) return target.length || 1;
  if (typeof target === 'object' && typeof target.length === 'number') {
    return target.length || 1;
  }
  return 1;
}

function scheduleOnBegin(onBegin, delaySeconds, pendingTimers = null, target = null) {
  if (typeof onBegin !== 'function') return null;

  let resolvedDelay = null;
  if (typeof delaySeconds === 'number') {
    resolvedDelay = delaySeconds;
  } else if (typeof delaySeconds === 'function') {
    const total = getTargetCount(target);
    const computed = delaySeconds(0, total);
    if (typeof computed === 'number') {
      resolvedDelay = computed;
    }
  }

  if (typeof resolvedDelay === 'number' && resolvedDelay > 0) {
    const timerId = setTimeout(() => {
      pendingTimers?.delete(timerId);
      onBegin();
    }, resolvedDelay * 1000);
    pendingTimers?.add(timerId);
    return timerId;
  }

  // Zero-delay: use microtask to fire before the animation's first frame.
  // Wrap in a cancellable handle so scope.revert() can still prevent it.
  if (pendingTimers) {
    const handle = { cancelled: false };
    pendingTimers.add(handle);
    queueMicrotask(() => {
      pendingTimers.delete(handle);
      if (!handle.cancelled) onBegin();
    });
    return handle;
  }

  queueMicrotask(onBegin);
  return null;
}

function resolveScopedTarget(target) {
  if (typeof target !== 'string') return target;
  const root = _activeScope?.root;
  if (!root || typeof root.querySelectorAll !== 'function') return target;
  return root.querySelectorAll(target);
}

// ---------------------------------------------------------------------------
// Easing map — anime.js easing names → cubic-bezier arrays
// ---------------------------------------------------------------------------

const EASE_MAP = {
  linear: 'linear',
  easeInQuad: [0.55, 0.085, 0.68, 0.53],
  easeOutQuad: [0.25, 0.46, 0.45, 0.94],
  easeInOutQuad: [0.455, 0.03, 0.515, 0.955],
  inQuad: [0.55, 0.085, 0.68, 0.53],
  outQuad: [0.25, 0.46, 0.45, 0.94],
  inOutQuad: [0.455, 0.03, 0.515, 0.955],
  inCubic: [0.55, 0.055, 0.675, 0.52],
  outCubic: [0.215, 0.61, 0.355, 1],
  inOutCubic: [0.645, 0.045, 0.355, 1],
  inQuart: [0.895, 0.03, 0.685, 0.22],
  outQuart: [0.165, 0.84, 0.44, 1],
  inOutQuart: [0.77, 0, 0.175, 1],
  inBack: [0.6, -0.28, 0.735, 0.045],
  outBack: [0.175, 0.885, 0.32, 1.275],
  inOutBack: [0.68, -0.55, 0.265, 1.55],
};

function mapEase(ease) {
  if (ease == null) return undefined;
  if (Array.isArray(ease)) return ease;
  if (typeof ease === 'function') return ease;
  // Spring config object from our spring() helper
  if (typeof ease === 'object' && ease.__motionSpring) {
    return ease;
  }
  return EASE_MAP[ease] || ease;
}

// ---------------------------------------------------------------------------
// Transform property name mapping
// ---------------------------------------------------------------------------

const PROP_RENAMES = {
  translateX: 'x',
  translateY: 'y',
  translateZ: 'z',
};

function mapKeyframes(kf) {
  const mapped = {};
  for (const [key, value] of Object.entries(kf)) {
    mapped[PROP_RENAMES[key] || key] = value;
  }
  return mapped;
}

// ---------------------------------------------------------------------------
// Option keys that should be separated from keyframes
// ---------------------------------------------------------------------------

const OPTION_KEYS = new Set([
  'duration', 'delay', 'ease', 'loop', 'alternate', 'autoplay',
  'onBegin', 'onComplete', 'onUpdate', 'playbackRate',
]);

function splitKeyframesAndOptions(mixed) {
  const keyframes = {};
  const options = {};
  for (const [key, value] of Object.entries(mixed)) {
    if (OPTION_KEYS.has(key)) {
      options[key] = value;
    } else {
      keyframes[key] = value;
    }
  }
  return [keyframes, options];
}

// ---------------------------------------------------------------------------
// Map anime.js options → motion options
// ---------------------------------------------------------------------------

function mapOptions(opts = {}) {
  const { duration, delay, ease, loop, alternate, onBegin, onComplete, onUpdate, ...rest } = opts;
  const mapped = { ...rest };

  if (duration !== undefined) mapped.duration = duration / 1000;
  if (delay !== undefined) mapped.delay = normalizeDelay(delay);

  const resolvedEase = mapEase(ease);
  if (resolvedEase && typeof resolvedEase === 'object' && resolvedEase.__motionSpring) {
    // Spring easing — pass spring config as transition options
    mapped.type = 'spring';
    mapped.stiffness = resolvedEase.stiffness;
    mapped.damping = resolvedEase.damping;
    if (resolvedEase.mass) mapped.mass = resolvedEase.mass;
    // Spring determines its own duration, but allow override
    if (duration !== undefined) mapped.duration = duration / 1000;
  } else if (resolvedEase !== undefined) {
    mapped.ease = resolvedEase;
  }

  if (loop) {
    mapped.repeat = loop === true ? Infinity : loop;
    if (alternate) mapped.repeatType = 'reverse';
  }

  if (onComplete) mapped.onComplete = onComplete;
  if (onUpdate) mapped.onUpdate = onUpdate;

  return { mapped, onBegin };
}

// ---------------------------------------------------------------------------
// animate(target, propsOrKeyframes, extraOptions?)
//
// Supports both anime.js v4 combined format:
//   animate(el, { opacity: 1, duration: 300, ease: 'outQuad' })
// and separated format:
//   animate(el, { opacity: 1 }, { duration: 300, ease: 'outQuad' })
// ---------------------------------------------------------------------------

const NOOP_CONTROLS = { pause() {}, play() {}, stop() {}, cancel() {}, then(fn) { return Promise.resolve().then(fn); }, catch() { return Promise.resolve(); } };

export function animate(target, mixed, extraOptions) {
  if (!target) return NOOP_CONTROLS;

  let keyframes, options;
  if (extraOptions && typeof extraOptions === 'object' && Object.keys(extraOptions).length > 0) {
    // Separated format: animate(el, keyframes, options)
    keyframes = mixed;
    options = extraOptions;
  } else {
    // Combined format: animate(el, { ...keyframes, ...options })
    [keyframes, options] = splitKeyframesAndOptions(mixed);
  }

  const { mapped, onBegin } = mapOptions(options);
  const mappedKf = mapKeyframes(keyframes);

  const resolvedTarget = resolveScopedTarget(target);
  scheduleOnBegin(onBegin, mapped.delay, _activeScope?._pendingTimers, resolvedTarget);

  const controls = motionAnimate(resolvedTarget, mappedKf, mapped);

  // Track in active scope if present
  if (_activeScope) {
    _activeScope._animations.push(controls);
  }

  return controls;
}

// ---------------------------------------------------------------------------
// set(target, props) — instant property assignment
// ---------------------------------------------------------------------------

export function set(target, props) {
  if (!target) return;
  const mapped = mapKeyframes(props);
  return motionAnimate(resolveScopedTarget(target), mapped, { duration: 0 });
}

// ---------------------------------------------------------------------------
// spring(config) — returns a spring easing config
// ---------------------------------------------------------------------------

export function spring(config = {}) {
  return {
    __motionSpring: true,
    stiffness: config.stiffness || 100,
    damping: config.damping || 10,
    mass: config.mass || 1,
  };
}

// ---------------------------------------------------------------------------
// cubicBezier(x1, y1, x2, y2)
// ---------------------------------------------------------------------------

export function cubicBezier(x1, y1, x2, y2) {
  return [x1, y1, x2, y2];
}

// ---------------------------------------------------------------------------
// stagger(valueMs, options?)
// ---------------------------------------------------------------------------

export function stagger(valueMs, options = {}) {
  const delay = motionStagger(valueMs / 1000, options);
  delay[DELAY_IN_SECONDS_FLAG] = true;
  return delay;
}

// ---------------------------------------------------------------------------
// createTimeline({ autoplay? }) — builder that mimics anime.js timeline
// ---------------------------------------------------------------------------

export function createTimeline(options = {}) {
  const segments = [];
  let controls = null;
  let resolveFinished = null;
  let rejectFinished = null;
  const finishedPromise = new Promise((resolve, reject) => {
    resolveFinished = resolve;
    rejectFinished = reject;
  });

  const tl = {
    add(target, mixed, offset) {
      const [rawKeyframes, rawOptions] = splitKeyframesAndOptions(mixed);
      const mappedKf = mapKeyframes(rawKeyframes);
      const { mapped, onBegin } = mapOptions(rawOptions);

      // Handle offset (absolute time in ms from anime.js)
      if (offset !== undefined) {
        mapped.at = offset / 1000;
      }

      if (onBegin) {
        mapped.onBegin = onBegin;
      }

      segments.push([target, mappedKf, mapped]);
      return tl;
    },

    play() {
      if (segments.length === 0) return;
      // Run segments sequentially using chained animate calls
      let chain = Promise.resolve();
      const anims = [];
      const beginTimers = new Set();
      let currentTime = 0;

      const clearBeginTimers = () => {
        beginTimers.forEach((entry) => {
          if (typeof entry === 'number') {
            clearTimeout(entry);
          } else if (entry && typeof entry === 'object') {
            entry.cancelled = true;
          }
        });
        beginTimers.clear();
      };

      // Sort segments by their 'at' offset if present
      const sorted = segments.map((seg, i) => ({ seg, index: i }));

      for (const { seg } of sorted) {
        const [target, kf, opts] = seg;
        const { at, onBegin: segOnBegin, ...restOpts } = opts;

        if (at !== undefined) {
          // Absolute offset — compute delay relative to current chain position
          const waitTime = at - currentTime;
          if (waitTime > 0) {
            restOpts.delay = mergeDelay(restOpts.delay, waitTime);
          }
        }

        chain = chain.then(() => {
          scheduleOnBegin(segOnBegin, restOpts.delay, beginTimers, target);
          const anim = motionAnimate(target, kf, restOpts);
          anims.push(anim);
          const numericDelay = typeof restOpts.delay === 'number' ? restOpts.delay : 0;
          currentTime = (at ?? currentTime) + numericDelay + (restOpts.duration || 0);
          return anim;
        });
      }

      chain.then(() => resolveFinished()).catch(err => rejectFinished(err));

      controls = {
        pause() {
          clearBeginTimers();
          anims.forEach(a => a?.pause?.());
        },
        play() { anims.forEach(a => a?.play?.()); },
        stop() {
          clearBeginTimers();
          anims.forEach(a => a?.stop?.());
        },
        cancel() {
          clearBeginTimers();
          anims.forEach(a => a?.cancel?.());
        },
      };
    },

    pause() { controls?.pause?.(); },
    play_resume() { controls?.play?.(); },
    stop() { controls?.stop?.(); },
    cancel() {
      controls?.cancel?.();
      rejectFinished(new Error('cancelled'));
    },

    then(onFulfilled, onRejected) {
      return finishedPromise.then(onFulfilled, onRejected);
    },

    catch(onRejected) {
      return finishedPromise.catch(onRejected);
    },
  };

  if (options.autoplay !== false) {
    // Defer play to allow .add() calls
    queueMicrotask(() => tl.play());
  }

  return tl;
}

// ---------------------------------------------------------------------------
// createLayout(container, { children, duration, ease }) — FLIP helper
// ---------------------------------------------------------------------------

export function createLayout(container, options = {}) {
  const { children: childSelector, duration: durMs = 300, ease = 'outQuad' } = options;
  let recorded = new Map();

  function getChildren() {
    if (!container) return [];
    return Array.from(container.querySelectorAll(childSelector));
  }

  function record() {
    recorded = new Map();
    for (const el of getChildren()) {
      recorded.set(el, el.getBoundingClientRect());
    }
  }

  // Initial record
  record();

  return {
    record,

    animate(animOptions = {}) {
      const {
        duration: aDurMs = durMs,
        ease: aEase = ease,
        enterFrom = {},
        leaveTo = {},
      } = animOptions;

      const { mapped: enterOpts } = mapOptions({
        duration: aDurMs,
        ease: aEase,
      });

      const children = getChildren();
      const childSet = new Set(children);
      const animations = [];

      children.forEach((el, index) => {
        const prev = recorded.get(el);
        if (!prev) {
          // New element — enter animation
          const { delay: delayFn, duration: eDur, ease: eEase, ...enterProps } = enterFrom;
          const resolvedDelayFn = normalizeDelay(delayFn);
          const d = typeof resolvedDelayFn === 'function'
            ? resolvedDelayFn(el, index, children.length)
            : (resolvedDelayFn ?? 0);

          // Set initial state
          const initProps = mapKeyframes(enterProps);
          motionAnimate(el, initProps, { duration: 0 });

          // Animate to natural state
          const naturalState = {};
          for (const key of Object.keys(initProps)) {
            if (key === 'opacity') naturalState.opacity = 1;
            else if (key === 'scale') naturalState.scale = 1;
            else if (key === 'filter') naturalState.filter = 'blur(0px)';
            else naturalState[key] = key === 'y' || key === 'x' ? 0 : 1;
          }

          const opts = { ...enterOpts, delay: d };
          if (eDur != null) opts.duration = eDur / 1000;
          if (eEase != null) opts.ease = mapEase(eEase);
          animations.push(motionAnimate(el, naturalState, opts));
        } else {
          // Existing element — FLIP
          const curr = el.getBoundingClientRect();
          const dx = prev.left - curr.left;
          const dy = prev.top - curr.top;
          const dw = prev.width / (curr.width || 1);
          const dh = prev.height / (curr.height || 1);

          if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
            motionAnimate(el, { x: dx, y: dy }, { duration: 0 });
            animations.push(motionAnimate(el, { x: 0, y: 0 }, enterOpts));
          }
          if (Math.abs(dw - 1) > 0.01 || Math.abs(dh - 1) > 0.01) {
            // Set transform-origin to center for predictable scaling
            el.style.transformOrigin = 'center center';
            motionAnimate(el, { scaleX: dw, scaleY: dh }, { duration: 0 });
            animations.push(motionAnimate(el, { scaleX: 1, scaleY: 1 }, enterOpts));
          }
        }
      });

      // Handle leaving elements
      recorded.forEach((rect, el) => {
        if (!childSet.has(el) && el.parentNode) {
          const { duration: lDur, ease: lEase, delay: lDelay, ...leaveProps } = leaveTo;
          const { mapped: leaveOpts } = mapOptions({
            duration: lDur ?? aDurMs,
            ease: lEase ?? aEase,
            delay: lDelay,
          });
          animations.push(motionAnimate(el, mapKeyframes(leaveProps), leaveOpts));
        }
      });

      record(); // Update recorded positions

      return {
        pause() { animations.forEach(a => a?.pause?.()); },
        play() { animations.forEach(a => a?.play?.()); },
        then(fn) { return Promise.all(animations.map(a => a)).then(fn); },
      };
    },

    revert() {
      recorded.clear();
    },
  };
}

// ---------------------------------------------------------------------------
// createScope({ root }) — scoped animation cleanup tracker
//
// Supports the anime.js v4 pattern:
//   const scope = createScope({ root }).add(() => { animate(...); });
//   scope.revert();
// ---------------------------------------------------------------------------

export function createScope(options = {}) {
  const scope = {
    root: options.root,
    _animations: [],
    _pendingTimers: new Set(),
    add(callbackOrAnim) {
      if (typeof callbackOrAnim === 'function') {
        const prevScope = _activeScope;
        _activeScope = scope;
        try {
          callbackOrAnim();
        } finally {
          _activeScope = prevScope;
        }
      } else if (callbackOrAnim) {
        scope._animations.push(callbackOrAnim);
      }
      return scope;
    },
    revert() {
      scope._pendingTimers.forEach(entry => {
        if (typeof entry === 'number') {
          clearTimeout(entry);
        } else if (entry && typeof entry === 'object') {
          entry.cancelled = true;
        }
      });
      scope._pendingTimers.clear();
      scope._animations.forEach(a => {
        try { a?.stop?.(); } catch (_e) { /* noop */ }
        try { a?.cancel?.(); } catch (_e) { /* noop */ }
      });
      scope._animations.length = 0;
    },
  };
  return scope;
}
