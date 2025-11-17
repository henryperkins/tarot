import React, { useRef, useEffect, useState } from 'react';
import { ImagePreview } from './ImagePreview';

export function CameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [error, setError] = useState(null);

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

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
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
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-4 flex justify-center items-center gap-8">
        <button onClick={onCancel} className="px-4 py-2 text-white">
          Cancel
        </button>
        <button
          onClick={handleCapture}
          disabled={!stream}
          className="w-20 h-20 rounded-full bg-white border-4 border-gray-400 disabled:opacity-50"
        />
        <div className="w-16"></div>
      </div>
    </div>
  );
}