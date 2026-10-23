import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PDFDownloadButton from '@/components/PDFDownloadButton';
import { useImageLoader } from '@/hooks/useImageLoader';
import { PDFGenerator } from '@/utils/pdfGenerator';

/**
 * Example component demonstrating PDF generation with multiple images
 */
const PDFExample = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sample data with multiple images
  const sampleData = {
    title: "Sample Document with Images",
    sections: [
      {
        id: 1,
        title: "Product Images",
        description: "High-quality product photos",
        images: [
          "https://picsum.photos/400/300?random=1",
          "https://picsum.photos/400/300?random=2",
          "https://picsum.photos/400/300?random=3",
          "https://picsum.photos/400/300?random=4"
        ]
      },
      {
        id: 2,
        title: "Lab Test Results",
        description: "Scientific analysis images",
        images: [
          "https://picsum.photos/400/300?random=5",
          "https://picsum.photos/400/300?random=6"
        ]
      },
      {
        id: 3,
        title: "Documentation",
        description: "Supporting documents",
        images: [
          "https://picsum.photos/400/300?random=7",
          "https://picsum.photos/400/300?random=8",
          "https://picsum.photos/400/300?random=9"
        ]
      }
    ]
  };

  // Extract all image URLs
  const allImageUrls = sampleData.sections.flatMap(section => section.images);
  
  // Use image loader hook
  const {
    isLoading: imagesLoading,
    loadedCount,
    errorCount,
    allLoaded,
    loadedImages,
    isImageLoaded,
    getImageData
  } = useImageLoader(allImageUrls);

  useEffect(() => {
    // Simulate data loading
    setTimeout(() => {
      setData(sampleData);
      setLoading(false);
    }, 1000);
  }, []);

  const handleCustomPDFGeneration = async () => {
    try {
      const pdfGenerator = new PDFGenerator();
      
      // Prepare content with loaded images
      const content = {
        sections: sampleData.sections.map(section => ({
          title: section.title,
          text: section.description,
          images: section.images.map(url => {
            const imageData = getImageData(url);
            return {
              url,
              dataURL: imageData?.dataURL,
              width: imageData?.width,
              height: imageData?.height,
              loaded: isImageLoaded(url)
            };
          })
        }))
      };

      await pdfGenerator.generateCustomPDF(content, 'custom-document.pdf');
    } catch (error) {
      console.error('Custom PDF generation failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div id="pdf-content">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">{data.title}</h1>
          <div className="flex items-center space-x-4">
            <Badge variant="outline">
              {loadedCount} / {allImageUrls.length} images loaded
            </Badge>
            {errorCount > 0 && (
              <Badge variant="destructive">
                {errorCount} images failed
              </Badge>
            )}
            {allLoaded && (
              <Badge variant="default">
                All images ready
              </Badge>
            )}
          </div>
        </div>

        {/* PDF Download Buttons */}
        <div className="mb-8 flex space-x-4">
          <PDFDownloadButton
            targetElementId="pdf-content"
            filename="complete-document.pdf"
            buttonText="Download Complete PDF"
            variant="default"
            size="lg"
          />
          <Button
            onClick={handleCustomPDFGeneration}
            disabled={!allLoaded}
            variant="outline"
            size="lg"
            className="flex items-center space-x-2"
          >
            <span>Download Custom PDF</span>
          </Button>
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          {data.sections.map((section) => (
            <Card key={section.id} className="overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{section.title}</span>
                  <Badge variant="outline">
                    {section.images.length} images
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">{section.description}</p>
                
                {/* Image Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {section.images.map((imageUrl, index) => {
                    const isLoaded = isImageLoaded(imageUrl);
                    const imageData = getImageData(imageUrl);
                    
                    return (
                      <div key={index} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200">
                          {isLoaded ? (
                            <img
                              src={imageData?.dataURL || imageUrl}
                              alt={`${section.title} ${index + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                            </div>
                          )}
                          
                          {/* Error fallback */}
                          <div 
                            className="w-full h-full flex items-center justify-center bg-red-50 text-red-500 text-sm"
                            style={{ display: 'none' }}
                          >
                            Failed to load
                          </div>
                        </div>
                        
                        {/* Loading indicator */}
                        {!isLoaded && (
                          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                            <div className="text-xs text-gray-500">Loading...</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Debug Information */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>Total Images:</strong> {allImageUrls.length}</p>
              <p><strong>Loaded:</strong> {loadedCount}</p>
              <p><strong>Errors:</strong> {errorCount}</p>
              <p><strong>All Loaded:</strong> {allLoaded ? 'Yes' : 'No'}</p>
              <p><strong>Images Loading:</strong> {imagesLoading ? 'Yes' : 'No'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PDFExample;
