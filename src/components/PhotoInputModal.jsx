import React from 'react';

export function PhotoInputModal({ onTakePhoto, onChooseFromLibrary, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-sm">
        <h3 className="text-lg font-medium text-white mb-4">Add a Photo</h3>
        <div className="space-y-2">
          <button
            onClick={onTakePhoto}
            className="w-full text-left px-4 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-md"
          >
            Take Photo
          </button>
          <button
            onClick={onChooseFromLibrary}
            className="w-full text-left px-4 py-2 text-white bg-sky-600 hover:bg-sky-700 rounded-md"
          >
            Choose from Library
          </button>
          <button
            onClick={onCancel}
            className="w-full text-left px-4 py-2 mt-4 text-gray-300 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}