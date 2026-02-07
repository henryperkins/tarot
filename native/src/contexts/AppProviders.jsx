import { PreferencesProvider } from './PreferencesContext';
import { ReadingProvider } from './ReadingContext';
import { SubscriptionProvider } from './SubscriptionContext';

export function AppProviders({ children }) {
  return (
    <PreferencesProvider>
      <SubscriptionProvider>
        <ReadingProvider>{children}</ReadingProvider>
      </SubscriptionProvider>
    </PreferencesProvider>
  );
}
