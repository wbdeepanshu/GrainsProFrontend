import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook to handle loading of multiple images and track their loading state
 * @param {Array} imageUrls - Array of image URLs to load
 * @param {Object} options - Configuration options
 * @returns {Object} - Loading state and loaded images data
 */
export const useImageLoader = (imageUrls = [], options = {}) => {
  const {
    timeout = 10000, // 10 seconds timeout per image
    retries = 2, // Number of retries for failed images
    crossOrigin = 'anonymous'
  } = options;

  const [loadingStates, setLoadingStates] = useState({});
  const [loadedImages, setLoadedImages] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Load a single image with retry logic
  const loadSingleImage = useCallback(async (url, retryCount = 0) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = crossOrigin;
      
      const timeoutId = setTimeout(() => {
        if (retryCount < retries) {
          // console.log(`Retrying image load (${retryCount + 1}/${retries}):`, url);
          loadSingleImage(url, retryCount + 1).then(resolve);
        } else {
          console.error(`Image load timeout after ${retries} retries:`, url);
          resolve({ url, success: false, error: 'Timeout' });
        }
      }, timeout);

      img.onload = () => {
        clearTimeout(timeoutId);
        try {
          // Create canvas to convert to base64
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Set reasonable max dimensions
          const maxWidth = 800;
          const maxHeight = 600;
          let { width, height } = img;
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          const dataURL = canvas.toDataURL('image/jpeg', 0.8);
          resolve({ 
            url, 
            success: true, 
            dataURL, 
            width, 
            height,
            originalWidth: img.naturalWidth,
            originalHeight: img.naturalHeight
          });
        } catch (error) {
          console.error('Canvas error for image:', url, error);
          resolve({ url, success: false, error: error.message });
        }
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        if (retryCount < retries) {
          // console.log(`Retrying image load (${retryCount + 1}/${retries}):`, url);
          loadSingleImage(url, retryCount + 1).then(resolve);
        } else {
          console.error(`Image load failed after ${retries} retries:`, url);
          resolve({ url, success: false, error: 'Load failed' });
        }
      };

      img.src = url;
    });
  }, [timeout, retries, crossOrigin]);

  // Load all images
  const loadAllImages = useCallback(async () => {
    if (!imageUrls || imageUrls.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadingStates({});
    setLoadedImages({});
    setErrors({});

    // console.log(`Starting to load ${imageUrls.length} images...`);

    // Load images in batches to avoid overwhelming the browser
    const batchSize = 3;
    const results = {};

    for (let i = 0; i < imageUrls.length; i += batchSize) {
      const batch = imageUrls.slice(i, i + batchSize);
      
      // Update loading states for this batch
      const batchStates = {};
      batch.forEach(url => {
        batchStates[url] = 'loading';
      });
      setLoadingStates(prev => ({ ...prev, ...batchStates }));

      // Load batch in parallel
      const batchPromises = batch.map(url => loadSingleImage(url));
      const batchResults = await Promise.all(batchPromises);

      // Process results
      batchResults.forEach(result => {
        if (result.success) {
          results[result.url] = result;
          setLoadedImages(prev => ({ ...prev, [result.url]: result }));
        } else {
          results[result.url] = result;
          setErrors(prev => ({ ...prev, [result.url]: result.error }));
        }
        setLoadingStates(prev => ({ ...prev, [result.url]: result.success ? 'loaded' : 'error' }));
      });

      // Small delay between batches to prevent overwhelming
      if (i + batchSize < imageUrls.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    setIsLoading(false);
    // console.log('All images processed:', results);
    return results;
  }, [imageUrls, loadSingleImage]);

  // Auto-load images when URLs change
  useEffect(() => {
    if (imageUrls && imageUrls.length > 0) {
      loadAllImages();
    }
  }, [imageUrls, loadAllImages]);

  return {
    isLoading,
    loadingStates,
    loadedImages,
    errors,
    loadAllImages,
    // Helper functions
    isImageLoaded: (url) => loadingStates[url] === 'loaded',
    isImageError: (url) => loadingStates[url] === 'error',
    getImageData: (url) => loadedImages[url],
    getError: (url) => errors[url],
    // Statistics
    totalImages: imageUrls?.length || 0,
    loadedCount: Object.values(loadingStates).filter(state => state === 'loaded').length,
    errorCount: Object.values(loadingStates).filter(state => state === 'error').length,
    allLoaded: imageUrls?.length > 0 && Object.values(loadingStates).every(state => state === 'loaded' || state === 'error')
  };
};
