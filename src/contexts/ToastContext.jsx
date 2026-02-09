/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Info, WarningCircle, X, XCircle } from '@phosphor-icons/react';
import { animate, set, spring } from '../lib/motionAdapter';
import { useReducedMotion } from '../hooks/useReducedMotion';

const ToastContext = createContext(null);

const DEFAULT_DURATION = {
  success: 3200,
  info: 3600,
  warning: 4800,
  error: 5200
};

const ICONS = {
  success: CheckCircle,
  info: Info,
  warning: WarningCircle,
  error: XCircle
};

const VARIANTS = {
  success: {
    container: 'border-success/40 bg-success/10 text-success shadow-success/20',
    icon: 'text-success',
    description: 'text-success/90'
  },
  info: {
    container: 'border-secondary/30 bg-secondary/10 text-secondary shadow-secondary/20',
    icon: 'text-secondary',
    description: 'text-secondary/80'
  },
  warning: {
    container: 'border-warning/40 bg-warning/10 text-warning shadow-warning/30',
    icon: 'text-warning',
    description: 'text-warning/90'
  },
  error: {
    container: 'border-error/40 bg-error/10 text-error shadow-error/30',
    icon: 'text-error',
    description: 'text-error/90'
  }
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const toastRefs = useRef(new Map());
  const positionsRef = useRef(new Map());

  const recordPositions = useCallback(() => {
    const positions = new Map();
    toastRefs.current.forEach((node, id) => {
      if (!node) return;
      positions.set(id, node.getBoundingClientRect());
    });
    positionsRef.current = positions;
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.map((toast) => {
      if (toast.id !== id) return toast;
      if (toast.isLeaving) return toast;
      return { ...toast, isLeaving: true };
    }));
    const timeoutId = timersRef.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timersRef.current.delete(id);
    }
  }, []);

  const removeToast = useCallback((id) => {
    recordPositions();
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timeoutId = timersRef.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timersRef.current.delete(id);
    }
  }, [recordPositions]);

  const publish = useCallback((toast = {}) => {
    const { title, description, type = 'info', duration } = toast;
    if (!title && !description) {
      return null;
    }
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ttl = typeof duration === 'number' ? duration : DEFAULT_DURATION[type] || 3600;
    setToasts((prev) => [...prev, { id, title, description, type, isLeaving: false }]);
    if (ttl !== Infinity) {
      const timeoutId = setTimeout(() => dismiss(id), ttl);
      timersRef.current.set(id, timeoutId);
    }
    return id;
  }, [dismiss]);

  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current.clear();
  }, []);

  const contextValue = useMemo(() => ({ publish, dismiss }), [publish, dismiss]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastViewport
        toasts={toasts}
        onDismiss={dismiss}
        onRemove={removeToast}
        toastRefs={toastRefs}
        positionsRef={positionsRef}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

function ToastViewport({ toasts, onDismiss, onRemove, toastRefs, positionsRef }) {
  const prefersReducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    if (prefersReducedMotion) {
      positionsRef.current = new Map();
      return undefined;
    }

    const prevPositions = positionsRef.current;
    if (!prevPositions || prevPositions.size === 0) return undefined;

    const animations = [];
    toastRefs.current.forEach((node, id) => {
      if (!node) return;
      const prev = prevPositions.get(id);
      if (!prev) return;
      const next = node.getBoundingClientRect();
      const deltaX = prev.left - next.left;
      const deltaY = prev.top - next.top;
      if (!deltaX && !deltaY) return;
      set(node, { translateX: deltaX, translateY: deltaY });
      animations.push(animate(node, {
        translateX: 0,
        translateY: 0,
        duration: 260,
        ease: 'outQuad'
      }));
    });
    positionsRef.current = new Map();

    return () => {
      animations.forEach(anim => anim?.pause?.());
    };
  }, [toasts, prefersReducedMotion, positionsRef, toastRefs]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[1200] flex flex-col items-center gap-3 px-4 sm:top-6 sm:items-end sm:px-6">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          onRemove={onRemove}
          toastRefs={toastRefs}
        />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss, onRemove, toastRefs }) {
  const Icon = ICONS[toast.type] || Info;
  const variant = VARIANTS[toast.type] || VARIANTS.info;
  const role = toast.type === 'error' ? 'alert' : 'status';
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef(null);
  const iconRef = useRef(null);
  const hasRemovedRef = useRef(false);
  const springEase = useMemo(() => spring({ stiffness: 350, damping: 25, mass: 1 }), []);

  const toastId = toast.id;
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- ref access pattern is intentional
  const setContainerRef = useCallback((node) => {
    containerRef.current = node;
    if (node) {
      toastRefs.current.set(toastId, node);
    } else {
      toastRefs.current.delete(toastId);
    }
  }, [toastId, toastRefs]);

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    if (prefersReducedMotion) {
      set(node, { opacity: 1, translateY: 0, translateX: 0, scale: 1 });
      if (iconRef.current) {
        set(iconRef.current, { opacity: 1, scale: 1 });
      }
      return undefined;
    }

    set(node, { opacity: 0, translateY: -20, scale: 0.95 });
    const enterAnim = animate(node, {
      opacity: [0, 1],
      translateY: [-20, 0],
      scale: [0.95, 1],
      duration: 260,
      ease: springEase
    });

    if (iconRef.current) {
      set(iconRef.current, { opacity: 0, scale: 0 });
      animate(iconRef.current, {
        opacity: [0, 1],
        scale: [0, 1],
        duration: 200,
        delay: 80,
        ease: springEase
      });
    }

    return () => enterAnim?.pause?.();
  }, [prefersReducedMotion, springEase]);

  useEffect(() => {
    if (!toast.isLeaving || hasRemovedRef.current) return undefined;
    if (prefersReducedMotion) {
      hasRemovedRef.current = true;
      onRemove(toast.id);
      return undefined;
    }

    const node = containerRef.current;
    if (!node) {
      hasRemovedRef.current = true;
      onRemove(toast.id);
      return undefined;
    }

    const exitAnim = animate(node, {
      opacity: [1, 0],
      translateX: [0, 100],
      scale: [1, 0.95],
      duration: 220,
      ease: 'inQuad'
    });

    exitAnim
      .then(() => {
        if (hasRemovedRef.current) return;
        hasRemovedRef.current = true;
        onRemove(toast.id);
      })
      .catch(() => {
        if (hasRemovedRef.current) return;
        hasRemovedRef.current = true;
        onRemove(toast.id);
      });

    return () => exitAnim?.pause?.();
  }, [toast.isLeaving, prefersReducedMotion, onRemove, toast.id]);

  return (
    <div
      ref={setContainerRef}
      role={role}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      className={`pointer-events-auto w-full max-w-sm rounded-2xl border px-4 py-3 text-sm shadow-xl backdrop-blur ${variant.container}`}
    >
      <div className="flex items-start gap-3">
        <div ref={iconRef}>
          <Icon className={`h-5 w-5 flex-shrink-0 ${variant.icon}`} aria-hidden="true" />
        </div>
        <div className="flex-1 space-y-1">
          {toast.title && <p className="font-semibold leading-tight">{toast.title}</p>}
          {toast.description && <p className={`text-sm leading-snug ${variant.description}`}>{toast.description}</p>}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="rounded-full p-1 text-sm text-white/70 transition-all duration-200 hover:scale-110 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" weight="bold" />
        </button>
      </div>
    </div>
  );
}
