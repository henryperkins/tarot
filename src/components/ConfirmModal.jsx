import { Warning, X } from '@phosphor-icons/react';

/**
 * Confirmation Modal
 * 
 * Replaces native browser confirm() dialogs with a styled modal
 * that matches the application's design system.
 */
export function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning' // 'warning' | 'danger'
}) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const variantStyles = {
    warning: 'border-accent/40 bg-surface/95',
    danger: 'border-error/40 bg-surface/95'
  };

  const buttonStyles = {
    warning: 'bg-accent/15 border-accent/40 text-accent hover:bg-accent/25',
    danger: 'bg-error/15 border-error/40 text-error hover:bg-error/25'
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className={`relative w-full max-w-md mx-4 rounded-2xl border ${variantStyles[variant]} shadow-2xl animate-slide-up`}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-muted hover:text-main transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className={`p-2 rounded-full ${variant === 'danger' ? 'bg-error/10' : 'bg-accent/10'}`}>
              <Warning className={`w-6 h-6 ${variant === 'danger' ? 'text-error' : 'text-accent'}`} />
            </div>
            <div className="flex-1">
              <h2 id="confirm-modal-title" className="text-xl font-serif text-main mb-2">
                {title}
              </h2>
              <p className="text-muted text-sm leading-relaxed">
                {message}
              </p>
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-secondary/40 text-muted hover:text-main hover:border-secondary/60 transition text-sm font-medium"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              className={`px-4 py-2 rounded-lg border ${buttonStyles[variant]} transition text-sm font-medium`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}