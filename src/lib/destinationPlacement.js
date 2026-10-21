const reveal = element => {
  if (!element) return;
  element.hidden = false;
  element.removeAttribute('inert');
};
const conceal = element => {
  if (!element) return;
  element.hidden = true;
  element.setAttribute('inert', '');
};

/** Reveal and focus the equivalent before hiding its old placement. Both
 * placements remain mounted so a breakpoint never drops focus onto body. */
export function syncDestinationPlacement(page, handset, keyboardOpen) {
  const header = page.querySelector('[data-destination-group="header"]');
  const dock = page.querySelector('[data-destination-group="dock"]');
  const region = page.querySelector('[data-app-bottom-region]');
  const desktopActions = page.querySelector('[data-app-desktop-actions]');
  const active = document.activeElement;
  const oldGroup = active?.closest('[data-destination-group]');
  const oldActions = active?.closest('[data-app-bottom-actions], [data-app-desktop-actions]');
  const visibleGroup = handset ? (keyboardOpen ? null : dock) : header;
  const visibleActions = handset ? region?.querySelector('[data-app-bottom-actions]') : desktopActions;
  if (region && handset) region.hidden = false;
  reveal(visibleGroup);
  if (!handset) reveal(desktopActions);
  const focusCanvas = () => {
    const heading = page.querySelector('main h1, main h2') || page.querySelector('#main-content');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: heading.matches('main') ? 'start' : 'nearest', behavior: 'instant' });
    }
  };
  if (oldGroup && page.contains(oldGroup) && oldGroup !== visibleGroup) {
    const path = active.getAttribute('data-destination-link');
    const equivalent = [...(visibleGroup?.querySelectorAll('a') || [])].find(link => link.getAttribute('data-destination-link') === path);
    if (equivalent) equivalent.focus({ preventScroll: true });
    else focusCanvas();
  }
  if (oldActions && page.contains(oldActions) && oldActions !== visibleActions) {
    const key = active.getAttribute('data-chrome-action');
    const equivalent = key && [...(visibleActions?.querySelectorAll('[data-chrome-action]') || [])]
      .find(control => control.getAttribute('data-chrome-action') === key);
    if (equivalent) {
      equivalent.focus({ preventScroll: true });
      equivalent.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    } else focusCanvas();
  }
  if (header !== visibleGroup) conceal(header);
  if (dock !== visibleGroup) conceal(dock);
  if (handset) conceal(desktopActions);
  if (region && !handset) region.hidden = true;
}
