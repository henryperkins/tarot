import { PreferencesProvider } from './PreferencesContext';
import { ReadingProvider } from './ReadingContext';

export function AppProviders({ children }) {
  return (
    <PreferencesProvider>
      <ReadingProvider>{children}</ReadingProvider>
    </PreferencesProvider>
  );
}
