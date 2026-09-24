import { useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { useModalA11y, createBackdropHandler } from '../hooks/useModalA11y';
import { useAndroidBackGuard } from '../hooks/useAndroidBackGuard';
import { useVisibleViewport } from '../hooks/useKeyboardOffset';
import FollowUpChat from './FollowUpChat';
import { MOBILE_FOLLOWUP_DIALOG_ID } from './mobileActionBarConstants';
import '../styles/follow-up.css';

// This one mounted shell changes presentation without replacing its chat child.
export default function FollowUpModal({
  isOpen, onClose, isVisible = true, isHandset = false, autoFocusInput = true, returnFocusRef
}) {
  const modalRef = useRef(null);
  const active = Boolean(isOpen && isVisible);
  const viewport = useVisibleViewport(active);
  const titleId = 'follow-up-chat-title';

  useModalA11y(active, {
    onClose,
    containerRef: modalRef,
    returnFocusRef,
    scrollLockStrategy: 'simple',
    isolateBackground: true,
    initialFocusSelector: autoFocusInput
      ? 'textarea:not(:disabled)' : '[aria-label="Close follow-up chat"]',
    fallbackFocusSelector: '#personalized-narrative-title'
  });
  useAndroidBackGuard(active, {
    onBack: onClose,
    enabled: isHandset,
    guardId: 'followUpDrawer'
  });

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={clsx('follow-up-overlay', isHandset && 'follow-up-overlay--handset')}
      style={viewport ? {
        '--follow-up-viewport-height': `${viewport.height}px`,
        '--follow-up-viewport-top': `${viewport.offsetTop}px`
      } : undefined}
      hidden={!active}
      inert={!active}
      aria-hidden={!active}
      onClick={createBackdropHandler(onClose)}
    >
      <div className="follow-up-backdrop" aria-hidden="true" onClick={onClose} />
      <div
        ref={modalRef}
        id={MOBILE_FOLLOWUP_DIALOG_ID}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="follow-up-dialog"
        onClick={event => event.stopPropagation()}
        tabIndex={-1}
        inert={!active}
      >
        <FollowUpChat
          variant={isHandset ? 'drawer' : 'modal'}
          isActive={active}
          onClose={onClose}
          titleId={titleId}
        />
      </div>
    </div>,
    document.body
  );
}
