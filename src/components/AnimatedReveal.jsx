/**
 * AnimatedReveal.jsx
 * 
 * Component for displaying AI-generated animated card reveals
 * using Sora-2 video generation. Integrates with the card flip sequence.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCanonicalCard, getOrientationMeaning } from '../lib/cardLookup';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { VIDEO_STYLE_PRESETS, DEFAULT_VIDEO_STYLE } from '../../shared/vision/videoStyles.js';

// Video style options (shared with backend)
const VIDEO_STYLES = VIDEO_STYLE_PRESETS;

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_MS = 120000;
const MAX_POLL_ERRORS = 2;

// Loading state with animated shimmer
function VideoLoadingSkeleton({ prefersReducedMotion = false }) {
  return (
    <div className="relative w-full aspect-square bg-surface rounded-lg overflow-hidden">
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/20 to-transparent"
        animate={prefersReducedMotion ? undefined : { x: ['-100%', '100%'] }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 1.5, repeat: Infinity, ease: 'linear' }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div 
          className="w-16 h-16 border-2 border-accent/40 border-t-primary rounded-full"
          animate={prefersReducedMotion ? undefined : { rotate: 360 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
        <p className="text-accent/80 text-sm mt-4">Generating reveal...</p>
        <p className="text-muted text-xs mt-1">This may take 30-60 seconds</p>
      </div>
    </div>
  );
}

// Progress indicator for job polling
function ProgressIndicator({ status, progress, prefersReducedMotion = false }) {
  const statusMessages = {
    pending: 'Queued for generation...',
    processing: 'Creating your cinematic reveal...',
    completed: 'Ready!',
    failed: 'Generation failed'
  };
  
  return (
    <div className="text-center py-2">
      <div className="flex items-center justify-center gap-2 text-sm">
        <span className={`w-2 h-2 rounded-full ${
          status === 'completed' ? 'bg-success' :
          status === 'failed' ? 'bg-error' :
          'bg-warning animate-pulse'
        }`} />
        <span className="text-muted">
          {statusMessages[status] || status}
        </span>
      </div>
      {progress > 0 && progress < 100 && (
        <div className="w-48 mx-auto mt-2 h-1 bg-surface-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-accent"
            initial={prefersReducedMotion ? false : { width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
          />
        </div>
      )}
    </div>
  );
}

// Video player with controls
function VideoPlayer({ videoData, onReplay, prefersReducedMotion = false }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  
  useEffect(() => {
    if (videoRef.current && videoData) {
      videoRef.current.play().catch(() => {
        // Autoplay blocked, show play button
        setIsPlaying(false);
      });
    }
  }, [videoData]);
  
  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  const handleEnded = () => {
    setIsPlaying(false);
  };
  
  return (
    <div className="relative w-full aspect-square bg-main rounded-lg overflow-hidden group">
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
      
      {/* Play/Pause overlay */}
      <div 
        className="absolute inset-0 flex items-center justify-center 
                   bg-main/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 cursor-pointer"
        style={{ transition: prefersReducedMotion ? 'none' : undefined }}
        onClick={handlePlayPause}
      >
        <motion.div
          whileHover={prefersReducedMotion ? undefined : { scale: 1.1 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
          className="w-16 h-16 bg-primary/90 rounded-full flex items-center justify-center"
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
        </motion.div>
      </div>
      
      {/* Replay button (shown when video ends) */}
      {!isPlaying && (
        <button
          onClick={onReplay}
          className="absolute bottom-4 right-4 px-3 py-1.5 bg-surface/85 
                     text-main rounded-lg text-sm hover:bg-surface transition-colors"
        >
          Replay ↻
        </button>
      )}
    </div>
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
  const [style, setStyle] = useState(DEFAULT_VIDEO_STYLE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [videoData, setVideoData] = useState(null);
  const [showStylePicker, setShowStylePicker] = useState(false);
  
  const pollIntervalRef = useRef(null);
  const pollMetaRef = useRef({ startedAt: 0, errorCount: 0 });
  const autoGenerateKeyRef = useRef(null);
  const requestTokenRef = useRef(0);
  const normalizedQuestion = (question || '').trim();
  const normalizedPosition = (position || '').trim();
  const isReversed = Boolean(card?.reversed ?? card?.isReversed);
  const cardIdentity = `${card?.name || ''}:${card?.number ?? ''}:${card?.suit ?? ''}:${isReversed ? 'r' : 'u'}:${normalizedPosition}:${normalizedQuestion}`;
  
  // Tier config
  const tierConfig = {
    free: { enabled: false },
    plus: { enabled: true, styles: ['mystical'] },
    pro: { enabled: true, styles: VIDEO_STYLES.map(s => s.id) }
  };
  
  const config = tierConfig[userTier] || tierConfig.free;
  const availableStyles = VIDEO_STYLES.filter(s => config.styles?.includes(s.id));

  useEffect(() => {
    requestTokenRef.current += 1;
    setVideoData(null);
    setLoading(false);
    setError(null);
    setJobStatus(null);
    setJobId(null);
    setShowStylePicker(false);
    pollMetaRef.current = { startedAt: 0, errorCount: 0 };

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [cardIdentity]);
  
  // Poll for job completion
  const pollJobStatus = useCallback(async (id, requestToken) => {
    if (requestToken !== requestTokenRef.current) return;
    try {
      const meta = pollMetaRef.current;
      if (meta.startedAt && Date.now() - meta.startedAt > MAX_POLL_MS) {
        setError('Video generation is taking longer than expected. Please try again.');
        setJobStatus('failed');
        setLoading(false);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
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
        const message = data?.error || data?.details || 'Failed to check video status.';
        setError(message);
        setJobStatus('failed');
        setLoading(false);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        return;
      }
      
      if (data?.error) {
        setError(data.error);
        setJobStatus('failed');
        setLoading(false);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        return;
      }
      
      if (data.status === 'completed' && data.video) {
        // Video is ready
        setVideoData(data.video);
        setJobStatus('completed');
        setLoading(false);
        
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        
        if (onVideoReady) {
          onVideoReady(data.video);
        }
      } else if (data.status === 'failed') {
        setError('Video generation failed. Please try again.');
        setJobStatus('failed');
        setLoading(false);
        
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } else {
        setJobStatus(data.status);
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
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        return;
      }
      console.error('Poll error:', err);
    }
  }, [onVideoReady]);
  
  // Start video generation
  const handleGenerate = useCallback(async () => {
    if (!config.enabled) return;
    if (!card?.name) {
      setError('Card details missing. Please try again.');
      return;
    }

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setJobId(null);
    
    const requestToken = requestTokenRef.current + 1;
    requestTokenRef.current = requestToken;

    setLoading(true);
    setError(null);
    setVideoData(null);
    setJobStatus('pending');

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
      
      const data = await response.json();
      
      if (requestToken !== requestTokenRef.current) return;

      if (!response.ok) {
        throw new Error(data.error || 'Generation failed');
      }
      
      if (data.status === 'completed' && data.video) {
        // Cached result
        setVideoData(data.video);
        setJobStatus('completed');
        setLoading(false);
        
        if (onVideoReady) {
          onVideoReady(data.video);
        }
      } else if (data.jobId) {
        // Start polling
        setJobId(data.jobId);
        setJobStatus('processing');
        pollMetaRef.current = { startedAt: Date.now(), errorCount: 0 };
        pollJobStatus(data.jobId, requestToken);
        pollIntervalRef.current = setInterval(() => {
          pollJobStatus(data.jobId, requestToken);
        }, POLL_INTERVAL_MS);
      } else {
        throw new Error('Video generation did not return a job id.');
      }
    } catch (err) {
      if (requestToken !== requestTokenRef.current) return;
      setError(err.message);
      setLoading(false);
      setJobStatus(null);
    }
  }, [card, question, position, style, config.enabled, onVideoReady, pollJobStatus]);
  
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
  
  // Replay video
  const handleReplay = () => {
    setVideoData(null);
    setTimeout(() => {
      handleGenerate();
    }, 100);
  };
  
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
      <AnimatePresence mode="wait">
        {/* Video display */}
        {videoData && (
          <motion.div
            key="video"
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : undefined}
          >
            <VideoPlayer videoData={videoData} onReplay={handleReplay} prefersReducedMotion={prefersReducedMotion} />
          </motion.div>
        )}
        
        {/* Loading state */}
        {loading && !videoData && (
          <motion.div
            key="loading"
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : undefined}
          >
            <VideoLoadingSkeleton prefersReducedMotion={prefersReducedMotion} />
            {jobStatus && (
              <ProgressIndicator status={jobStatus} progress={0} prefersReducedMotion={prefersReducedMotion} />
            )}
          </motion.div>
        )}
        
        {/* Generate button */}
        {!loading && !videoData && (
          <motion.div
            key="button"
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : undefined}
            className="text-center py-6"
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
              🎬 Generate Cinematic Reveal
            </button>
            
            <p className="text-muted text-xs mt-2">
              Creates a 4-second animated video of this card
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Error display */}
      {error && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : undefined}
          className="absolute inset-x-0 bottom-0 p-3 bg-error/15 border-t border-error/30 rounded-b-lg"
        >
          <p className="text-error text-sm text-center">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-error hover:text-error/80 text-xs block mx-auto mt-1 underline"
          >
            Dismiss
          </button>
        </motion.div>
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
  const tierConfig = {
    free: { enabled: false },
    plus: { enabled: true },
    pro: { enabled: true }
  };
  
  const config = tierConfig[userTier] || tierConfig.free;
  
  if (!config.enabled) return null;
  
  return (
    <motion.button
      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
      transition={prefersReducedMotion ? { duration: 0 } : undefined}
      onClick={onGenerate}
      className="absolute -bottom-2 left-1/2 -translate-x-1/2 
                 px-3 py-1 bg-gradient-to-r from-primary/90 to-accent/90 
                 text-surface text-xs rounded-full shadow-lg backdrop-blur-sm
                 hover:from-primary hover:to-accent transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      🎬 Animate
    </motion.button>
  );
}
