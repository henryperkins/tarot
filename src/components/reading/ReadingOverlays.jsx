import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ParticleLayer } from '../ParticleLayer';
import { CardModal } from '../CardModal';
import { useReducedMotion } from '../../hooks/useReducedMotion';

function GhostCard({ startRect, endRect, suit = null, onComplete }) {
  const prefersReducedMotion = useReducedMotion();
  const nodeRef = useRef(null);
  const completedRef = useRef(false);
  const mountedRef = useRef(true);
  const trailFrameRef = useRef(null);
  const trailBurstIdRef = useRef(0);
  const trailTimersRef = useRef([]);
  const [trailBursts, setTrailBursts] = useState([]);
  const durationMs = 350;
  const startX = Number.isFinite(startRect?.left) ? startRect.left : 0;
  const startY = Number.isFinite(startRect?.top) ? startRect.top : 0;
  const endX = Number.isFinite(endRect?.left) ? endRect.left : startX;
  const endY = Number.isFinite(endRect?.top) ? endRect.top : startY;
  const safeStartWidth = Math.max(1, startRect?.width || 0);
  const safeStartHeight = Math.max(1, startRect?.height || 0);
  const endScaleX = Math.max(0.01, (endRect?.width || 0) / safeStartWidth);
  const endScaleY = Math.max(0.01, (endRect?.height || 0) / safeStartHeight);
  const suitKey = typeof suit === 'string' ? suit.toLowerCase() : '';
  const suitClass = suitKey ? `ghost-card--${suitKey}` : '';

  const clearTrailTimers = useCallback(() => {
    trailTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    trailTimersRef.current = [];
  }, []);

  const emitTrailBurst = useCallback((x, y) => {
    if (!mountedRef.current) return;
    trailBurstIdRef.current += 1;
    const burstId = `ghost-${trailBurstIdRef.current}`;
    setTrailBursts((prev) => [...prev, { id: burstId, x, y }]);
    const removeTimer = window.setTimeout(() => {
      setTrailBursts((prev) => prev.filter((burst) => burst.id !== burstId));
      trailTimersRef.current = trailTimersRef.current.filter((timer) => timer !== removeTimer);
    }, prefersReducedMotion ? 220 : 420);
    trailTimersRef.current.push(removeTimer);
  }, [prefersReducedMotion]);

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (!mountedRef.current) return;
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (trailFrameRef.current) {
        window.cancelAnimationFrame(trailFrameRef.current);
        trailFrameRef.current = null;
      }
      clearTrailTimers();
    };
  }, [clearTrailTimers]);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return undefined;

    completedRef.current = false;
    const startTransform = `translate3d(${startX}px, ${startY}px, 0) scale(1, 1)`;
    const endTransform = `translate3d(${endX}px, ${endY}px, 0) scale(${endScaleX}, ${endScaleY})`;
    node.style.transform = startTransform;
    node.style.opacity = '1';

    const failSafeId = window.setTimeout(complete, durationMs + 200);
    let fallbackId = null;
    let animation = null;

    if (!prefersReducedMotion) {
      const startedAt = performance.now();
      let lastEmitMs = -Infinity;
      emitTrailBurst(startX, startY);
      const step = (now) => {
        if (completedRef.current || !mountedRef.current) return;
        const elapsed = now - startedAt;
        const progress = Math.min(1, Math.max(0, elapsed / durationMs));
        if (elapsed - lastEmitMs >= 100 || progress >= 1) {
          lastEmitMs = elapsed;
          const nextX = startX + ((endX - startX) * progress);
          const nextY = startY + ((endY - startY) * progress);
          emitTrailBurst(nextX, nextY);
        }
        if (progress < 1) {
          trailFrameRef.current = window.requestAnimationFrame(step);
        }
      };
      trailFrameRef.current = window.requestAnimationFrame(step);
    }

    if (typeof node.animate === 'function') {
      animation = node.animate(
        [
          { transform: startTransform, opacity: 1, offset: 0 },
          { transform: startTransform, opacity: 1, offset: 0.68 },
          { transform: endTransform, opacity: 0, offset: 1 }
        ],
        {
          duration: durationMs,
          easing: 'cubic-bezier(0.2, 0.85, 0.3, 1)',
          fill: 'forwards'
        }
      );
      animation.onfinish = () => complete();
      animation.oncancel = () => complete();
    } else {
      fallbackId = window.setTimeout(complete, durationMs);
    }

    return () => {
      window.clearTimeout(failSafeId);
      if (fallbackId) {
        window.clearTimeout(fallbackId);
      }
      if (trailFrameRef.current) {
        window.cancelAnimationFrame(trailFrameRef.current);
        trailFrameRef.current = null;
      }
      clearTrailTimers();
      animation?.cancel();
    };
  }, [clearTrailTimers, complete, durationMs, emitTrailBurst, endScaleX, endScaleY, endX, endY, prefersReducedMotion, startX, startY]);

  return createPortal(
    <>
      <div
        ref={nodeRef}
        className={`ghost-card fixed left-0 top-0 pointer-events-none z-[200] ${suitClass}`}
        style={{
          width: safeStartWidth,
          height: safeStartHeight,
          transformOrigin: '0 0',
          transform: 'translate3d(0, 0, 0)',
          willChange: 'transform, opacity',
          contain: 'layout paint style',
          backfaceVisibility: 'hidden'
        }}
      >
        <div
          className="w-full h-full rounded-xl border-2 border-primary/40 overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, var(--bg-surface), var(--bg-surface-muted))',
            boxShadow: '0 12px 22px rgba(0, 0, 0, 0.35)'
          }}
        >
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'radial-gradient(circle at 50% 50%, var(--brand-secondary) 1px, transparent 1px)',
              backgroundSize: '12px 12px'
            }}
          />
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: 'radial-gradient(circle at 50% 50%, rgba(var(--brand-primary-rgb) / 0.12), transparent 70%)'
            }}
          />
        </div>
      </div>
      {!prefersReducedMotion && trailBursts.map((burst) => (
        <div
          key={burst.id}
          className="pointer-events-none fixed left-0 top-0 z-[195]"
          style={{
            width: 42,
            height: 42,
            transform: `translate3d(${burst.x - 21}px, ${burst.y - 21}px, 0)`
          }}
          aria-hidden="true"
        >
          <ParticleLayer
            id={`ghost-deal-trail-${burst.id}`}
            preset="deal-trail"
            suit={suit}
            intensity={0.45}
            zIndex={1}
          />
        </div>
      ))}
    </>,
    document.body
  );
}

export function ReadingOverlays({
  selectedCardData,
  resolvedQuestion,
  effectiveTier,
  onCloseDetail,
  onNavigateCard,
  navigationData,
  ghostAnimation,
  onGhostComplete
}) {
  return (
    <>
      {selectedCardData ? (
        <CardModal
          card={selectedCardData.card}
          position={selectedCardData.position}
          question={resolvedQuestion}
          userTier={effectiveTier}
          enableCinematic
          isOpen={Boolean(selectedCardData)}
          onClose={onCloseDetail}
          layoutId={`card-${selectedCardData.index}`}
          onNavigate={onNavigateCard}
          canNavigatePrev={navigationData.canPrev}
          canNavigateNext={navigationData.canNext}
          navigationLabel={navigationData.label}
        />
      ) : null}

      {ghostAnimation ? (
        <GhostCard
          startRect={ghostAnimation.startRect}
          endRect={ghostAnimation.endRect}
          suit={ghostAnimation.suit}
          onComplete={onGhostComplete}
        />
      ) : null}
    </>
  );
}
