import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { User } from '@phosphor-icons/react';
import { useAndroidBackGuard } from '../hooks/useAndroidBackGuard';

/** A non-modal disclosure keeps guest actions available without crowding the header. */
export function GuestAccountMenu({ children }) {
  const [open, setOpen] = useState(false);
  const detailsRef = useRef(null);
  const summaryRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();

  const close = useCallback((restoreFocus = true) => {
    if (!detailsRef.current?.open) return;
    detailsRef.current.open = false;
    setOpen(false);
    // Auth and tutorial dialogs need a stable opener after this panel closes.
    if (restoreFocus) summaryRef.current?.focus({ preventScroll: true });
  }, []);

  useAndroidBackGuard(open, { onBack: close, guardId: 'guest-account-options' });

  useEffect(() => {
    if (!open) return undefined;
    const dismissOutside = event => {
      if (!detailsRef.current?.contains(event.target)) close(false);
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('focusin', dismissOutside);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('focusin', dismissOutside);
    };
  }, [open, close]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const panel = panelRef.current;
    const summary = summaryRef.current;
    const navigation = summary?.closest('.site-nav');
    const dock = document.querySelector('.mobile-action-bar');
    if (!panel || !summary) return undefined;

    const position = () => {
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft || 0;
      const viewportRight = viewportLeft + (viewport?.width || window.innerWidth);
      const viewportTop = viewport?.offsetTop || 0;
      const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
      const anchor = summary.getBoundingClientRect();
      const navigationBox = navigation?.getBoundingClientRect();
      const left = Math.max(viewportLeft + 8, navigationBox?.left ?? viewportLeft + 8);
      const right = Math.min(viewportRight - 8, navigationBox?.right ?? viewportRight - 8);
      // App options can sit to the right of Account; the account anchor alone
      // does not guarantee that a right-aligned panel fits a narrow viewport.
      panel.style.setProperty('--account-panel-width', Math.max(44, right - left) + 'px');
      const panelRight = Math.min(right, Math.max(anchor.right, left + panel.getBoundingClientRect().width));
      panel.style.setProperty('--account-panel-right', (anchor.right - panelRight) + 'px');
      const dockBox = dock?.getBoundingClientRect();
      const bottom = dockBox?.height ? Math.min(viewportBottom, dockBox.top) : viewportBottom;
      const anchorBottom = anchor.bottom;
      const top = Math.max(viewportTop + 8, Math.min(anchorBottom + 4, bottom - panel.scrollHeight - 8));
      panel.style.setProperty('--account-panel-offset', (top - anchorBottom) + 'px');
      panel.style.setProperty('--account-panel-height', Math.max(44, bottom - top - 8) + 'px');
    };
    const observer = new ResizeObserver(position);
    observer.observe(panel);
    observer.observe(summary);
    if (navigation) observer.observe(navigation);
    if (dock) observer.observe(dock);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, { passive: true });
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    position();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
    };
  }, [open]);

  return (
    <details
      ref={detailsRef}
      className="guest-account"
      onToggle={event => setOpen(event.currentTarget.open)}
      onKeyDown={event => {
        if (event.key !== 'Escape' || !detailsRef.current?.open) return;
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
    >
      <summary ref={summaryRef} className="guest-account__trigger" aria-label="Account options" aria-controls={panelId}>
        <User size={18} aria-hidden="true" />
        <span aria-hidden="true">Account</span>
      </summary>
      <div ref={panelRef} id={panelId} className="guest-account__panel" role="group" aria-label="Account options">
        {children(close)}
      </div>
    </details>
  );
}
