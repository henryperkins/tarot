// Browser-side pictured-region measurement for the opt-in gesture companion.
// Shared by the artwork matrix capture and deck regressions. It reads the
// served mask geometry from the rendered overlay and the actual painted image
// box after every CSS transform; it never derives truth from configuration.

/** Runs inside the page. Returns plain JSON for one focus layer. */
export function measureGestureFocusLayer() {
  const PLANE = { width: 1086, height: 1810 };
  const box = element => { const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
  const intersect = (a, b) => { const left = Math.max(a.left, b.left), top = Math.max(a.top, b.top), right = Math.min(a.right, b.right), bottom = Math.min(a.bottom, b.bottom);
    return { left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }; };
  const round = value => Math.round(value * 100) / 100;
  const roundRect = rect => Object.fromEntries(Object.entries(rect).map(([key, value]) => [key, round(value)]));
  const windowElement = document.querySelector('[data-gesture-window]');
  const layer = windowElement?.querySelector('.gesture-focus-layer:not(.gesture-focus-layer--departing)');
  const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight, width: innerWidth, height: innerHeight };
  const departingLayers = windowElement ? windowElement.querySelectorAll('.gesture-focus-layer--departing').length : 0;
  if (!layer) return { layer: false, departingLayers };
  const clipFor = element => {
    let clip = viewport;
    for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      const bounds = box(node);
      // Per axis: overflow-x/y: clip may leave the other axis visible.
      if (style.overflowX !== 'visible') clip = intersect(clip, { left: bounds.left, right: bounds.right, top: clip.top, bottom: clip.bottom });
      if (style.overflowY !== 'visible') clip = intersect(clip, { left: clip.left, right: clip.right, top: bounds.top, bottom: bounds.bottom });
    }
    return clip;
  };
  // Every ancestor transform is composed; exactly one half turn means one reversal.
  const orientationFor = element => {
    let matrix = [1, 0, 0, 1]; const halfTurns = []; const unexpected = [];
    for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
      const value = getComputedStyle(node).transform;
      if (!value || value === 'none') continue;
      const own = new DOMMatrixReadOnly(value);
      const [a, b, c, d] = [own.a, own.b, own.c, own.d];
      if (a < 0 && d < 0 && Math.abs(b) < 1e-6 && Math.abs(c) < 1e-6) halfTurns.push(node.className?.baseVal ?? node.className);
      else if (a <= 0 || d <= 0 || Math.abs(b) > 1e-6 || Math.abs(c) > 1e-6) unexpected.push({ element: node.className?.baseVal ?? node.className, transform: value });
      matrix = [a * matrix[0] + c * matrix[1], b * matrix[0] + d * matrix[1], a * matrix[2] + c * matrix[3], b * matrix[2] + d * matrix[3]];
    }
    return { halfTurns, unexpected, composed: matrix.map(round), reversed: matrix[0] < 0 && matrix[3] < 0 };
  };
  const cards = [...layer.querySelectorAll('[data-focus-card]')].map(card => {
    const arts = [...card.querySelectorAll('[data-gesture-art]')].map(art => {
      const image = art.querySelector('img.gesture-art__image');
      const upright = art.querySelector('.gesture-art__upright');
      const light = art.querySelector('svg.gesture-art__light');
      const water = art.querySelector('svg.gesture-art__water');
      const imageRect = box(image);
      const clip = clipFor(art);
      const visible = intersect(clip, imageRect);
      const orientation = orientationFor(image);
      const maskElement = light ? [...light.querySelectorAll('mask')].find(mask => !mask.id.endsWith('-surround-mask')) : null;
      const spots = maskElement ? [...maskElement.querySelectorAll('ellipse')].map(ellipse => {
        const value = name => Number(ellipse.getAttribute(name));
        const rotation = Number((ellipse.getAttribute('transform') || '').match(/rotate\(([-\d.]+)/)?.[1] || 0);
        const u = value('cx') / PLANE.width, v = value('cy') / PLANE.height;
        const x = orientation.reversed ? imageRect.right - u * imageRect.width : imageRect.left + u * imageRect.width;
        const y = orientation.reversed ? imageRect.bottom - v * imageRect.height : imageRect.top + v * imageRect.height;
        const ex = value('rx') / PLANE.width * imageRect.width, ey = value('ry') / PLANE.height * imageRect.height;
        const theta = rotation * Math.PI / 180;
        const halfWidth = Math.hypot(ex * Math.cos(theta), ey * Math.sin(theta));
        const halfHeight = Math.hypot(ex * Math.sin(theta), ey * Math.cos(theta));
        const margin = Math.min(x - visible.left, visible.right - x, y - visible.top, visible.bottom - y);
        const extent = intersect(visible, { left: x - halfWidth, right: x + halfWidth, top: y - halfHeight, bottom: y + halfHeight });
        return { upright: { x: round(u), y: round(v), rx: round(value('rx') / PLANE.width), ry: round(value('ry') / PLANE.height), rotation },
          screen: { x: round(x), y: round(y), halfWidth: round(halfWidth), halfHeight: round(halfHeight) },
          centerInside: visible.width > 0 && visible.height > 0 && margin >= 0, centerMarginPx: round(margin),
          extentVisibleFraction: round((extent.width * extent.height) / Math.max(1e-9, 4 * halfWidth * halfHeight)) };
      }) : [];
      const sameBox = element => { if (!element) return null; const r = box(element);
        return Math.max(Math.abs(r.left - imageRect.left), Math.abs(r.top - imageRect.top), Math.abs(r.right - imageRect.right), Math.abs(r.bottom - imageRect.bottom)) <= .75; };
      const overlayTransforms = [light, water].filter(Boolean).map(element => getComputedStyle(element).transform);
      return {
        cardName: art.dataset.cardName, crop: art.dataset.crop === 'true', calm: art.dataset.calm === 'true', held: art.dataset.held === 'true',
        reversedAttribute: upright?.dataset.reversed === 'true',
        presence: Number(getComputedStyle(art).opacity), visibility: getComputedStyle(art).visibility,
        cropVariables: Object.fromEntries(['--crop-x', '--crop-y', '--crop-zoom', '--crop-zoom-short'].map(name => [name, art.style.getPropertyValue(name)])),
        planeTransform: getComputedStyle(art.querySelector('.gesture-art__plane')).transform,
        image: { src: image.getAttribute('src'), complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight },
        artRect: roundRect(box(art)), imageRect: roundRect(imageRect), clipRect: roundRect(clip), visibleRect: roundRect(visible),
        orientation, overlay: { lightAligned: sameBox(light), waterAligned: sameBox(water), sharedPlane: [light, water].filter(Boolean).every(element => element.parentElement === upright && image.parentElement === upright),
          overlayTransforms, traces: art.querySelectorAll('[data-gesture-finite]').length, waterDetails: [...art.querySelectorAll('[data-water-detail]')].map(element => element.dataset.waterDetail) },
        spots
      };
    });
    return { occurrenceId: card.dataset.occurrenceId, details: (card.dataset.details || '').split(' ').filter(Boolean), ariaLabel: card.getAttribute('aria-label'),
      ariaPressed: card.getAttribute('aria-pressed'), disabled: card.disabled, cardRect: roundRect(box(card)), arts };
  });
  const companion = document.querySelector('.gesture-companion');
  const animations = document.getAnimations().filter(animation => {
    const target = animation.effect?.target;
    return target && windowElement.contains(target);
  }).map(animation => ({ name: animation.animationName || animation.id || 'web-animation', playState: animation.playState,
    target: animation.effect.target.getAttribute?.('class') || animation.effect.target.tagName,
    iterations: animation.effect.getComputedTiming?.().iterations ?? null, duration: animation.effect.getComputedTiming?.().duration ?? null }));
  const shelf = [...document.querySelectorAll('[data-gesture-shelf] button')].map(button => ({ ariaLabel: button.getAttribute('aria-label'), disabled: button.disabled,
    reversedAttribute: button.querySelector('.gesture-art__upright')?.dataset.reversed === 'true' }));
  return {
    layer: true, departingLayers, pair: layer.dataset.pair === 'true',
    window: { association: windowElement.dataset.association, held: windowElement.dataset.held === 'true', phase: windowElement.dataset.phase, rect: roundRect(box(windowElement)) },
    companionRect: companion ? roundRect(box(companion)) : null, cards, shelf,
    runningAnimations: animations.filter(animation => animation.playState === 'running'), animations,
    waterOpacity: getComputedStyle(windowElement.querySelector('.gesture-art') || windowElement).getPropertyValue('--gesture-water-opacity') || null,
    overflow: { page: document.documentElement.scrollWidth, viewport: innerWidth, companion: companion ? companion.scrollWidth - companion.clientWidth : null },
    environment: { reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, viewport: { width: innerWidth, height: innerHeight },
      devicePixelRatio, userAgent: navigator.userAgent, scrollY }
  };
}

/** Waits for the current held layer to finish finite arrival/trace work and decode. */
export async function settleGestureFocusLayer(page) {
  await page.waitForFunction(() => !document.querySelector('[data-gesture-window] .gesture-focus-layer--departing'), null, { timeout: 5000 });
  return page.locator('[data-gesture-window] .gesture-focus-layer:not(.gesture-focus-layer--departing)').evaluate(async layer => {
    const images = [...layer.querySelectorAll('img.gesture-art__image')];
    const decoded = await Promise.all(images.map(image => image.decode().then(() => true, () => false)));
    // document.getAnimations() avoids relying on engine support for { subtree }.
    const finite = document.getAnimations().filter(animation => animation.effect?.target && layer.contains(animation.effect.target)
      && animation.effect.getComputedTiming().iterations !== Infinity);
    await Promise.allSettled(finite.map(animation => animation.finished));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { decoded, finiteAnimationsAwaited: finite.length };
  });
}
