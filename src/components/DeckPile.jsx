import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { animate, spring } from '../lib/motionAdapter';
import { TableuLogo } from './TableuLogo';
import { BookOpen } from '@phosphor-icons/react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { MICROCOPY } from '../lib/microcopy';

/**
 * Hook to compute responsive logo size with SSR safety, debounced resize handling
 * @param {number} baseSize - Maximum size in pixels
 * @param {number} factor - Viewport width multiplier
 * @param {number} debounceMs - Debounce delay in milliseconds
 */
function useDynamicLogoSize(baseSize = 120, factor = 0.15, debounceMs = 100) {
    const [size, setSize] = useState(baseSize);
    const timeoutRef = useRef(null);

    useEffect(() => {
        function updateSize() {
            setSize(Math.min(window.innerWidth * factor, baseSize));
        }

        function handleResize() {
            // Debounce resize events
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(updateSize, debounceMs);
        }

        // Initial size calculation
        updateSize();

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [baseSize, factor, debounceMs]);

    return size;
}

export function DeckPile({ cardsRemaining, onDraw, isShuffling, nextLabel, isComplete = false, onViewReading }) {
    const rasterLogoSize = useDynamicLogoSize(120, 0.15);
    const shouldReduceMotion = useReducedMotion();
    const scopeRootRef = useRef(null);
    const buttonRef = useRef(null);
    const isHoveringRef = useRef(false);
    const activeAnimRef = useRef(null);
    const springEase = useMemo(() => spring({ stiffness: 400, damping: 25, mass: 1 }), []);

    // Merge refs for button to get both direct access and animation scope
    const setButtonRefs = useCallback((node) => {
        buttonRef.current = node;
        scopeRootRef.current = node;
    }, [scopeRootRef]);

    const runAnimation = useCallback((props, options = {}) => {
        if (shouldReduceMotion || !buttonRef.current) return;
        if (activeAnimRef.current?.pause) {
            activeAnimRef.current.pause();
        }
        activeAnimRef.current = animate(buttonRef.current, {
            ...props,
            ease: options.ease || springEase,
            duration: options.duration || 300
        });
    }, [shouldReduceMotion, springEase]);

    const handlePointerEnter = useCallback(() => {
        if (isShuffling) return;
        isHoveringRef.current = true;
        runAnimation({ scale: 1.05, translateY: -5 }, { duration: 320 });
    }, [isShuffling, runAnimation]);

    const handlePointerLeave = useCallback(() => {
        if (isShuffling) return;
        isHoveringRef.current = false;
        runAnimation({ scale: 1, translateY: 0 }, { duration: 260 });
    }, [isShuffling, runAnimation]);

    const handlePointerDown = useCallback(() => {
        if (isShuffling) return;
        runAnimation({ scale: 0.97 }, { duration: 120, ease: 'outQuad' });
    }, [isShuffling, runAnimation]);

    const handlePointerUp = useCallback(() => {
        if (isShuffling) return;
        if (isHoveringRef.current) {
            runAnimation({ scale: 1.05, translateY: -5 }, { duration: 180 });
        } else {
            runAnimation({ scale: 1, translateY: 0 }, { duration: 180 });
        }
    }, [isShuffling, runAnimation]);

    // Cleanup active animation on unmount
    useEffect(() => {
        return () => {
            if (activeAnimRef.current?.pause) {
                activeAnimRef.current.pause();
                activeAnimRef.current = null;
            }
        };
    }, []);

    // Show "View Complete Reading" button when all cards dealt/revealed
    if (isComplete && onViewReading) {
        return (
            <div className="flex flex-col items-center justify-center py-6 sm:py-8 animate-fade-in relative z-20">
                <button
                    onClick={onViewReading}
                    className="group flex items-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-br from-secondary/90 to-secondary/70 border-2 border-secondary/60 shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50 focus-visible:ring-offset-2"
                    aria-label={MICROCOPY.viewCompleteReading}
                >
                    <BookOpen className="w-6 h-6 text-main" weight="duotone" />
                    <span className="text-main font-semibold text-base">
                        {MICROCOPY.viewCompleteReading}
                    </span>
                </button>
                <p className="text-secondary/70 text-xs mt-3 font-medium">
                    {MICROCOPY.allCardsRevealed}
                </p>
            </div>
        );
    }

    if (cardsRemaining <= 0) return null;

    return (
        <div className="flex flex-col items-center justify-center py-6 sm:py-8 animate-fade-in relative z-20">
            <button
                ref={setButtonRefs}
                onClick={onDraw}
                disabled={isShuffling}
                onPointerEnter={handlePointerEnter}
                onPointerLeave={handlePointerLeave}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerLeave}
                className="group relative w-[clamp(9rem,45vw,10rem)] h-[clamp(13.5rem,67.5vw,15rem)] sm:w-32 sm:h-48 md:w-40 md:h-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded-2xl touch-manipulation"
                aria-label={nextLabel ? `Draw card for ${nextLabel}` : "Draw next card"}
            >
                {/* Stack effect layers - decorative, hidden when user prefers reduced motion */}
                {!shouldReduceMotion && (
                    <>
                        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-surface-muted/60 rounded-2xl border border-primary/40 transform translate-x-2 translate-y-2 rotate-3 opacity-60" />
                        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-surface-muted/70 rounded-2xl border border-primary/40 transform -translate-x-1 translate-y-1 -rotate-2 opacity-80" />
                    </>
                )}

                {/* Top Card with Tableu Logo */}
                <div className="absolute inset-0 bg-gradient-to-br from-surface/95 via-surface-muted/90 to-surface/95 rounded-2xl border-2 border-primary/30 shadow-2xl overflow-hidden">
                    {/* Subtle pattern overlay */}
                    <div className="absolute inset-0 opacity-10" style={{
                        backgroundImage: 'radial-gradient(circle at 50% 50%, var(--brand-secondary) 1px, transparent 1px)',
                        backgroundSize: '16px 16px'
                    }} />

                    {/* Tableu Logo */}
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                        <TableuLogo
                            variant="icon"
                            size={rasterLogoSize}
                            className="opacity-90 group-hover:opacity-100 transition-opacity duration-300"
                            outline
                            glow
                            useRaster
                            ariaLabel="Tableu deck - tap to draw"
                        />
                    </div>
                </div>

                <div className="absolute -bottom-10 left-0 right-0 text-center">
                    <span className="inline-block px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-accent/90 text-xs font-semibold tracking-widest uppercase backdrop-blur-sm group-hover:bg-primary/20 transition-colors">
                        {nextLabel ? `Draw: ${nextLabel}` : 'Tap to Draw'}
                    </span>
                    <p className="text-primary/40 text-xs mt-2 font-medium">
                        {cardsRemaining} card{cardsRemaining !== 1 ? 's' : ''} remaining
                    </p>
                </div>
            </button>
        </div>
    );
}
