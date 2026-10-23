import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useImageLoader } from '@/hooks/useImageLoader';
import { PDFGenerator } from '@/utils/pdfGenerator';
import { useToast } from '@/hooks/use-toast';

/**
 * PDF Download Button Component
 * Handles PDF generation with proper image loading
 */
const PDFDownloadButton = ({ 
  targetElementId, 
  filename = 'document.pdf',
  buttonText = 'Download PDF',
  variant = 'outline',
  size = 'sm',
  className = '',
  onSuccess,
  onError,
  children,
  ...props 
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const targetRef = useRef(null);
  const { toast } = useToast();

  // Extract image URLs from target element
  const getImageUrls = useCallback(() => {
    if (!targetElementId) return [];
    
    const element = document.getElementById(targetElementId);
    if (!element) return [];
    
    const images = element.querySelectorAll('img');
    return Array.from(images)
      .map(img => img.src)
      .filter(url => url && !url.startsWith('data:image/gif')); // Filter out placeholder images
  }, [targetElementId]);

  const imageUrls = getImageUrls();
  const { 
    isLoading: imagesLoading, 
    loadedCount, 
    errorCount, 
    allLoaded,
    loadedImages 
  } = useImageLoader(imageUrls);

  // Calculate progress
  const totalImages = imageUrls.length;
  const progressPercentage = totalImages > 0 ? Math.round((loadedCount / totalImages) * 100) : 100;

  const handleDownload = async () => {
    try {
      setIsGenerating(true);
      setProgress(0);

      // Get target element
      const targetElement = document.getElementById(targetElementId);
      if (!targetElement) {
        throw new Error('Target element not found');
      }

      // Wait for images to load if not already loaded
      if (!allLoaded && imagesLoading) {
        setProgress(25);
        
        // Wait for images to finish loading
        await new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (allLoaded || !imagesLoading) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });
      }

      setProgress(50);

      // Generate PDF
      const pdfGenerator = new PDFGenerator({
        format: 'a4',
        orientation: 'portrait',
        margin: 20,
        imageQuality: 0.8
      });

      await pdfGenerator.generateFromElement(targetElement, filename, {
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff'
        }
      });

      setProgress(100);

      // Success
      toast({
        title: "PDF Downloaded",
        description: `Document saved as ${filename}`,
      });

      if (onSuccess) {
        onSuccess(filename);
      }

    } catch (error) {
      console.error('PDF generation error:', error);
      
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });

      if (onError) {
        onError(error);
      }
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const getButtonContent = () => {
    if (isGenerating) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Generating PDF... {progress}%</span>
        </>
      );
    }

    if (imagesLoading && totalImages > 0) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading Images... {progressPercentage}%</span>
        </>
      );
    }

    if (errorCount > 0) {
      return (
        <>
          <AlertCircle className="h-4 w-4" />
          <span>Download PDF ({errorCount} images failed)</span>
        </>
      );
    }

    if (allLoaded && totalImages > 0) {
      return (
        <>
          <CheckCircle className="h-4 w-4" />
          <span>{buttonText}</span>
        </>
      );
    }

    return (
      <>
        <Download className="h-4 w-4" />
        <span>{buttonText}</span>
      </>
    );
  };

  const isDisabled = isGenerating || (imagesLoading && totalImages > 0);

  return (
    <Button
      ref={targetRef}
      onClick={handleDownload}
      disabled={isDisabled}
      variant={variant}
      size={size}
      className={`flex items-center space-x-2 ${className}`}
      {...props}
    >
      {children || getButtonContent()}
    </Button>
  );
};

export default PDFDownloadButton;
