import { resolveAppChrome } from './appChromeLayout.js';

/** One page-scoped measurement owner. Components declare their natural boxes;
 * this coordinator publishes clearance and releases chrome in the spec order. */
export function observeAppChrome(header) {
  const page = header.closest('[data-app-chrome]');
  if (!page) return () => {};
  const root = document.documentElement;
  const rootProperties = ['--pinned-header-height', '--pinned-wayfinding-height', '--app-bottom-height', '--mobile-action-bar-height', 'scroll-padding-top', 'scroll-padding-bottom'];
  const previous = rootProperties.map(key => [key, root.style.getPropertyValue(key), root.style.getPropertyPriority(key)]);
  let frame = null;
  let focusFrame = null;
  let revealAfterResize = false;
  const observed = new Set();
  const sizes = new Map();
  let region;
  let actions;
  let dock;
  let dockNav;
  let secondaries = [];
  let viewport;
  let safeBottom = 0;
  const focusable = 'input, textarea, select, button, a[href]';
  const height = element => sizes.get(element)?.height || 0;
  const set = (element, name, value) => {
    if (element && element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
  };
  const attribute = (element, name, value) => {
    if (element && element.getAttribute(name) !== String(value)) element.setAttribute(name, String(value));
  };
  const schedule = () => { if (frame === null) frame = requestAnimationFrame(measure); };
  const readViewport = () => ({
    width: window.innerWidth,
    height: window.visualViewport?.height || window.innerHeight,
    layoutWidth: root.clientWidth
  });
  const resize = new ResizeObserver(entries => {
    // ResizeObserver runs after layout. Save its measurements for the frame
    // that writes the placements, which can also run after a DOM mutation.
    for (const { target, borderBoxSize } of entries) {
      const box = borderBoxSize?.[0];
      sizes.set(target, box ? { width: box.inlineSize, height: box.blockSize } : target.getBoundingClientRect());
    }
    viewport = readViewport();
    safeBottom = region && !region.hidden
      ? parseFloat(getComputedStyle(region).getPropertyValue('--chrome-safe-bottom')) || 0
      : 0;
    const focused = document.activeElement;
    // Reflow can obscure a visible control, or resize its own flow actions.
    // It must not undo deliberate scrolling away from an unrelated input.
    if (focused?.matches(focusable) && page.contains(focused) && !focused.closest('[data-app-header]')) {
      const ownChromeResized = entries.some(({ target }) => target.contains(focused)
        && target.matches('[data-app-bottom-actions], [data-app-secondary]'));
      const bounds = ownChromeResized ? null : focused.getBoundingClientRect();
      if (ownChromeResized || (bounds?.bottom > 0 && bounds.top < window.innerHeight)) revealAfterResize = true;
    }
    schedule();
  });
  function observeBoxes() {
    const nextRegion = page.querySelector('[data-app-bottom-region]');
    if (region !== nextRegion) safeBottom = 0;
    region = nextRegion;
    actions = region?.querySelector('[data-app-bottom-actions]');
    dock = region?.querySelector('[data-destination-group="dock"]');
    dockNav = dock?.querySelector('nav');
    secondaries = [...page.querySelectorAll('[data-app-secondary]')]
      .sort((a, b) => Number(a.dataset.appSecondary) - Number(b.dataset.appSecondary));
    const boxes = new Set([header, region, actions, dock, dockNav, ...secondaries].filter(Boolean));
    for (const element of observed) {
      if (boxes.has(element)) continue;
      resize.unobserve(element);
      observed.delete(element);
      sizes.delete(element);
    }
    for (const element of boxes) {
      if (observed.has(element)) continue;
      observed.add(element);
      resize.observe(element, { box: 'border-box' });
    }
  }
  function measureFixedActions(region, actions) {
    // A flow region inside a padded main can wrap more than the fixed dock.
    const position = region.style.getPropertyValue('position');
    const priority = region.style.getPropertyPriority('position');
    const pageScroll = { left: window.scrollX, top: window.scrollY };
    const scrollers = [region, ...region.querySelectorAll('*')]
      .map(element => ({ element, left: element.scrollLeft, top: element.scrollTop }))
      .filter(({ left, top }) => left || top);
    region.style.setProperty('position', 'fixed');
    try { return actions.getBoundingClientRect().height; }
    finally {
      if (position) region.style.setProperty('position', position, priority);
      else region.style.removeProperty('position');
      // Restore flow geometry before restoring any scroll offsets the probe clamped.
      region.getBoundingClientRect();
      scrollers.forEach(({ element, left, top }) => {
        if (element.scrollLeft !== left || element.scrollTop !== top) element.scrollTo({ left, top, behavior: 'instant' });
      });
      if (window.scrollX !== pageScroll.left || window.scrollY !== pageScroll.top) {
        window.scrollTo({ ...pageScroll, behavior: 'instant' });
      }
    }
  }
  function measure() {
    frame = null;
    if (!viewport) return;

    // Solve from the last rendered sizes, then apply the chosen placements.
    const activeRegion = region && !region.hidden;
    let actionsHeight = activeRegion ? height(actions) : 0;
    const dockHeight = activeRegion && !dock?.hidden ? height(dockNav) : 0;
    const headerHeight = height(header);
    const { width: visibleWidth, height: visibleHeight, layoutWidth } = viewport;
    const offset = activeRegion ? Number(region.dataset.keyboardOffset) || 0 : 0;
    // Month headings replace one another; only one occupies the pinned row.
    const groupHeights = new Map();
    const measuredSecondaries = secondaries.map(element => {
      const group = element.dataset.chromeGroup || element;
      const eligible = visibleWidth >= Number(element.dataset.chromeMinWidth || 0)
        && visibleHeight >= Number(element.dataset.chromeMinHeight || 0);
      const naturalHeight = eligible ? height(element) : 0;
      groupHeights.set(group, Math.max(groupHeights.get(group) || 0, naturalHeight));
      return { element, group, naturalHeight };
    });
    if (actionsHeight && region.dataset.actionsInFlow === 'true'
        && Math.abs((sizes.get(region)?.width || layoutWidth) - layoutWidth) > 0.5) {
      actionsHeight = measureFixedActions(region, actions);
    }

    const layout = resolveAppChrome({ visibleHeight,
      headerHeight, actionsHeight, dockHeight, safeBottom: activeRegion ? safeBottom : 0,
      secondaryHeights: [...groupHeights.values()],
      prioritizeActions: Boolean(actions?.querySelector('[data-reading-completion]')) });
    const pinnedGroups = new Set([...groupHeights.keys()].filter((_, index) => layout.secondaryPinned[index]));
    // Empty or hidden rows have no placement decision to carry into their first paint.
    attribute(region, 'data-actions-in-flow', actionsHeight > 0 && !layout.actionsPinned);
    attribute(region, 'data-dock-in-flow', dockHeight > 0 && !layout.dockPinned);
    attribute(region, 'data-has-fixed', layout.actionsPinned || layout.dockPinned);
    set(header, 'position', layout.headerPinned ? 'sticky' : 'relative');
    const pinnedHeader = layout.headerPinned ? headerHeight : 0;
    set(page, '--sticky-header-height', `${pinnedHeader}px`);
    set(root, '--pinned-header-height', `${pinnedHeader}px`);
    let topHeight = pinnedHeader;
    let floatingHeight = 0;
    let wayfindingHeight = 0;
    measuredSecondaries.forEach(({ element, group, naturalHeight }) => {
      const pinned = pinnedGroups.has(group) && naturalHeight > 0;
      attribute(element, 'data-chrome-pinned', pinned);
      const reserved = pinned ? naturalHeight : 0;
      if (element.dataset.chromePlacement === 'bottom') floatingHeight += reserved ? reserved + 16 : 0;
      else {
        set(element, '--chrome-secondary-top', `${pinnedHeader}px`);
        topHeight = Math.max(topHeight, pinnedHeader + reserved);
      }
      const variable = element.dataset.chromeHeightVar;
      if (variable) {
        set(page, variable, `${reserved}px`);
        // Reading's contents also publish to their local narrative container.
        if (variable === '--reading-wayfinding-height') {
          set(element.closest('[data-reading-section]') || element.parentElement, variable, `${reserved}px`);
          wayfindingHeight = reserved;
        }
      }
    });
    set(root, '--pinned-wayfinding-height', `${wayfindingHeight}px`);
    const bottomHeight = layout.bottomHeight;
    set(page, '--app-bottom-height', `${bottomHeight}px`);
    set(page, '--app-keyboard-clearance', `${offset}px`);
    set(page, '--journal-controls-inset', `${floatingHeight}px`);
    set(root, '--app-bottom-height', `${bottomHeight}px`);
    set(root, '--mobile-action-bar-height', `${bottomHeight}px`);
    set(root, 'scroll-padding-top', `${topHeight + 16}px`);
    set(root, 'scroll-padding-bottom', `${bottomHeight + floatingHeight + offset + 16}px`);
    if (revealAfterResize) { revealAfterResize = false; onFocus(); }
  }
  const onFocus = () => {
    if (focusFrame !== null) cancelAnimationFrame(focusFrame);
    focusFrame = requestAnimationFrame(() => {
      focusFrame = null;
      const focused = document.activeElement;
      if (!page.contains(focused) || focused.closest('[data-app-header]')) return;
      const secondary = focused.closest('[data-app-secondary]');
      if (secondary && secondary.dataset.chromePinned !== 'false') return;
      const bottomRegion = focused.closest('[data-app-bottom-region]');
      if (bottomRegion && (!focused.closest('[data-app-bottom-actions]') || bottomRegion.dataset.actionsInFlow !== 'true')) return;
      if (!focused.matches(focusable)) return;
      const bounds = focused.getBoundingClientRect();
      const style = getComputedStyle(root);
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop || 0;
      const top = viewportTop + (parseFloat(style.scrollPaddingTop) || 0);
      const bottom = Math.min(window.innerHeight - (parseFloat(style.scrollPaddingBottom) || 0),
        viewportTop + (viewport?.height || window.innerHeight) - 16);
      if (bounds.height > bottom - top) return;
      const offset = bounds.bottom > bottom ? bounds.bottom - bottom : bounds.top < top ? bounds.top - top : 0;
      if (offset) window.scrollBy({ top: offset, behavior: 'instant' });
    });
  };
  const onViewportResize = () => {
    viewport = readViewport();
    revealAfterResize = true;
    schedule();
  };
  const mutations = new MutationObserver(() => {
    observeBoxes();
    schedule();
  });
  mutations.observe(page, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'data-keyboard-offset'] });
  window.addEventListener('resize', onViewportResize);
  window.visualViewport?.addEventListener('resize', onViewportResize);
  page.addEventListener('focusin', onFocus);
  observeBoxes();
  return () => {
    resize.disconnect(); mutations.disconnect();
    if (frame !== null) cancelAnimationFrame(frame);
    if (focusFrame !== null) cancelAnimationFrame(focusFrame);
    window.removeEventListener('resize', onViewportResize);
    window.visualViewport?.removeEventListener('resize', onViewportResize);
    page.removeEventListener('focusin', onFocus);
    previous.forEach(([key, value, priority]) => {
      if (value) root.style.setProperty(key, value, priority); else root.style.removeProperty(key);
    });
  };
}
