import { useCallback, useRef, useState, useEffect } from 'react';
import { generateId } from '../lib/utils';

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getFileLabel(file, fallback) {
  if (file?.__visionLabel && typeof file.__visionLabel === 'string') {
    return file.__visionLabel;
  }
  if (file?.name && typeof file.name === 'string') {
    return file.name;
  }
  return fallback;
}

export function useVisionValidation({ deckStyle = 'rws-1909' } = {}) {
  const pipelineRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  useEffect(() => {
    pipelineRef.current = null;
    setStatus('idle');
    setError(null);
  }, [deckStyle]);

  const ensurePipeline = useCallback(async () => {
    if (!pipelineRef.current) {
      const { createVisionBackend } = await import('../../shared/vision/visionBackends.js');
      const backend = await createVisionBackend({
        backendId: 'clip-default',
        cardScope: 'all',
        deckStyle,
        maxResults: 5
      });
      if (typeof backend.warmup === 'function') {
        await backend.warmup();
      }
      pipelineRef.current = backend;
    }
    return pipelineRef.current;
  }, [deckStyle]);

  const validateFiles = useCallback(async (fileList) => {
    if (!fileList || fileList.length === 0) {
      setError('Please select at least one image.');
      return [];
    }

    setStatus('loading');
    setError(null);

    try {
      const files = Array.from(fileList);
      const uploadsMetadata = files.map((file, index) => ({
        file,
        label: getFileLabel(file, `upload-${index + 1}`),
        uploadId: file?.__visionUploadId || generateId('vision-upload')
      }));
      const dataUrls = await Promise.all(files.map(fileToDataUrl));
      const pipeline = await ensurePipeline();
      const analyses = await pipeline.analyzeImages(
        dataUrls.map((dataUrl, index) => ({
          source: dataUrl,
          label: uploadsMetadata[index].label
        })),
        { includeAttention: true, includeSymbols: true }
      );
      setStatus('success');
      return analyses.map((analysis, index) => ({
        ...analysis,
        userFile: uploadsMetadata[index].file,
        dataUrl: dataUrls[index],
        timestamp: Date.now(),
        uploadId: uploadsMetadata[index].uploadId
      }));
    } catch (err) {
      console.error('Vision validation failed', err);
      setStatus('error');
      setError(err.message || 'Vision validation failed.');
      return [];
    }
  }, [ensurePipeline]);

  return {
    status,
    error,
    validateFiles
  };
}
