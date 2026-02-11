/**
 * StoryIllustration.jsx
 * 
 * Component for displaying and requesting AI-generated story art
 * based on the tarot reading. Supports multiple styles and formats.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { animate } from '../lib/motionAdapter';
import { getMediaTierConfig } from '../../shared/monetization/media.js';
import { useReducedMotion } from '../hooks/useReducedMotion';

// Style options with labels and descriptions
const STYLE_OPTIONS = [
  { id: 'watercolor', label: 'Watercolor', description: 'Soft, dreamy washes' },
  { id: 'nouveau', label: 'Art Nouveau', description: 'Ornate Mucha-inspired' },
  { id: 'minimal', label: 'Minimal', description: 'Clean ink lines' },
  { id: 'stained-glass', label: 'Stained Glass', description: 'Sacred cathedral colors' },
  { id: 'cosmic', label: 'Cosmic', description: 'Ethereal space nebulae' }
];

// Format options
const FORMAT_OPTIONS = [
  { id: 'single', label: 'Single Scene', description: 'Panoramic synthesis' },
  { id: 'triptych', label: 'Triptych', description: '3-panel narrative' },
  { id: 'panoramic', label: 'Panoramic', description: 'Wide cinematic scene' },
  { id: 'vignette', label: 'Card Vignette', description: 'Featured card art' }
];

// Loading skeleton component
function LoadingSkeleton({ format }) {
  const panelCount = format === 'triptych' ? 3 : 1;
  
  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: panelCount }).map((_, i) => (
        <div
          key={i}
          className="bg-gradient-to-br from-primary/20 to-accent/15 rounded-lg overflow-hidden animate-pulse"
          style={{
            width: format === 'triptych' ? '200px' : '400px',
            height: format === 'vignette' ? '300px' : '200px',
            aspectRatio: format === 'vignette' ? '2/3' : '3/2'
          }}
        >
          <div className="h-full flex flex-col items-center justify-center p-4">
            <div className="w-12 h-12 border-2 border-accent/40 border-t-primary rounded-full motion-safe:animate-spin" />
            <p className="text-accent/80 text-sm mt-3 text-center">
              {format === 'triptych' 
                ? ['Past', 'Present', 'Future'][i]
                : 'Illustrating...'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Style selector component
function StyleSelector({ value, onChange, allowedStyles }) {
  const available = STYLE_OPTIONS.filter(s => 
    !allowedStyles || allowedStyles.includes(s.id)
  );
  
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {available.map(style => (
        <button
          key={style.id}
          onClick={() => onChange(style.id)}
          type="button"
          aria-pressed={value === style.id}
          className={`px-3 py-1.5 rounded-full text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
            value === style.id
              ? 'bg-primary text-surface font-semibold border border-primary/60 shadow-lg'
              : 'bg-surface-muted text-muted hover:bg-surface hover:text-main border border-transparent'
          }`}
          title={style.description}
        >
          {style.label}
        </button>
      ))}
    </div>
  );
}

// Format selector component
function FormatSelector({ value, onChange, allowedFormats }) {
  const available = FORMAT_OPTIONS.filter(f => 
    !allowedFormats || allowedFormats.includes(f.id)
  );
  
  return (
    <div className="flex gap-2 justify-center">
      {available.map(format => (
        <button
          key={format.id}
          onClick={() => onChange(format.id)}
          type="button"
          aria-pressed={value === format.id}
          className={`px-3 py-1.5 rounded-lg text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
            value === format.id
              ? 'bg-primary text-surface font-semibold border border-primary/60 shadow-lg'
              : 'bg-surface-muted text-muted hover:bg-surface hover:text-main border border-transparent'
          }`}
          title={format.description}
        >
          {format.label}
        </button>
      ))}
    </div>
  );
}

// Generated image display
function GeneratedArt({ image, format, style, onDownload, onSave, canSave, showImage = true }) {
  const downloadClasses = canSave
    ? 'bg-surface-muted text-main hover:bg-surface border border-secondary/30'
    : 'bg-primary text-surface hover:bg-primary/90 border border-primary/60';

  return (
    <div className="relative transition-[opacity,transform] duration-300 ease-out">
      {showImage && (
        <div className={`
          rounded-xl overflow-hidden shadow-2xl
          ${format === 'triptych' ? 'max-w-3xl' : 'max-w-lg'}
          mx-auto
        `}>
          <img
            src={`data:image/jpeg;base64,${image}`}
            alt={`${style} tarot illustration`}
            className="w-full h-auto"
          />
        </div>
      )}
      
      {/* Action buttons */}
      <div className={`flex gap-3 justify-center ${showImage ? 'mt-4' : 'mt-1'}`}>
        {canSave && (
          <button
            onClick={onSave}
            type="button"
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 
                       text-surface rounded-lg transition-colors text-sm border border-primary/60
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Save to Journal
          </button>
        )}
        
        <button
          onClick={onDownload}
          type="button"
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm
                      ${downloadClasses}
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </button>
        
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 bg-surface-muted hover:bg-surface 
                     text-main rounded-lg transition-colors text-sm border border-secondary/30
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share
        </button>
      </div>
    </div>
  );
}

function HeroBackground({ image, format, activePanel = 1 }) {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef(null);
  const panelRefs = useRef([]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    if (prefersReducedMotion) {
      node.style.opacity = '0.5';
      return undefined;
    }
    node.style.opacity = '0';
    const anim = animate(node, {
      opacity: [0, 0.5],
      duration: 350,
      ease: 'outQuad'
    });
    return () => anim?.pause?.();
  }, [prefersReducedMotion, image]);

  useEffect(() => {
    if (format !== 'triptych') return undefined;
    panelRefs.current.forEach((panel, index) => {
      if (!panel) return;
      const targetOpacity = index === activePanel ? 1 : 0;
      if (prefersReducedMotion) {
        panel.style.opacity = String(targetOpacity);
        return;
      }
      animate(panel, {
        opacity: targetOpacity,
        duration: 420,
        ease: 'outQuad'
      });
    });
  }, [activePanel, format, prefersReducedMotion]);

  const imageUrl = `data:image/jpeg;base64,${image}`;
  const panels = format === 'triptych' ? [0, 1, 2] : [0];
  const panelStyles = (panelIndex) => {
    if (format !== 'triptych') {
      return {
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    }
    const positions = ['0% 50%', '50% 50%', '100% 50%'];
    return {
      backgroundImage: `url(${imageUrl})`,
      backgroundSize: '300% 100%',
      backgroundPosition: positions[panelIndex] || '50% 50%'
    };
  };

  const target = typeof document !== 'undefined'
    ? document.getElementById('hero-bg') || document.body
    : null;
  if (!target) return null;

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[0] pointer-events-none"
      style={{
        opacity: 0,
        filter: 'blur(20px)'
      }}
      aria-hidden="true"
    >
      {panels.map((panelIndex) => (
        <div
          key={panelIndex}
          ref={(node) => {
            panelRefs.current[panelIndex] = node;
          }}
          className="absolute inset-0"
          style={{
            ...panelStyles(panelIndex),
            opacity: panelIndex === activePanel ? 1 : 0,
            transition: prefersReducedMotion ? 'none' : undefined
          }}
        />
      ))}
    </div>,
    target
  );
}

// Main component
export default function StoryIllustration({ 
  cards, 
  question, 
  narrative,
  userTier = 'free',
  onSaveToJournal,
  onMediaReady,
  heroMode = false,
  activePanel = 1,
  autoGenerate = false,
  generationKey
}) {
  const REQUEST_TIMEOUT_MS = 45000;
  const [style, setStyle] = useState('watercolor');
  const [format, setFormat] = useState('single');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const autoGeneratedRef = useRef(false);
  const generationKeyRef = useRef(generationKey);
  const requestTokenRef = useRef(0);
  const requestControllerRef = useRef(null);
  
  const config = getMediaTierConfig(userTier, {
    storyArtStyles: STYLE_OPTIONS.map((option) => option.id),
    storyArtFormats: FORMAT_OPTIONS.map((option) => option.id)
  }).storyArt;

  useEffect(() => {
    if (generationKey && generationKeyRef.current !== generationKey) {
      generationKeyRef.current = generationKey;
      autoGeneratedRef.current = false;
      requestTokenRef.current += 1;
      if (requestControllerRef.current) {
        requestControllerRef.current.abort();
        requestControllerRef.current = null;
      }
      setGeneratedImage(null);
      setError(null);
      setLoading(false);
      setShowUpgrade(false);
    }
  }, [generationKey]);

  useEffect(() => () => {
    requestTokenRef.current += 1;
    if (requestControllerRef.current) {
      requestControllerRef.current.abort();
      requestControllerRef.current = null;
    }
  }, []);
  
  // Generate illustration
  const handleGenerate = useCallback(async () => {
    if (!config.enabled) {
      setShowUpgrade(true);
      return;
    }
    
    const requestToken = requestTokenRef.current + 1;
    requestTokenRef.current = requestToken;

    setLoading(true);
    setError(null);
    
    if (requestControllerRef.current) {
      requestControllerRef.current.abort();
    }
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch('/api/generate-story-art', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          cards,
          question,
          narrative,
          style,
          format
        })
      });
      
      const data = await response.json();

      if (requestToken !== requestTokenRef.current) return;
      
      if (!response.ok) {
        if (data.upgrade) {
          setShowUpgrade(true);
        } else {
          throw new Error(data.error || 'Generation failed');
        }
        return;
      }
      
      if (!data?.image) {
        throw new Error('No image returned. Please try again.');
      }
      setGeneratedImage(data.image);
      if (onMediaReady) {
        onMediaReady(data.image, {
          source: 'story-art',
          cacheKey: data.cacheKey || null,
          style: data.style || style,
          format: data.artFormat || format,
          mimeType: 'image/jpeg',
          question,
          cardCount: Array.isArray(cards) ? cards.length : 0
        });
      }
      
    } catch (err) {
      if (requestToken !== requestTokenRef.current) return;
      if (err?.name === 'AbortError') {
        setError('Illustration is taking longer than expected. Please try again.');
      } else {
        setError(err.message);
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (requestToken === requestTokenRef.current) {
        requestControllerRef.current = null;
        setLoading(false);
      }
    }
  }, [cards, question, narrative, style, format, config.enabled, onMediaReady]);

  useEffect(() => {
    if (!autoGenerate || autoGeneratedRef.current) return;
    if (!config.enabled) return;
    if (!Array.isArray(cards) || cards.length === 0) return;
    autoGeneratedRef.current = true;
    handleGenerate();
  }, [autoGenerate, cards, config.enabled, handleGenerate]);
  
  // Download image
  const handleDownload = useCallback(() => {
    if (!generatedImage) return;
    
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${generatedImage}`;
    link.download = `tarot-${style}-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [generatedImage, style]);
  
  // Save to journal
  const handleSave = useCallback(() => {
    if (onSaveToJournal && generatedImage) {
      onSaveToJournal({
        image: generatedImage,
        style,
        format
      });
    }
  }, [onSaveToJournal, generatedImage, style, format]);
  
  // Feature not available for tier
  if (!config.enabled && !generatedImage) {
    return (
      <div className="mt-8 p-6 bg-surface/95 backdrop-blur-xl rounded-xl border border-secondary/40">
        <div className="text-center">
          <h3 className="text-lg font-serif text-accent mb-2">
            ✨ Illustrate Your Reading
          </h3>
          <p className="text-muted text-sm mb-4">
            Transform your reading into personalized artwork with AI-generated illustrations.
          </p>
          <button
            onClick={() => setShowUpgrade(true)}
            className="px-6 py-2 bg-gradient-to-r from-primary to-accent 
                       text-surface rounded-lg hover:from-primary/90 hover:to-accent/90
                       transition-all shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Upgrade to Plus
          </button>
        </div>
      </div>
    );
  }
  
  const heroBackground = heroMode && generatedImage ? (
    <HeroBackground image={generatedImage} format={format} activePanel={activePanel} />
  ) : null;

  return (
    <div className="mt-8 p-6 bg-surface/95 backdrop-blur-xl rounded-xl border border-secondary/40 transition-opacity duration-200 ease-out">
      {heroBackground}
      <div className="text-center mb-6">
        <h3 className="text-lg font-serif text-accent mb-1">
          ✨ Illustrate Your Reading
        </h3>
        <p className="text-muted text-sm">
          Transform this reading into personalized artwork
        </p>
      </div>
      
      {!generatedImage && !loading && (
        <div className="space-y-4 transition-opacity duration-200 ease-out">
          {/* Style selector */}
          <div>
            <label className="block text-muted text-xs mb-2 text-center">
              Art Style
            </label>
            <StyleSelector 
              value={style} 
              onChange={setStyle}
              allowedStyles={config.styles}
            />
          </div>
          
          {/* Format selector */}
          <div>
            <label className="block text-muted text-xs mb-2 text-center">
              Format
            </label>
            <FormatSelector 
              value={format} 
              onChange={setFormat}
              allowedFormats={config.formats}
            />
          </div>
          
          {/* Generate button */}
          <div className="pt-2 text-center">
            <button
              onClick={handleGenerate}
              className="px-8 py-3 bg-gradient-to-r from-primary to-accent 
                         text-surface rounded-lg hover:from-primary/90 hover:to-accent/90
                         transition-all shadow-lg text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              Generate Illustration
            </button>
            <p className="text-muted text-xs mt-2">
              Takes 30-60 seconds to create
            </p>
          </div>
        </div>
      )}
      
      {loading && (
        <div className="py-4 transition-opacity duration-200 ease-out">
          <LoadingSkeleton format={format} />
          <p className="text-center text-accent/80 text-sm mt-4">
            Creating your {style} illustration...
          </p>
        </div>
      )}
      
      {generatedImage && (
        <div className="transition-opacity duration-200 ease-out">
          <GeneratedArt
            image={generatedImage}
            format={format}
            style={style}
            onDownload={handleDownload}
            onSave={handleSave}
            canSave={Boolean(onSaveToJournal)}
            showImage={!heroMode}
          />
          
          {/* Regenerate option */}
          <div className="text-center mt-4">
            <button
              onClick={() => setGeneratedImage(null)}
              className="text-muted hover:text-main text-sm underline"
            >
              Try a different style
            </button>
          </div>
        </div>
      )}
      
      {/* Error display */}
      {error && (
        <div className="mt-4 p-3 bg-error/10 border border-error/30 rounded-lg text-center transition-opacity duration-200 ease-out">
          <p className="text-error text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-error hover:text-error/80 text-xs mt-1 underline"
          >
            Dismiss
          </button>
        </div>
      )}
      
      {/* Upgrade modal */}
      {showUpgrade && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-safe pt-safe pb-safe">
          <div className="bg-surface rounded-xl p-6 max-w-md border border-secondary/40 transition-[opacity,transform] duration-200 ease-out">
            <h3 className="text-xl font-serif text-accent mb-3">
              Unlock Story Illustrations
            </h3>
            <p className="text-muted text-sm mb-4">
              Plus subscribers can generate personalized artwork from their readings.
              Pro unlocks all 5 art styles and triptych format.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowUpgrade(false)}
                className="flex-1 px-4 py-2 bg-surface-muted text-main rounded-lg 
                           hover:bg-surface transition-colors border border-secondary/30
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                Maybe Later
              </button>
              <button
                onClick={() => window.location.href = '/pricing'}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-primary to-accent 
                           text-surface rounded-lg hover:from-primary/90 hover:to-accent/90
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                View Plans
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
