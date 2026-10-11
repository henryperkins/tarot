import { createContext, useContext } from 'react';

// One context identity is shared by ordinary Markdown, the lazy runtime and
// direct fixture providers. Importing the hooks never imports gesture logic.
export const FocusStateContext = createContext(null);
export const FocusApiContext = createContext(null);
export function useNarrativeCardFocus() { return useContext(FocusStateContext); }
export function useNarrativeCardFocusApi() { return useContext(FocusApiContext); }
