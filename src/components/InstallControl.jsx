/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, useLayoutEffect, useState } from 'react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { pwaInstallStore, shouldShowPwaInstall } from '../lib/pwaInstall';

export { shouldShowPwaInstall } from '../lib/pwaInstall';

const LazyInstallApp = lazy(() => import('./InstallApp').then(module => ({ default: module.InstallApp })));

export function InstallControl(props) {
  const install = usePwaInstall();
  const visible = shouldShowPwaInstall(install);
  const [hasActivated, setHasActivated] = useState(visible);
  const canHost = !install.isInstalled && (!install.isIOS || (!install.isSnoozed && !install.hasAddedToHomeScreen));

  // Claim browser offers only while a page can present its own control. Register
  // before eligibility arrives; pages without a host retain the native offer.
  useLayoutEffect(() => {
    if (!canHost) return undefined;
    return pwaInstallStore.registerHost();
  }, [canHost]);

  // Keep the loaded control mounted after its native offer is consumed so it
  // can restore focus. A local Suspense boundary leaves the route untouched.
  if (visible && !hasActivated) setHasActivated(true);

  return (
    <div hidden={!visible} className="max-w-full">
      <Suspense fallback={null}>
        {hasActivated && <LazyInstallApp {...props} />}
      </Suspense>
    </div>
  );
}
