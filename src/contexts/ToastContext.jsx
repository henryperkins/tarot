/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Info, WarningCircle, X, XCircle } from '@phosphor-icons/react';

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
    container: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-50 shadow-emerald-500/20',
    icon: 'text-emerald-300',
    description: 'text-emerald-50/90'
  },
  info: {
    container: 'border-secondary/30 bg-secondary/10 text-secondary shadow-secondary/20',
    icon: 'text-secondary',
    description: 'text-secondary/80'
  },
  warning: {
    container: 'border-amber-400/40 bg-amber-500/10 text-amber-50 shadow-amber-500/30',
    icon: 'text-amber-300',
    description: 'text-amber-50/90'
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

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timeoutId = timersRef.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timersRef.current.delete(id);
    }
  }, []);

  const publish = useCallback((toast = {}) => {
    const { title, description, type = 'info', duration } = toast;
    if (!title && !description) {
      return null;
    }
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ttl = typeof duration === 'number' ? duration : DEFAULT_DURATION[type] || 3600;
    setToasts((prev) => [...prev, { id, title, description, type }]);
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
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
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

function ToastViewport({ toasts, onDismiss }) {
  if (!toasts.length) {
    return null;
  }
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[1200] flex flex-col items-center gap-3 px-4 sm:top-6 sm:items-end sm:px-6">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const Icon = ICONS[toast.type] || Info;
  const variant = VARIANTS[toast.type] || VARIANTS.info;
  const role = toast.type === 'error' ? 'alert' : 'status';

  return (
    <div
      role={role}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      className={`pointer-events-auto w-full max-w-sm rounded-2xl border px-4 py-3 text-sm shadow-xl backdrop-blur ${variant.container}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 flex-shrink-0 ${variant.icon}`} aria-hidden="true" />
        <div className="flex-1 space-y-1">
          {toast.title && <p className="font-semibold leading-tight">{toast.title}</p>}
          {toast.description && <p className={`text-sm leading-snug ${variant.description}`}>{toast.description}</p>}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="rounded-full p-1 text-sm text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" weight="bold" />
        </button>
      </div>
    </div>
  );
}
