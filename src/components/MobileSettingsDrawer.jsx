import React from 'react';
import { X } from '@phosphor-icons/react';

export function MobileSettingsDrawer({ isOpen, onClose, children }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-main/90 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Drawer */}
            <div
                className="relative w-full bg-surface rounded-t-2xl border-t border-primary/30 shadow-2xl max-h-[85vh] flex flex-col animate-slide-up"
                role="dialog"
                aria-modal="true"
                aria-label="Reading Gear"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-surface/95 border-b border-accent/20 rounded-t-2xl backdrop-blur shrink-0">
                    <h2 className="text-lg font-serif text-accent">Prepare Reading</h2>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-muted hover:text-main active:text-main transition-colors"
                        aria-label="Close settings"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-8 overflow-y-auto overscroll-contain pb-safe-area-bottom">
                    {children}
                </div>
            </div>
        </div>
    );
}
