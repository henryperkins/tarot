import { useRef } from 'react';
import clsx from 'clsx';
import { X } from '@phosphor-icons/react';
import { useModalA11y } from '../hooks/useModalA11y';
import FollowUpChat from './FollowUpChat';
import { MOBILE_FOLLOWUP_DIALOG_ID } from './MobileActionBar';

export default function FollowUpDrawer({ isOpen, onClose }) {
  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const titleId = 'follow-up-drawer-title';

  useModalA11y(isOpen, {
    onClose,
    containerRef: drawerRef,
    initialFocusRef: closeButtonRef,
    scrollLockStrategy: 'simple'
  });

  const overlayClasses = clsx(
    'mobile-drawer-overlay absolute inset-0 animate-fade-in transition-opacity duration-200',
    isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
  );
  const drawerClasses = clsx(
    'mobile-drawer relative w-full flex flex-col animate-slide-up transition duration-200',
    isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-6 pointer-events-none'
  );

  return (
    <div
      className={clsx(
        'fixed inset-0 z-[80] flex items-end justify-center transition-opacity duration-200',
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
      style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 16px))' }}
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
        <div className="mobile-drawer__body p-4 space-y-4 overflow-y-auto overscroll-contain">
          <FollowUpChat
            variant="drawer"
            isActive={isOpen}
            showHeader={false}
          />
        </div>
      </div>
    </div>
  );
}
