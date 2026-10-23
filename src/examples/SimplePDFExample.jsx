import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import PDFDownloadButton from '@/components/PDFDownloadButton';

/**
 * Simple example of using PDFDownloadButton with your existing page
 */
const SimplePDFExample = () => {
  return (
    <div className="container mx-auto p-6">
      {/* Your existing page content with id="pdf-content" */}
      <div id="pdf-content">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>My Document</span>
              {/* PDF Download Button */}
              <PDFDownloadButton
                targetElementId="pdf-content"
                filename="my-document.pdf"
                buttonText="Download PDF"
                variant="outline"
                size="sm"
                onSuccess={(filename) => {
                  // console.log(`PDF ${filename} downloaded successfully!`);
                }}
                onError={(error) => {
                  console.error('PDF generation failed:', error);
                }}
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <h2 className="text-xl font-semibold mb-4">Document Content</h2>
            <p className="mb-4">
              This is your document content. The PDF download button will wait for all images to load before generating the PDF.
            </p>
            
            {/* Images that will be included in PDF */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <img 
                src="https://picsum.photos/300/200?random=1" 
                alt="Sample 1" 
                className="w-full h-48 object-cover rounded-lg"
              />
              <img 
                src="https://picsum.photos/300/200?random=2" 
                alt="Sample 2" 
                className="w-full h-48 object-cover rounded-lg"
              />
              <img 
                src="https://picsum.photos/300/200?random=3" 
                alt="Sample 3" 
                className="w-full h-48 object-cover rounded-lg"
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Section 1</h3>
              <p>This section contains important information that will be included in the PDF.</p>
              
              <h3 className="text-lg font-semibold">Section 2</h3>
              <p>More content here with additional images below:</p>
              
              <div className="grid grid-cols-2 gap-4">
                <img 
                  src="https://picsum.photos/400/300?random=4" 
                  alt="Detail 1" 
                  className="w-full h-64 object-cover rounded-lg"
                />
                <img 
                  src="https://picsum.photos/400/300?random=5" 
                  alt="Detail 2" 
                  className="w-full h-64 object-cover rounded-lg"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SimplePDFExample;
