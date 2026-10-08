import { useLocation } from 'react-router-dom';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useHandsetLayout } from '../hooks/useHandsetLayout';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { InstallApp } from './InstallApp';

const FOOTER_ROUTES = new Set([
  '/', '/journal', '/journal/gallery', '/pricing', '/account', '/design',
  '/governance-critique', '/reset-password', '/verify-email'
]);

export function InstallFooter() {
  const { pathname } = useLocation();
  const isHandset = useHandsetLayout();
  const isDesktop = useHandsetLayout('(min-width: 1024px)');
  const { effectiveTier, loading: subscriptionLoading } = useSubscription();
  const { canPrompt, isIOS, isInstalled, isPrompting, error } = usePwaInstall();
  const pricingOwnsAction = pathname === '/pricing' && !isDesktop
    && !subscriptionLoading && effectiveTier === 'free';

  if (!FOOTER_ROUTES.has(pathname) || (pathname === '/' && isHandset) || pricingOwnsAction) return null;
  const isHidden = isInstalled || (!isIOS && !canPrompt && !isPrompting && !error);
  const contentWidth = pathname === '/account' ? 'max-w-2xl' : pathname === '/pricing' ? 'max-w-6xl' : 'max-w-7xl';
  const contentGutters = pathname === '/'
    ? 'sm:pl-[max(1.25rem,var(--safe-pad-left))] sm:pr-[max(1.25rem,var(--safe-pad-right))] md:pl-[max(1.5rem,var(--safe-pad-left))] md:pr-[max(1.5rem,var(--safe-pad-right))]'
    : pathname.startsWith('/journal')
      ? 'sm:pl-[max(1.5rem,var(--safe-pad-left))] sm:pr-[max(1.5rem,var(--safe-pad-right))]'
      : '';

  // Keep the control mounted so it can restore focus after consuming a prompt.
  return (
    <footer data-pwa-footer hidden={isHidden} className="bg-main pb-[max(1rem,var(--safe-pad-bottom))] pt-4 text-main">
      <div className={`mx-auto flex justify-center pl-[max(1rem,var(--safe-pad-left))] pr-[max(1rem,var(--safe-pad-right))] sm:justify-end ${contentWidth} ${contentGutters}`}>
        <InstallApp />
      </div>
    </footer>
  );
}
