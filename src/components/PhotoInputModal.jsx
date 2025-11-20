import React from 'react';

export function PhotoInputModal({ onTakePhoto, onChooseFromLibrary, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-main/90 animate-fade-in">
      <div className="bg-surface rounded-lg shadow-lg p-6 w-full max-w-sm animate-pop-in">
        <h3 className="text-lg font-medium text-main mb-4">Add a Photo</h3>
        <div className="space-y-2">
          <button
            onClick={onTakePhoto}
            className="w-full text-left px-4 py-2 text-white bg-secondary hover:bg-secondary/90 rounded-md"
          >
            Take Photo
          </button>
          <button
            onClick={onChooseFromLibrary}
            className="w-full text-left px-4 py-2 text-white bg-primary hover:bg-primary/90 rounded-md"
          >
            Choose from Library
          </button>
          <button
            onClick={onCancel}
            className="w-full text-left px-4 py-2 mt-4 text-muted hover:text-main"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
