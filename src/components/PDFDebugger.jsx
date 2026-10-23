import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InwardPDFGenerator } from '@/utils/inwardPDFGenerator';
import { testAutoTable, testPDFGeneration } from '@/utils/testAutoTable';

/**
 * PDF Debugger Component
 * Helps debug PDF generation issues by testing with sample data
 */
const PDFDebugger = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [error, setError] = useState(null);

  const sampleData = {
    sl_no: 'IW/2025/0017',
    date: '25-10-2025',
    supplier_name: 'Test Supplier',
    vehicle_no: 'TEST123',
    bill_no: 'BILL001',
    status: 'pending',
    tested_by: 'Test Lab Tech',
    tested_date: '25-10-2025 10:43:03',
    approved_by: 'Test Approver',
    approved_date: '25-10-2025 10:44:37'
  };

  const sampleItems = [
    {
      id: 1,
      item_name: 'Test Item 1',
      brand: 'Test Brand',
      unit: 'pkt',
      godown_name: 'Test Godown',
      quality: 'Premium',
      number_of_bags: 100,
      supervisor_name: 'Test Supervisor',
      total_weight: 50.0,
      remarks: 'Test remarks',
      images: [
        {
          id: 1,
          type: 'lab_samples',
          type_display: 'Lab Samples',
          image_url: 'https://picsum.photos/400/300?random=1'
        },
        {
          id: 2,
          type: 'quality_check',
          type_display: 'Quality Check',
          image_url: 'https://picsum.photos/400/300?random=2'
        }
      ]
    },
    {
      id: 2,
      item_name: 'Test Item 2',
      brand: 'Test Brand 2',
      unit: 'kg',
      godown_name: 'Test Godown 2',
      quality: 'Standard',
      number_of_bags: 50,
      supervisor_name: 'Test Supervisor 2',
      total_weight: 25.0,
      remarks: 'Test remarks 2',
      images: []
    }
  ];

  const sampleLabTestParams = [
    {
      id: 1,
      item_id: 1,
      parameter_name: 'Moisture Content',
      pre_testing_value: '12.5',
      post_testing_value: '11.8',
      unit: '%'
    },
    {
      id: 2,
      item_id: 1,
      parameter_name: 'Protein Content',
      pre_testing_value: '24.2',
      post_testing_value: '24.5',
      unit: '%'
    }
  ];

  const testPDFGeneration = async () => {
    setIsGenerating(true);
    setError(null);
    setDebugInfo('Starting PDF generation test...\n');

    try {
      // Log initial data
      setDebugInfo(prev => prev + `Data: ${JSON.stringify(sampleData, null, 2)}\n\n`);
      setDebugInfo(prev => prev + `Items: ${JSON.stringify(sampleItems, null, 2)}\n\n`);

      // Create PDF generator
      const pdfGenerator = new InwardPDFGenerator();
      setDebugInfo(prev => prev + 'PDF generator created successfully\n');

      // Test image loading
      setDebugInfo(prev => prev + 'Testing image loading...\n');
      await pdfGenerator.waitForAllImages();
      setDebugInfo(prev => prev + 'Image loading completed\n');

      // Generate PDF
      setDebugInfo(prev => prev + 'Generating PDF...\n');
      await pdfGenerator.generatePDF(sampleData, sampleItems, sampleLabTestParams, []);
      setDebugInfo(prev => prev + 'PDF generation completed\n');

      // Save PDF
      setDebugInfo(prev => prev + 'Saving PDF...\n');
      pdfGenerator.save('Test_Inward_Entry.pdf');
      setDebugInfo(prev => prev + 'PDF saved successfully!\n');

    } catch (error) {
      console.error('PDF test error:', error);
      setError(error);
      setDebugInfo(prev => prev + `\nERROR: ${error.message}\n`);
      setDebugInfo(prev => prev + `Stack: ${error.stack}\n`);
    } finally {
      setIsGenerating(false);
    }
  };

  const testImageLoading = async () => {
    setDebugInfo('Testing image loading...\n');
    
    try {
      const images = document.querySelectorAll('img');
      setDebugInfo(prev => prev + `Found ${images.length} images on page\n`);
      
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        setDebugInfo(prev => prev + `Image ${i + 1}: ${img.src} - ${img.complete ? 'loaded' : 'loading'}\n`);
      }
    } catch (error) {
      setDebugInfo(prev => prev + `Image test error: ${error.message}\n`);
    }
  };

  const testAutoTableFunction = () => {
    setDebugInfo('Testing autoTable function...\n');
    
    try {
      const result = testAutoTable();
      if (result) {
        setDebugInfo(prev => prev + '✅ autoTable function is working correctly\n');
      } else {
        setDebugInfo(prev => prev + '❌ autoTable function failed\n');
      }
    } catch (error) {
      setDebugInfo(prev => prev + `❌ autoTable test error: ${error.message}\n`);
    }
  };

  const testSimplePDF = () => {
    setDebugInfo('Testing simple PDF generation...\n');
    
    try {
      const result = testPDFGeneration();
      if (result) {
        setDebugInfo(prev => prev + '✅ Simple PDF generation successful\n');
      } else {
        setDebugInfo(prev => prev + '❌ Simple PDF generation failed\n');
      }
    } catch (error) {
      setDebugInfo(prev => prev + `❌ Simple PDF test error: ${error.message}\n`);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>PDF Generation Debugger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={testPDFGeneration} 
              disabled={isGenerating}
              variant="default"
            >
              {isGenerating ? 'Testing...' : 'Test PDF Generation'}
            </Button>
            <Button 
              onClick={testImageLoading} 
              variant="outline"
            >
              Test Image Loading
            </Button>
            <Button 
              onClick={testAutoTableFunction} 
              variant="outline"
            >
              Test autoTable Function
            </Button>
            <Button 
              onClick={testSimplePDF} 
              variant="outline"
            >
              Test Simple PDF
            </Button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-800 mb-2">Error Details:</h3>
              <pre className="text-sm text-red-700 whitespace-pre-wrap">
                {error.message}
                {error.stack && `\n\nStack Trace:\n${error.stack}`}
              </pre>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="font-semibold">Debug Information:</h3>
            <div className="p-4 bg-gray-50 border rounded-lg">
              <pre className="text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                {debugInfo || 'Click "Test PDF Generation" to start debugging...'}
              </pre>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Sample Data Structure:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Badge variant="outline" className="mb-2">Data</Badge>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                  {JSON.stringify(sampleData, null, 2)}
                </pre>
              </div>
              <div>
                <Badge variant="outline" className="mb-2">Items</Badge>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                  {JSON.stringify(sampleItems, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PDFDebugger;
