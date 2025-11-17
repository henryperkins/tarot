import React from 'react';

export function ImagePreview({ image, onConfirm, onRetake }) {
  const imageUrl = image instanceof File ? URL.createObjectURL(image) : image;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
      <img src={imageUrl} alt="Preview" className="w-full h-full object-contain" />
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-4 flex justify-around items-center">
        <button onClick={onRetake} className="px-6 py-3 text-lg text-white font-semibold">
          Retake
        </button>
        <button
          onClick={onConfirm}
          className="px-6 py-3 text-lg text-white font-semibold bg-emerald-600 hover:bg-emerald-700 rounded-lg"
        >
          Use Photo
        </button>
      </div>
    </div>
  );
}