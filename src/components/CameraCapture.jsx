import { useRef, useEffect, useState } from 'react';
import { ImagePreview } from './ImagePreview';
import { useLandscape } from '../hooks/useLandscape';

const hasUuidSupport = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';

const createCaptureId = () => {
  if (hasUuidSupport) {
    return crypto.randomUUID();
  }
  const random = Math.random().toString(36).slice(2, 8);
  return `capture-${Date.now()}-${random}`;
};

export function CameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [error, setError] = useState(null);
  const isLandscape = useLandscape();

  useEffect(() => {
    async function getCameraStream() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setStream(mediaStream);
      } catch (err) {
        console.error('Error accessing camera:', err);
        setError('Could not access the camera. Please ensure permissions are granted and try again.');
      }
    }

    if (!stream) {
      getCameraStream();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const handleCapture = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
      const captureId = createCaptureId();
      file.__visionUploadId = captureId;
      file.__visionLabel = `Camera capture ${new Date().toISOString()}`;
      setCapturedImage(file);
    }, 'image/jpeg');
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture([capturedImage]);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  if (capturedImage) {
    return <ImagePreview image={capturedImage} onConfirm={handleConfirm} onRetake={handleRetake} />;
  }

  // In landscape: controls on right side; in portrait: controls at bottom
  // Using safe-area-inset for notch/Dynamic Island support
  const containerClass = isLandscape
    ? 'fixed inset-0 z-50 flex flex-row items-center justify-center bg-black animate-fade-in'
    : 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-black animate-fade-in';

  return (
    <div className={containerClass}>
      {error ? (
        <div 
          className="text-white text-center p-4"
          style={{
            paddingTop: 'max(1rem, env(safe-area-inset-top))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
            paddingLeft: 'max(1rem, env(safe-area-inset-left))',
            paddingRight: 'max(1rem, env(safe-area-inset-right))'
          }}
        >
          <p className="text-sm xs:text-base">{error}</p>
          <button 
            onClick={onCancel} 
            className="mt-4 px-6 py-3 min-h-[44px] bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition touch-manipulation"
          >
            Close
          </button>
        </div>
      ) : (
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      )}
      
      {/* Controls - positioned with safe area insets */}
      <div 
        className={`
          absolute bg-black/60 backdrop-blur-sm
          flex items-center justify-center
          ${isLandscape 
            ? 'right-0 top-0 bottom-0 flex-col gap-4 xs:gap-6 w-20 xs:w-24' 
            : 'bottom-0 left-0 right-0 flex-row gap-6 xs:gap-8 py-4 xs:py-6'
          }
        `}
        style={isLandscape ? {
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          paddingRight: 'max(0.75rem, env(safe-area-inset-right))'
        } : {
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))'
        }}
      >
        {/* Cancel button - 44px minimum touch target */}
        <button 
          onClick={onCancel} 
          className="min-w-[44px] min-h-[44px] px-4 py-2 text-white text-sm font-medium hover:text-white/80 transition touch-manipulation rounded-lg active:bg-white/10"
        >
          Cancel
        </button>
        
        {/* Capture button - large touch target */}
        <button
          onClick={handleCapture}
          disabled={!stream}
          className={`
            ${isLandscape ? 'w-14 h-14 xs:w-16 xs:h-16' : 'w-16 h-16 xs:w-20 xs:h-20'}
            rounded-full bg-white border-4 border-gray-300 
            disabled:opacity-50 disabled:cursor-not-allowed
            transition touch-manipulation
            active:scale-95 active:border-gray-400
            focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50
          `}
          aria-label="Capture photo"
        />
        
        {/* Spacer for centering in portrait mode */}
        {!isLandscape && <div className="w-14 xs:w-16" aria-hidden="true" />}
      </div>
    </div>
  );
}
