import { useRef, useSyncExternalStore } from 'react';
import clsx from 'clsx';
import { X } from '@phosphor-icons/react';
import { useModalA11y } from '../hooks/useModalA11y';
import { useAndroidBackGuard } from '../hooks/useAndroidBackGuard';
import FollowUpChat from './FollowUpChat';
import { MOBILE_FOLLOWUP_DIALOG_ID } from './MobileActionBar';

const KEYBOARD_OFFSET_THRESHOLD = 50;

// Subscribe to visualViewport changes for keyboard-aware padding
function subscribeToViewport(callback) {
  if (typeof window === 'undefined' || !window.visualViewport) {
    return () => {};
  }
  window.visualViewport.addEventListener('resize', callback);
  window.visualViewport.addEventListener('scroll', callback);
  return () => {
    window.visualViewport.removeEventListener('resize', callback);
    window.visualViewport.removeEventListener('scroll', callback);
  };
}

function getViewportOffset() {
  if (typeof window === 'undefined' || !window.visualViewport) {
    return 0;
  }
  const offsetTop = window.visualViewport.offsetTop || 0;
  const offset = window.innerHeight - window.visualViewport.height - offsetTop;
  return offset > KEYBOARD_OFFSET_THRESHOLD ? offset : 0;
}

function getServerViewportOffset() {
  return 0;
}

export default function FollowUpDrawer({ isOpen, onClose, autoFocusInput = true }) {
  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const titleId = 'follow-up-drawer-title';
  const viewportOffset = useSyncExternalStore(
    subscribeToViewport,
    getViewportOffset,
    getServerViewportOffset
  );
  const effectiveOffset = Math.max(0, viewportOffset);
  const wrapperStyle = {
    paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
    paddingBottom: effectiveOffset ? `${effectiveOffset}px` : undefined
  };
  const bodyStyle = {
    paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))'
  };

  useModalA11y(isOpen, {
    onClose,
    containerRef: drawerRef,
    initialFocusRef: closeButtonRef,
    scrollLockStrategy: 'simple'
  });

  // Android back button dismisses drawer (mobile-only component, always enabled)
  useAndroidBackGuard(isOpen, {
    onBack: onClose,
    enabled: true,
    guardId: 'followUpDrawer'
  });

  const overlayClasses = clsx(
    'mobile-drawer-overlay absolute inset-0 animate-fade-in transition-opacity duration-200',
    isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
  );
  const drawerClasses = clsx(
    'mobile-drawer relative w-full flex flex-col min-h-0 animate-slide-up transition duration-200',
    isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-6 pointer-events-none'
  );

  return (
    <div
      className={clsx(
        'fixed inset-0 z-[80] flex items-end justify-center transition-opacity duration-200',
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
      style={wrapperStyle}
      aria-hidden={!isOpen}
    >
      <div
        className={overlayClasses}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={drawerRef}
        id={MOBILE_FOLLOWUP_DIALOG_ID}
        className={drawerClasses}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        style={{ maxHeight: 'calc(100% - 8px)' }}
        inert={!isOpen ? '' : undefined}
      >
        <div className="mobile-drawer__handle" aria-hidden="true" />
        <div className="mobile-drawer__header px-4 pt-3 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted">Follow-up</p>
              <h2 id={titleId} className="text-lg font-serif text-accent">Follow-up chat</h2>
              <p className="text-xs text-muted max-w-[22rem]">
                Ask deeper questions and stay anchored to this spread.
              </p>
            </div>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="mobile-drawer__close"
              aria-label="Close follow-up chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="mobile-drawer__body p-4 flex flex-col min-h-0" style={bodyStyle}>
          <FollowUpChat
            variant="drawer"
            isActive={isOpen}
            showHeader={false}
            autoFocusInput={autoFocusInput}
            className="flex-1 min-h-0"
          />
        </div>
      </div>
    </div>
  );
}
