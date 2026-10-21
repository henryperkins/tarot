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
  const height = element => element?.getBoundingClientRect().height || 0;
  const set = (element, name, value) => {
    if (element && element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
  };
  const attribute = (element, name, value) => {
    if (element && element.getAttribute(name) !== String(value)) element.setAttribute(name, String(value));
  };
  const schedule = () => { if (frame === null) frame = requestAnimationFrame(measure); };
  const resize = new ResizeObserver(entries => {
    const focused = document.activeElement;
    const bounds = focused?.getBoundingClientRect();
    const ownChromeResized = entries.some(({ target }) => target.contains(focused)
      && target.matches('[data-app-bottom-actions], [data-app-secondary]'));
    // Reflow can obscure a visible control, or resize its own flow actions.
    // It must not undo deliberate scrolling away from an unrelated input.
    if (ownChromeResized || (bounds?.bottom > 0 && bounds.top < window.innerHeight)) revealAfterResize = true;
    schedule();
  });
  function measure() {
    frame = null;
    const region = page.querySelector('[data-app-bottom-region]');
    const actions = region?.querySelector('[data-app-bottom-actions]');
    const dock = region?.querySelector('[data-destination-group="dock"]');
    const secondaries = [...page.querySelectorAll('[data-app-secondary]')]
      .sort((a, b) => Number(a.dataset.appSecondary) - Number(b.dataset.appSecondary));
    const boxes = [header, region, actions, dock, ...secondaries].filter(Boolean);
    for (const element of observed) if (!boxes.includes(element)) { resize.unobserve(element); observed.delete(element); }
    for (const element of boxes) if (!observed.has(element)) { observed.add(element); resize.observe(element, { box: 'border-box' }); }
    const activeRegion = region && !region.hidden;
    let actionsHeight = activeRegion ? height(actions) : 0;
    if (activeRegion && actions && region.dataset.actionsInFlow === 'true') {
      // Flow may sit inside a padded main, making its actions narrower/taller.
      // Measure their prospective fixed geometry before choosing placement.
      // Restore synchronously so the same focused DOM stays in its real layout.
      const position = region.style.getPropertyValue('position');
      const priority = region.style.getPropertyPriority('position');
      const pageScroll = { left: window.scrollX, top: window.scrollY };
      const scrollers = [region, ...region.querySelectorAll('*')]
        .map(element => ({ element, left: element.scrollLeft, top: element.scrollTop }))
        .filter(({ left, top }) => left || top);
      region.style.setProperty('position', 'fixed');
      try { actionsHeight = height(actions); }
      finally {
        if (position) region.style.setProperty('position', position, priority);
        else region.style.removeProperty('position');
        // The temporary width/document-height change can clamp native scroll
        // offsets. Restore the real flow geometry before restoring those offsets.
        region.getBoundingClientRect();
        scrollers.forEach(({ element, left, top }) => {
          if (element.scrollLeft !== left || element.scrollTop !== top) element.scrollTo({ left, top, behavior: 'instant' });
        });
        if (window.scrollX !== pageScroll.left || window.scrollY !== pageScroll.top) {
          window.scrollTo({ ...pageScroll, behavior: 'instant' });
        }
      }
    }
    const dockHeight = activeRegion && !dock?.hidden ? height(dock?.querySelector('nav')) : 0;
    // Read the resolved safe area on the region, not env() or a padding that
    // disappears when its contents move into flow.
    const safeBottom = activeRegion ? parseFloat(getComputedStyle(region).getPropertyValue('--chrome-safe-bottom')) || 0 : 0;
    const headerHeight = height(header);
    // Month headings replace one another; only one occupies the pinned row.
    const groups = new Map();
    secondaries.forEach(element => {
      const key = element.dataset.chromeGroup || element;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(element);
    });
    const secondaryGroups = [...groups.values()];
    const visibleHeight = window.visualViewport?.height || window.innerHeight;
    const eligibleHeight = element => window.innerWidth < Number(element.dataset.chromeMinWidth || 0)
      || visibleHeight < Number(element.dataset.chromeMinHeight || 0) ? 0 : height(element);
    const secondaryHeights = secondaryGroups.map(elements => Math.max(...elements.map(eligibleHeight)));
    const layout = resolveAppChrome({ visibleHeight,
      headerHeight, actionsHeight, dockHeight, safeBottom, secondaryHeights });
    attribute(region, 'data-actions-in-flow', !layout.actionsPinned);
    attribute(region, 'data-dock-in-flow', !layout.dockPinned);
    attribute(region, 'data-has-fixed', layout.actionsPinned || layout.dockPinned);
    set(header, 'position', layout.headerPinned ? 'sticky' : 'relative');
    const pinnedHeader = layout.headerPinned ? headerHeight : 0;
    set(page, '--sticky-header-height', `${pinnedHeader}px`);
    set(root, '--pinned-header-height', `${pinnedHeader}px`);
    let topHeight = pinnedHeader;
    let floatingHeight = 0;
    let wayfindingHeight = 0;
    secondaries.forEach(element => {
      const index = secondaryGroups.findIndex(elements => elements.includes(element));
      const pinned = layout.secondaryPinned[index] && eligibleHeight(element) > 0;
      attribute(element, 'data-chrome-pinned', pinned);
      const reserved = pinned ? height(element) : 0;
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
    const offset = activeRegion ? Number(region.dataset.keyboardOffset) || 0 : 0;
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
      if (!focused.matches('input, textarea, select, button, a[href]')) return;
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
  const onViewportResize = () => { revealAfterResize = true; schedule(); };
  const mutations = new MutationObserver(schedule);
  mutations.observe(page, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'data-keyboard-offset'] });
  window.addEventListener('resize', onViewportResize);
  window.visualViewport?.addEventListener('resize', onViewportResize);
  page.addEventListener('focusin', onFocus);
  measure();
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
