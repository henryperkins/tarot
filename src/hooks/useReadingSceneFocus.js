import { useEffect } from 'react';

function isAvailable(element) {
  return element?.isConnected && element !== document.body && element !== document.documentElement
    && !element.matches(':disabled') && !element.closest('[hidden], [inert], [aria-hidden="true"]')
    && element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible';
}

// A scene may commit while a closing overlay still makes its content inert.
// Wait for usable DOM, while giving any focus the reader chooses precedence.
export function useReadingSceneFocus(sectionRef, scene, isError) {
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    let pending = true;
    let observer;

    const stop = () => {
      pending = false;
      observer?.disconnect();
      document.removeEventListener('focusin', restore);
      document.removeEventListener('visibilitychange', restore);
      window.removeEventListener('focus', restore);
      window.removeEventListener('resize', restore);
    };
    function restore() {
      if (!pending) return;
      if (isAvailable(document.activeElement)) {
        stop();
        return;
      }
      const target = section.querySelector('[data-reading-focus-target]');
      if (!isAvailable(target)) return;
      target.focus({ preventScroll: !target.hasAttribute('data-reading-focus-scroll') });
      if (document.activeElement !== target) return;
      if (isError) target.scrollIntoView({ block: 'nearest' });
      stop();
    }

    restore();
    if (pending) {
      observer = new MutationObserver(restore);
      const attributes = ['inert', 'hidden', 'aria-hidden', 'disabled', 'class', 'style'];
      observer.observe(section, { childList: true, subtree: true, attributes: true, attributeFilter: attributes });
      // Modal isolation can be applied to an ancestor of the reading region.
      for (let parent = section.parentElement; parent; parent = parent.parentElement) {
        observer.observe(parent, { attributes: true, attributeFilter: attributes });
      }
      document.addEventListener('focusin', restore);
      document.addEventListener('visibilitychange', restore);
      window.addEventListener('focus', restore);
      window.addEventListener('resize', restore);
    }
    return stop;
  }, [sectionRef, scene, isError]);
}
