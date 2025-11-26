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
  const containerClass = isLandscape
    ? 'fixed inset-0 z-50 flex flex-row items-center justify-center bg-black animate-fade-in'
    : 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-black animate-fade-in';

  const controlsClass = isLandscape
    ? 'absolute right-0 top-0 bottom-0 bg-black bg-opacity-50 p-3 flex flex-col justify-center items-center gap-6 w-24'
    : 'absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-4 flex justify-center items-center gap-8';

  const captureButtonSize = isLandscape ? 'w-16 h-16' : 'w-20 h-20';

  return (
    <div className={containerClass}>
      {error ? (
        <div className="text-white text-center p-4">
          <p>{error}</p>
          <button onClick={onCancel} className="mt-4 px-4 py-2 bg-red-600 rounded-md">
            Close
          </button>
        </div>
      ) : (
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      )}
      <div className={controlsClass}>
        <button onClick={onCancel} className="px-4 py-2 text-white text-sm">
          Cancel
        </button>
        <button
          onClick={handleCapture}
          disabled={!stream}
          className={`${captureButtonSize} rounded-full bg-white border-4 border-gray-400 disabled:opacity-50`}
          aria-label="Capture photo"
        />
        {!isLandscape && <div className="w-16"></div>}
      </div>
    </div>
  );
}
