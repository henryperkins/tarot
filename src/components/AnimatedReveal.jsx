/**
 * AnimatedReveal.jsx
 * 
 * Component for displaying AI-generated animated card reveals
 * using Sora-2 video generation. Integrates with the card flip sequence.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { animate, set } from '../lib/motionAdapter';
import { getCanonicalCard, getOrientationMeaning } from '../lib/cardLookup';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useSounds } from '../hooks/useSounds';
import { VIDEO_STYLE_PRESETS, DEFAULT_VIDEO_STYLE } from '../../shared/vision/videoStyles.js';
import { getMediaTierConfig } from '../../shared/monetization/media.js';

// Video style options (shared with backend)
const VIDEO_STYLES = VIDEO_STYLE_PRESETS;

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_MS = 120000;
const MAX_POLL_ERRORS = 2;
const MAX_POLL_HTTP_ERRORS = 3;
const MAX_POLL_NOT_FOUND_RETRIES = 4;
const INITIAL_POLL_DELAY_MS = 2500;

function normalizeClientStatus(rawStatus) {
  const status = typeof rawStatus === 'string' ? rawStatus.trim().toLowerCase() : '';
  if (!status) return 'processing';
  if (status === 'pending' || status === 'queued' || status === 'submitted') return 'pending';
  if (status === 'processing' || status === 'running' || status === 'in_progress') return 'processing';
  if (status === 'completed' || status === 'succeeded') return 'completed';
  if (status === 'failed' || status === 'cancelled' || status === 'expired') return 'failed';
  return status;
}

function estimateProgress(status, startedAt) {
  const normalized = normalizeClientStatus(status);
  if (normalized === 'completed') return 100;
  if (normalized === 'failed') return 0;

  const elapsedMs = startedAt > 0 ? Math.max(0, Date.now() - startedAt) : 0;
  const elapsedRatio = Math.min(elapsedMs / MAX_POLL_MS, 1);
  const base = normalized === 'pending' ? 12 : 36;
  const range = normalized === 'pending' ? 30 : 54;
  return Math.min(95, Math.round(base + (range * elapsedRatio)));
}

// Loading state with animated shimmer
function VideoLoadingSkeleton({ prefersReducedMotion = false }) {
  const shimmerRef = useRef(null);
  const spinnerRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion) return undefined;

    const animations = [];
    if (shimmerRef.current) {
      set(shimmerRef.current, { translateX: '-100%' });
      animations.push(animate(shimmerRef.current, {
        translateX: ['-100%', '100%'],
        duration: 1500,
        loop: true,
        ease: 'linear'
      }));
    }
    if (spinnerRef.current) {
      animations.push(animate(spinnerRef.current, {
        rotate: 360,
        duration: 1500,
        loop: true,
        ease: 'linear'
      }));
    }

    return () => {
      animations.forEach((anim) => anim?.pause?.());
    };
  }, [prefersReducedMotion]);

  return (
    <div className="relative w-full aspect-square bg-surface rounded-lg overflow-hidden">
      <div
        ref={shimmerRef}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/20 to-transparent"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div
          ref={spinnerRef}
          className="w-16 h-16 border-2 border-accent/40 border-t-primary rounded-full"
        />
        <p className="text-accent/80 text-sm mt-4">Generating reveal...</p>
        <p className="text-muted text-xs mt-1">This may take 30-60 seconds</p>
      </div>
    </div>
  );
}

// Progress indicator for job polling
function ProgressIndicator({ status, progress, prefersReducedMotion = false }) {
  const normalizedStatus = normalizeClientStatus(status);
  const statusMessages = {
    pending: 'Queued for generation...',
    processing: 'Creating your cinematic reveal...',
    cancelled: 'Generation cancelled',
    expired: 'Generation expired',
    completed: 'Ready!',
    failed: 'Generation failed'
  };
  
  return (
    <div className="text-center py-2">
      <div className="flex items-center justify-center gap-2 text-sm">
        <span className={`w-2 h-2 rounded-full ${
          normalizedStatus === 'completed' ? 'bg-success' :
          normalizedStatus === 'failed' ? 'bg-error' :
          'bg-warning animate-pulse'
        }`} />
        <span className="text-muted">
          {statusMessages[normalizedStatus] || normalizedStatus}
        </span>
      </div>
      {progress > 0 && progress < 100 && (
        <div className="w-48 mx-auto mt-2 h-1 bg-surface-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent"
            style={{
              width: `${progress}%`,
              transition: prefersReducedMotion ? 'none' : 'width 220ms ease-out'
            }}
          />
        </div>
      )}
    </div>
  );
}

// Video player with controls
function VideoPlayer({ videoData, prefersReducedMotion = false }) {
  const videoRef = useRef(null);
  const playButtonRef = useRef(null);
  const containerRef = useRef(null);
  const expandedWrapperRef = useRef(null);
  const expandedVideoRef = useRef(null);
  const closeButtonRef = useRef(null);
  const expandAnimRef = useRef(null);
  const expandTimeRef = useRef(0);
  const bodyOverflowRef = useRef('');
  const sounds = useSounds();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [originRect, setOriginRect] = useState(null);

  useEffect(() => {
    if (videoRef.current && videoData) {
      videoRef.current.play().catch(() => {
        // Autoplay blocked, show play button
        setIsPlaying(false);
      });
    }
  }, [videoData]);
  
  useEffect(() => {
    const node = playButtonRef.current;
    if (!node) return undefined;
    set(node, { scale: 1 });
    return undefined;
  }, []);

  const handlePlayPause = () => {
    const activeVideo = isExpanded ? expandedVideoRef.current : videoRef.current;
    if (!activeVideo) return;
    if (isPlaying) {
      activeVideo.pause();
    } else {
      activeVideo.play().catch(() => setIsPlaying(false));
    }
  };
  
  const handleEnded = () => {
    setIsPlaying(false);
  };

  const handleReplay = () => {
    const activeVideo = isExpanded ? expandedVideoRef.current : videoRef.current;
    if (!activeVideo) return;
    activeVideo.currentTime = 0;
    activeVideo.play().catch(() => setIsPlaying(false));
  };
  
  const animatePlayButton = (scaleValue) => {
    if (prefersReducedMotion || !playButtonRef.current) return;
    animate(playButtonRef.current, {
      scale: scaleValue,
      duration: 120,
      ease: 'outQuad'
    });
  };

  const closeExpanded = useCallback(() => {
    const wrapper = expandedWrapperRef.current;
    const overlayVideo = expandedVideoRef.current;
    if (overlayVideo && videoRef.current) {
      videoRef.current.currentTime = overlayVideo.currentTime;
      if (!overlayVideo.paused) {
        videoRef.current.play().catch(() => {});
      }
    }

    if (!wrapper || !originRect || prefersReducedMotion) {
      setIsExpanded(false);
      return;
    }

    if (expandAnimRef.current?.pause) {
      expandAnimRef.current.pause();
    }
    expandAnimRef.current = animate(wrapper, {
      translateX: 0,
      translateY: 0,
      scale: 1,
      duration: 420,
      ease: 'outQuad'
    });
    expandAnimRef.current
      .then(() => setIsExpanded(false))
      .catch(() => setIsExpanded(false));
  }, [originRect, prefersReducedMotion]);

  const openExpanded = useCallback(() => {
    if (isExpanded) return;
    const node = containerRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setOriginRect(rect);
    if (videoRef.current) {
      expandTimeRef.current = videoRef.current.currentTime || 0;
      videoRef.current.pause();
    }
    setIsExpanded(true);
    void sounds.play('reveal-bloom', { essential: true });
  }, [isExpanded, sounds]);

  useEffect(() => {
    if (!isExpanded) return;
    bodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = bodyOverflowRef.current;
    };
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeExpanded();
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeExpanded, isExpanded]);

  useEffect(() => {
    if (!isExpanded || !originRect) return;
    const wrapper = expandedWrapperRef.current;
    if (!wrapper) return;
    if (prefersReducedMotion) {
      set(wrapper, { translateX: 0, translateY: 0, scale: 1 });
      return;
    }
    const viewportWidth = window.innerWidth || 0;
    const viewportHeight = window.innerHeight || 0;
    const targetScale = Math.min(
      (viewportWidth * 0.9) / originRect.width,
      (viewportHeight * 0.85) / originRect.height
    );
    const targetX = (viewportWidth / 2) - (originRect.left + originRect.width / 2);
    const targetY = (viewportHeight / 2) - (originRect.top + originRect.height / 2);
    set(wrapper, { translateX: 0, translateY: 0, scale: 1 });
    if (expandAnimRef.current?.pause) {
      expandAnimRef.current.pause();
    }
    expandAnimRef.current = animate(wrapper, {
      translateX: targetX,
      translateY: targetY,
      scale: targetScale,
      duration: 500,
      ease: 'outQuad'
    });
    return () => expandAnimRef.current?.pause?.();
  }, [isExpanded, originRect, prefersReducedMotion]);

  useEffect(() => {
    if (!isExpanded) return;
    const video = expandedVideoRef.current;
    if (!video) return;
    video.currentTime = expandTimeRef.current || 0;
    video.muted = false;
    video.play().catch(() => setIsPlaying(false));
  }, [isExpanded]);

  const expandedOverlay = isExpanded && originRect ? createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={closeExpanded}
    >
      <div
        ref={expandedWrapperRef}
        className="fixed bg-black rounded-lg overflow-hidden shadow-2xl"
        style={{
          left: originRect.left,
          top: originRect.top,
          width: originRect.width,
          height: originRect.height,
          transformOrigin: 'top left'
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <video
          ref={expandedVideoRef}
          src={`data:video/mp4;base64,${videoData}`}
          className="w-full h-full object-contain"
          onEnded={handleEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          playsInline
        />
        <button
          ref={closeButtonRef}
          type="button"
          onClick={closeExpanded}
          className="absolute top-3 right-3 rounded-full bg-black/70 border border-white/20 text-white px-3 py-1.5 text-xs font-semibold"
          aria-label="Close expanded video"
        >
          Close
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div
        ref={containerRef}
        className="relative w-full aspect-square bg-main rounded-lg overflow-hidden group"
        onClick={openExpanded}
      >
      <video
        ref={videoRef}
        src={`data:video/mp4;base64,${videoData}`}
        className="w-full h-full object-contain"
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        playsInline
        muted
      />

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          openExpanded();
        }}
        className="absolute top-3 left-3 z-20 rounded-full bg-black/65 border border-white/20 px-2.5 py-1 text-2xs font-semibold text-white"
        aria-label="Expand cinematic reveal"
      >
        Expand
      </button>
      
      {/* Play/Pause overlay */}
      <div 
        className="absolute inset-0 z-10 flex items-center justify-center 
                   bg-main/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        style={{ transition: prefersReducedMotion ? 'none' : undefined }}
      >
        <button
          ref={playButtonRef}
          type="button"
          aria-pressed={isPlaying}
          aria-label={isPlaying ? 'Pause cinematic reveal' : 'Play cinematic reveal'}
          className="w-16 h-16 bg-primary/90 rounded-full flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          onClick={(event) => {
            event.stopPropagation();
            handlePlayPause();
          }}
          onMouseEnter={() => animatePlayButton(1.1)}
          onMouseLeave={() => animatePlayButton(1)}
          onMouseDown={() => animatePlayButton(0.92)}
          onMouseUp={() => animatePlayButton(1.1)}
        >
          {isPlaying ? (
            <svg className="w-8 h-8 text-surface" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-surface ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>
      
      {/* Replay button (shown when video ends) */}
      {!isPlaying && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            handleReplay();
          }}
          className="absolute bottom-4 right-4 z-20 px-3 py-1.5 bg-surface/85 
                     text-main rounded-lg text-sm hover:bg-surface transition-colors"
        >
          Replay ↻
        </button>
      )}
    </div>
    {expandedOverlay}
    </>
  );
}

// Main component
export default function AnimatedReveal({
  card,
  position,
  question,
  userTier = 'free',
  autoGenerate = false,
  onVideoReady,
  className = ''
}) {
  const prefersReducedMotion = useReducedMotion();
  const [style, setStyleRaw] = useState(DEFAULT_VIDEO_STYLE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [videoData, setVideoData] = useState(null);
  const [showStylePicker, setShowStylePicker] = useState(false);
  
  const pollStartTimeoutRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const pollInFlightRef = useRef(false);
  const pollMetaRef = useRef({
    startedAt: 0,
    errorCount: 0,
    notFoundCount: 0,
    httpErrorCount: 0
  });
  const autoGenerateKeyRef = useRef(null);
  const requestTokenRef = useRef(0);
  const normalizedQuestion = (question || '').trim();
  const normalizedPosition = (position || '').trim();
  const isReversed = Boolean(card?.reversed ?? card?.isReversed);
  const cardIdentity = `${card?.name || ''}:${card?.number ?? ''}:${card?.suit ?? ''}:${isReversed ? 'r' : 'u'}:${normalizedPosition}:${normalizedQuestion}`;

  const config = getMediaTierConfig(userTier, {
    cardVideoStyles: VIDEO_STYLES.map((stylePreset) => stylePreset.id)
  }).cardVideo;
  const availableStyles = VIDEO_STYLES.filter(s => config.styles?.includes(s.id));

  const setStyle = useCallback((id) => {
    const allowed = config.styles || [];
    setStyleRaw(allowed.includes(id) ? id : (allowed[0] || DEFAULT_VIDEO_STYLE));
  }, [config.styles]);

  const clearPolling = useCallback(() => {
    if (pollStartTimeoutRef.current) {
      window.clearTimeout(pollStartTimeoutRef.current);
      pollStartTimeoutRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pollInFlightRef.current = false;
  }, []);

  // Clamp style when tier changes make current selection unavailable
  useEffect(() => {
    const allowed = config.styles || [];
    if (allowed.length > 0 && !allowed.includes(style)) {
      setStyleRaw(allowed[0]);
    }
  }, [config.styles, style]);

  const cardMediaMeta = useCallback((overrides = {}) => {
    const canonicalCard = getCanonicalCard(card);
    const reversed = Boolean(card?.reversed ?? card?.isReversed);
    return {
      source: 'card-reveal',
      mimeType: 'video/mp4',
      question: normalizedQuestion || question || '',
      position: normalizedPosition || position || '',
      style,
      seconds: 4,
      card: {
        name: card?.name || canonicalCard?.name || null,
        reversed,
        number: card?.number ?? canonicalCard?.number ?? null,
        suit: card?.suit ?? canonicalCard?.suit ?? null,
        rank: card?.rank ?? canonicalCard?.rank ?? null,
        rankValue: card?.rankValue ?? canonicalCard?.rankValue ?? null
      },
      ...overrides
    };
  }, [card, normalizedPosition, normalizedQuestion, position, question, style]);

  useEffect(() => {
    requestTokenRef.current += 1;
    setVideoData(null);
    setLoading(false);
    setError(null);
    setJobStatus(null);
    setJobId(null);
    setProgress(0);
    setShowStylePicker(false);
    pollMetaRef.current = {
      startedAt: 0,
      errorCount: 0,
      notFoundCount: 0,
      httpErrorCount: 0
    };
    clearPolling();

    return () => {
      clearPolling();
    };
  }, [cardIdentity, clearPolling]);
  
  // Poll for job completion
  const pollJobStatus = useCallback(async (id, requestToken) => {
    if (requestToken !== requestTokenRef.current) return;
    if (pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    try {
      const meta = pollMetaRef.current;
      if (meta.startedAt && Date.now() - meta.startedAt > MAX_POLL_MS) {
        setError('Video generation is taking longer than expected. Please try again.');
        setJobStatus('failed');
        setLoading(false);
        setProgress(0);
        clearPolling();
        return;
      }

      const response = await fetch(`/api/generate-card-video?jobId=${id}`, {
        credentials: 'include'
      });
      
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (requestToken !== requestTokenRef.current) return;

      if (!response.ok) {
        const nextMeta = { ...meta };
        const isRetryableNotFound = response.status === 404 && nextMeta.notFoundCount < MAX_POLL_NOT_FOUND_RETRIES;
        const isRetryableHttp = (response.status === 429 || response.status >= 500) && nextMeta.httpErrorCount < MAX_POLL_HTTP_ERRORS;

        if (isRetryableNotFound || isRetryableHttp) {
          if (isRetryableNotFound) {
            nextMeta.notFoundCount += 1;
          }
          if (isRetryableHttp) {
            nextMeta.httpErrorCount += 1;
          }
          pollMetaRef.current = nextMeta;
          setJobStatus('processing');
          setProgress((prev) => Math.max(prev, estimateProgress('processing', meta.startedAt)));
          return;
        }

        const messageParts = [data?.error, data?.details, data?.hint].filter(Boolean);
        const message = messageParts.join(' ').trim() || 'Failed to check video status.';
        setError(message);
        setJobStatus('failed');
        setLoading(false);
        setProgress(0);
        clearPolling();
        return;
      }
      
      if (data?.error) {
        const messageParts = [data?.error, data?.details, data?.hint].filter(Boolean);
        setError(messageParts.join(' ').trim() || 'Video generation failed.');
        setJobStatus('failed');
        setLoading(false);
        setProgress(0);
        clearPolling();
        return;
      }
      
      if (data.status === 'completed' && data.video) {
        // Video is ready
        setVideoData(data.video);
        setJobStatus('completed');
        setProgress(100);
        setLoading(false);
        clearPolling();
        
        if (onVideoReady) {
          onVideoReady(data.video, cardMediaMeta({
            cacheKey: data.cacheKey || null,
            style: data.style || style,
            seconds: data.seconds || 4
          }));
        }
      } else if (normalizeClientStatus(data.status) === 'failed') {
        setError(data?.message || 'Video generation failed. Please try again.');
        setJobStatus('failed');
        setLoading(false);
        setProgress(0);
        clearPolling();
      } else {
        pollMetaRef.current = {
          ...meta,
          errorCount: 0,
          httpErrorCount: 0
        };
        const nextStatus = normalizeClientStatus(data.status);
        setJobStatus(nextStatus);
        setProgress((prev) => Math.max(prev, estimateProgress(nextStatus, meta.startedAt)));
      }
    } catch (err) {
      if (requestToken !== requestTokenRef.current) return;
      const meta = pollMetaRef.current;
      meta.errorCount += 1;
      pollMetaRef.current = meta;
      if (meta.errorCount >= MAX_POLL_ERRORS) {
        setError('Unable to reach the video service. Please try again.');
        setJobStatus('failed');
        setLoading(false);
        setProgress(0);
        clearPolling();
        return;
      }
      setJobStatus('processing');
      setProgress((prev) => Math.max(prev, estimateProgress('processing', meta.startedAt)));
      console.error('Poll error:', err);
    } finally {
      pollInFlightRef.current = false;
    }
  }, [cardMediaMeta, clearPolling, onVideoReady, style]);
  
  // Start video generation
  const handleGenerate = useCallback(async () => {
    if (!config.enabled) return;
    if (!card?.name) {
      setError('Card details missing. Please try again.');
      return;
    }

    clearPolling();
    setJobId(null);
    
    const requestToken = requestTokenRef.current + 1;
    requestTokenRef.current = requestToken;

    setLoading(true);
    setError(null);
    setVideoData(null);
    setJobStatus('pending');
    setProgress(10);

    const canonicalCard = getCanonicalCard(card);
    const reversed = Boolean(card?.reversed ?? card?.isReversed);
    const payloadCard = {
      name: card.name,
      reversed,
      number: card?.number ?? canonicalCard?.number ?? null,
      suit: card?.suit ?? canonicalCard?.suit ?? null,
      rank: card?.rank ?? canonicalCard?.rank ?? null,
      rankValue: card?.rankValue ?? canonicalCard?.rankValue ?? null,
      meaning: card?.meaning || getOrientationMeaning({ ...card, isReversed: reversed }) || ''
    };
    
    try {
      const response = await fetch('/api/generate-card-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          card: payloadCard,
          question,
          position,
          style,
          seconds: 4
        })
      });
      
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      
      if (requestToken !== requestTokenRef.current) return;

      if (!response.ok) {
        const messageParts = [data?.details, data?.error, data?.hint].filter(Boolean);
        throw new Error(messageParts.join(' ').trim() || 'Generation failed');
      }
      
      if (data.status === 'completed' && data.video) {
        // Cached result
        setVideoData(data.video);
        setJobStatus('completed');
        setProgress(100);
        setLoading(false);
        
        if (onVideoReady) {
          onVideoReady(data.video, cardMediaMeta({
            cacheKey: data.cacheKey || null,
            style: data.style || style,
            seconds: data.seconds || 4
          }));
        }
      } else if (data.jobId) {
        // Start polling
        setJobId(data.jobId);
        setJobStatus('pending');
        setProgress((prev) => Math.max(prev, 12));
        pollMetaRef.current = {
          startedAt: Date.now(),
          errorCount: 0,
          notFoundCount: 0,
          httpErrorCount: 0
        };
        pollStartTimeoutRef.current = window.setTimeout(() => {
          if (requestToken !== requestTokenRef.current) return;
          pollJobStatus(data.jobId, requestToken);
          pollIntervalRef.current = setInterval(() => {
            pollJobStatus(data.jobId, requestToken);
          }, POLL_INTERVAL_MS);
        }, INITIAL_POLL_DELAY_MS);
      } else {
        throw new Error('Video generation did not return a job id.');
      }
    } catch (err) {
      if (requestToken !== requestTokenRef.current) return;
      setError(err.message);
      setLoading(false);
      setJobStatus('failed');
      setProgress(0);
    }
  }, [card, question, position, style, config.enabled, onVideoReady, pollJobStatus, cardMediaMeta, clearPolling]);
  
  // Auto-generate when context changes
  useEffect(() => {
    if (!autoGenerate) {
      autoGenerateKeyRef.current = null;
      return;
    }

    if (!config.enabled || !card?.name) return;

    if (autoGenerateKeyRef.current === cardIdentity) return;
    autoGenerateKeyRef.current = cardIdentity;
    handleGenerate();
  }, [autoGenerate, config.enabled, card?.name, cardIdentity, handleGenerate]);
  
  // Feature not available
  if (!config.enabled) {
    return (
      <div className={`p-4 bg-surface/80 border border-secondary/30 rounded-lg text-center ${className}`}>
        <p className="text-muted text-sm">
          Animated card reveals available with Plus subscription
        </p>
        <button
          onClick={() => window.location.href = '/pricing'}
          className="mt-2 text-accent hover:text-accent/80 text-sm underline"
        >
          Upgrade
        </button>
      </div>
    );
  }
  
  return (
    <div className={`relative ${className}`}>
      {/* Video display */}
      {videoData && (
        <div
          key="video"
          style={{ transition: prefersReducedMotion ? 'none' : 'opacity 220ms ease-out, transform 220ms ease-out' }}
        >
          <VideoPlayer videoData={videoData} prefersReducedMotion={prefersReducedMotion} />
        </div>
      )}

      {/* Loading state */}
      {loading && !videoData && (
        <div
          key="loading"
          style={{ transition: prefersReducedMotion ? 'none' : 'opacity 180ms ease-out' }}
        >
          <VideoLoadingSkeleton prefersReducedMotion={prefersReducedMotion} />
          {jobStatus && (
            <ProgressIndicator status={jobStatus} progress={progress} prefersReducedMotion={prefersReducedMotion} />
          )}
        </div>
      )}

      {/* Generate button */}
      {!loading && !videoData && (
        <div
          key="button"
          className="text-center py-6"
          style={{ transition: prefersReducedMotion ? 'none' : 'opacity 180ms ease-out' }}
        >
          {/* Style picker toggle */}
          {availableStyles.length > 1 && (
            <div className="mb-4">
              <button
                onClick={() => setShowStylePicker(!showStylePicker)}
                className="text-muted text-sm hover:text-main"
              >
                Style: <span className="text-accent">{style}</span>
                <span className="ml-1">▾</span>
              </button>

              {showStylePicker && (
                <div className="flex gap-2 justify-center mt-2">
                  {availableStyles.map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setStyle(s.id);
                        setShowStylePicker(false);
                      }}
                      type="button"
                      aria-pressed={style === s.id}
                      className={`px-3 py-1 rounded text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                        style === s.id
                          ? 'bg-primary text-surface font-semibold border border-primary/60'
                          : 'bg-surface-muted text-muted hover:bg-surface hover:text-main border border-transparent'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleGenerate}
            className="px-6 py-2.5 bg-gradient-to-r from-primary to-accent 
                       text-surface rounded-lg hover:from-primary/90 hover:to-accent/90
                       transition-all shadow-lg text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Generate Cinematic Reveal
          </button>

          <p className="text-muted text-xs mt-2">
            Creates a 4-second animated scene for this card
          </p>
        </div>
      )}
      
      {/* Error display */}
      {error && (
        <div
          className="mt-3 p-3 bg-error/15 border border-error/30 rounded-lg"
          style={{ transition: prefersReducedMotion ? 'none' : 'opacity 180ms ease-out, transform 180ms ease-out' }}
        >
          <p className="text-error text-sm text-center">{error}</p>
          <div className="mt-1 flex items-center justify-center gap-3">
            <button
              onClick={() => setError(null)}
              className="text-error hover:text-error/80 text-xs underline"
            >
              Dismiss
            </button>
            <button
              onClick={handleGenerate}
              className="text-error hover:text-error/80 text-xs underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact trigger button for use within card reveal flow
 */
export function AnimatedRevealTrigger({ 
  card: _card, 
  position: _position, 
  question: _question,
  userTier,
  onGenerate 
}) {
  const prefersReducedMotion = useReducedMotion();
  const config = getMediaTierConfig(userTier).cardVideo;
  
  if (!config.enabled) return null;
  
  return (
    <button
      onClick={onGenerate}
      className="absolute -bottom-2 left-1/2 -translate-x-1/2 
                 px-3 py-1 bg-gradient-to-r from-primary/90 to-accent/90 
                 text-surface text-xs rounded-full shadow-lg backdrop-blur-sm
                 hover:from-primary hover:to-accent transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      style={{ transitionDuration: prefersReducedMotion ? '0ms' : undefined }}
    >
      🎬 Animate
    </button>
  );
}
