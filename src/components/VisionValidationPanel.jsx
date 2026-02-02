import { useState, useRef, useCallback } from 'react';
import { useVisionValidation } from '../hooks/useVisionValidation';
import { VisionHeatmapOverlay } from './VisionHeatmapOverlay';
import { PhotoInputModal } from './PhotoInputModal';
import { CameraCapture } from './CameraCapture';

/** Maximum number of images allowed for vision validation */
const MAX_UPLOADS = 5;
/** Maximum file size in bytes (10MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;
/** Allowed MIME type prefix */
const ALLOWED_TYPE_PREFIX = 'image/';

/**
 * Validates a file for type and size constraints
 * @param {File} file - File to validate
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateFile(file) {
  if (!file.type.startsWith(ALLOWED_TYPE_PREFIX)) {
    return { valid: false, reason: `"${file.name}" is not an image file` };
  }
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return { valid: false, reason: `"${file.name}" is too large (${sizeMB}MB, max 10MB)` };
  }
  return { valid: true };
}

export function VisionValidationPanel({
  deckStyle = 'rws-1909',
  onResults,
  onRemoveResult,
  onClearResults,
  conflicts = [],
  results = []
}) {
  const { status, error, validateFiles } = useVisionValidation({ deckStyle });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [localError, setLocalError] = useState(null);
  const fileInputRef = useRef(null);
  const uploadLimitReached = results.length >= MAX_UPLOADS;
  const remainingSlots = MAX_UPLOADS - results.length;

  const handleFileChange = useCallback(async (event) => {
    const inputEl = event.target;
    const files = Array.from(inputEl?.files || []);

    // Reset input immediately to allow re-selecting same file
    if (inputEl) inputEl.value = '';

    if (files.length === 0) return;

    // Clear previous local errors
    setLocalError(null);

    // Validate all files
    const validationResults = files.map(validateFile);
    const invalidFiles = validationResults.filter(r => !r.valid);

    if (invalidFiles.length > 0) {
      setLocalError(invalidFiles.map(r => r.reason).join('. '));
      return;
    }

    // Limit files to remaining slots
    const filesToProcess = files.slice(0, remainingSlots);
    if (filesToProcess.length < files.length) {
      setLocalError(`Only ${remainingSlots} slot${remainingSlots !== 1 ? 's' : ''} remaining. ${files.length - filesToProcess.length} file(s) skipped.`);
    }

    if (filesToProcess.length === 0) return;

    try {
      const analyses = await validateFiles(filesToProcess);
      if (analyses.length) {
        onResults?.(analyses);
      }
    } catch (err) {
      setLocalError(`Analysis failed: ${err.message || 'Unknown error'}`);
    }
  }, [validateFiles, onResults, remainingSlots]);

  const handleChooseFromLibrary = () => {
    setIsModalOpen(false);
    fileInputRef.current?.click();
  };

  const handleTakePhoto = () => {
    setIsModalOpen(false);
    setIsCameraOpen(true);
  };

  const handleCapture = async (files) => {
    setIsCameraOpen(false);
    if (!files || files.length === 0) return;
    try {
      const analyses = await validateFiles(files);
      if (analyses.length) {
        onResults?.(analyses);
      }
    } catch (err) {
      console.error('Error processing captured image:', err);
    }
  };

  return (
    <div className="modern-surface border border-primary/30 p-3 xs:p-4 sm:p-5 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-main font-semibold">Vision Research Console</p>
          <p className="text-xs text-muted leading-relaxed">
            Upload card photos to test vision model recognition. Compares uploads against the active deck&rsquo;s embeddings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-secondary">
          {results.length > 0 && (
            <button
              type="button"
              onClick={() => onClearResults?.()}
              className="min-h-touch min-w-touch px-3 py-2 rounded-lg border border-accent/30 text-main/90 hover:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 transition-colors touch-manipulation text-xs xs:text-sm"
            >
              Clear
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
            disabled={uploadLimitReached}
            aria-label="Upload card images for validation"
            aria-describedby={uploadLimitReached ? 'upload-limit-info' : undefined}
          />
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            disabled={uploadLimitReached || status === 'loading'}
            aria-haspopup="dialog"
            aria-expanded={isModalOpen}
            aria-describedby="upload-limit-info"
            className={`min-h-touch min-w-touch px-3 py-2 rounded-lg border border-secondary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 touch-manipulation text-xs xs:text-sm ${
              uploadLimitReached || status === 'loading'
                ? 'opacity-60 cursor-not-allowed'
                : 'hover:border-secondary/70 hover:bg-secondary/10 active:bg-secondary/20'
            }`}
          >
            {status === 'loading'
              ? 'Analyzing…'
              : uploadLimitReached
                ? `Limit reached`
                : `Add Photo${remainingSlots < MAX_UPLOADS ? ` (${remainingSlots})` : ''}`}
          </button>
          <span id="upload-limit-info" className="sr-only">
            {uploadLimitReached
              ? `Maximum ${MAX_UPLOADS} images allowed. Remove an image to add more.`
              : `${remainingSlots} of ${MAX_UPLOADS} upload slots remaining.`}
          </span>
        </div>
      </div>
      {isModalOpen && (
        <PhotoInputModal
          onTakePhoto={handleTakePhoto}
          onChooseFromLibrary={handleChooseFromLibrary}
          onCancel={() => setIsModalOpen(false)}
        />
      )}
      {isCameraOpen && (
        <CameraCapture
          onCapture={handleCapture}
          onCancel={() => setIsCameraOpen(false)}
        />
      )}
      {(error || localError) && (
        <p role="alert" className="mt-2 text-xs text-error">
          {error || localError}
        </p>
      )}
      {conflicts.length > 0 && (
        <div className="mt-3 rounded border border-error/40 bg-error/20 p-3 text-xs text-main">
          <p className="font-semibold">Card mismatch detected</p>
          <p>Please confirm the following cards before generating a reading:</p>
          <ul className="mt-1 list-disc list-inside">
            {conflicts.map((conflict) => (
              <li key={conflict.uploadId || conflict.label || conflict.imagePath}>
                {conflict.label || 'Uploaded image'} was recognized as <strong>{conflict.topMatch?.cardName || 'unknown'}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
      {results.length > 0 && (
        <ul role="list" className="mt-4 space-y-3" aria-label="Vision analysis results">
          {results.map((result) => (
            <li
              key={result.uploadId || result.label || result.imagePath}
              className="rounded border border-secondary/20 p-3"
            >
              <div className="flex items-center justify-between text-sm text-secondary">
                <span className="font-medium">{result.label || 'Uploaded image'}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted">
                    Confidence:{' '}
                    <span className={typeof result.confidence === 'number' && result.confidence >= 0.7 ? 'text-accent' : ''}>
                      {typeof result.confidence === 'number'
                        ? `${(result.confidence * 100).toFixed(1)}%`
                        : 'n/a'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveResult?.(result.uploadId || result.label)}
                    className="min-h-touch min-w-touch px-2 text-sm text-error/80 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/50 rounded transition-colors"
                    aria-label={`Remove ${result.label || 'uploaded image'}`}
                  >
                    Remove
                  </button>
                </div>
              </div>
              {Array.isArray(result.matches) && result.matches.length > 0 && (
                <ul className="mt-2 text-xs text-muted">
                  {result.matches.map((match) => (
                    <li key={`${result.label}-${match.cardName}`}>
                      {match.cardName}
                      {' '}
                      ·
                      {' '}
                      {typeof match.score === 'number' ? `${(match.score * 100).toFixed(1)}%` : 'n/a'}
                    </li>
                  ))}
                </ul>
              )}
              {result.attention?.focusRegions?.length > 0 && (
                <div className="mt-2 text-xs text-secondary/70">
                  <p className="font-semibold text-secondary">Model focus</p>
                  <p className="mb-1 text-muted">Highlight patches where CLIP paid the most attention.</p>
                  <div className="flex flex-wrap gap-2">
                    {result.attention.focusRegions.slice(0, 4).map((region) => (
                      <span
                        key={`${result.label || 'result'}-region-${region.x}-${region.y}`}
                        className="px-2 py-1 rounded-full border border-secondary/30"
                      >
                        ({region.x}, {region.y}) · {(region.intensity * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <VisionHeatmapOverlay
                attention={result.attention}
                imageSrc={result.dataUrl || result.imagePath}
                label={result.label}
              />
              {Array.isArray(result.attention?.symbolAlignment) && result.attention.symbolAlignment.length > 0 && (
                <div className="mt-2 text-xs text-secondary/70">
                  <p className="font-semibold text-secondary">Symbol alignment</p>
                  <ul className="list-disc list-inside space-y-1">
                    {result.attention.symbolAlignment.slice(0, 3).map((symbol) => (
                      <li key={`${result.label || 'result'}-symbol-${symbol.object}`}>
                        {symbol.object}
                        {' '}· focus {(symbol.attentionScore * 100).toFixed(0)}%
                        {symbol.isModelFocused && (
                          <span className="ml-1" aria-label="Model focused on this symbol">✅</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.symbolVerification && (
                <div className="mt-2 text-xs text-secondary/70">
                  <p className="font-semibold text-secondary">Symbol verification</p>
                  <p>
                    Match rate:{' '}
                    <span className={typeof result.symbolVerification.matchRate === 'number' && result.symbolVerification.matchRate >= 0.7 ? 'text-accent' : ''}>
                      {typeof result.symbolVerification.matchRate === 'number'
                        ? `${(result.symbolVerification.matchRate * 100).toFixed(0)}%`
                        : 'n/a'}
                    </span>
                  </p>
                  {Array.isArray(result.symbolVerification.missingSymbols) && result.symbolVerification.missingSymbols.length > 0 && (
                    <p className="mt-1 text-error/80">
                      Missing: {result.symbolVerification.missingSymbols.join(', ')}
                    </p>
                  )}
                  {Array.isArray(result.symbolVerification.unexpectedDetections) && result.symbolVerification.unexpectedDetections.length > 0 && (
                    <p className="mt-1 text-muted">
                      Extra objects: {result.symbolVerification.unexpectedDetections.map((det) => det.label).join(', ')}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
