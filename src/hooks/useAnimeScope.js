import { useEffect, useRef } from 'react';
import { createScope } from 'animejs';

export function useAnimeScope() {
  const rootRef = useRef(null);
  const scopeRef = useRef(null);

  useEffect(() => {
    if (!rootRef.current) return undefined;
    scopeRef.current = createScope({ root: rootRef.current });
    return () => scopeRef.current?.revert();
  }, []);

  return [rootRef, scopeRef];
}
