import { useLayoutEffect, useRef } from 'react';
import { DestinationNav } from './DestinationNav';
import { useHandsetLayout } from '../hooks/useHandsetLayout';
import { useKeyboardOffset } from '../hooks/useKeyboardOffset';
import { syncDestinationPlacement } from '../lib/destinationPlacement';

/** One stable DOM region owns handset actions, safe area and keyboard offset.
 * useResponsiveSticky publishes --app-bottom-height from these declared boxes.
 * Moving actions into flow never remounts their handlers or local state. */
export function AppBottomRegion({ destinations = true, children = null, overlayActive = false }) {
  const isHandset = useHandsetLayout();
  const keyboardOffset = useKeyboardOffset();
  const regionRef = useRef(null);
  useLayoutEffect(() => {
    const page = regionRef.current?.closest('[data-app-chrome]');
    if (page) syncDestinationPlacement(page, isHandset, keyboardOffset > 0);
  }, [isHandset, keyboardOffset, destinations]);
  if (!destinations && !children) return null;
  return (
    <div
      ref={regionRef}
      className="app-bottom-region"
      data-app-bottom-region
      data-destinations={String(destinations)}
      data-keyboard-offset={keyboardOffset}
      style={{ '--app-keyboard-offset': `${keyboardOffset}px` }}
      hidden
      inert={overlayActive || undefined}
    >
      {children && <div className="app-bottom-actions" data-app-bottom-actions>{children}</div>}
      {destinations && (
        <div className="destination-group destination-group--dock" data-destination-group="dock" hidden inert>
          <DestinationNav placement="dock" />
        </div>
      )}
      {!destinations && <span hidden data-destination-reservation="0" />}
    </div>
  );
}
