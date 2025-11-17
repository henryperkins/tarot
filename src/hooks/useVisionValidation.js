import { useCallback, useRef, useState, useEffect } from 'react';

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
      const { TarotVisionPipeline } = await import('../../shared/vision/tarotVisionPipeline.js');
      pipelineRef.current = new TarotVisionPipeline({
        cardScope: 'all',
        deckStyle,
        maxResults: 5
      });
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
      const dataUrls = await Promise.all(files.map(fileToDataUrl));
      const pipeline = await ensurePipeline();
      const analyses = await pipeline.analyzeImages(
        dataUrls.map((dataUrl, index) => ({
          source: dataUrl,
          label: files[index].name
        })),
        { includeAttention: true, includeSymbols: true }
      );
      setStatus('success');
      return analyses.map((analysis, index) => ({
        ...analysis,
        userFile: files[index],
        dataUrl: dataUrls[index],
        timestamp: Date.now()
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
