import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { InwardPDFGenerator } from '@/utils/inwardPDFGenerator';
import { useToast } from '@/hooks/use-toast';

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
/**
 * Professional PDF Download Button for Inward Details
 * Handles image loading and PDF generation with progress tracking
 */
const InwardPDFButton = ({
  data,
  items,
  labTestParams,
  images,
  filename = null,
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
  const { toast } = useToast();

  const handleDownload = async () => {
    // Validate data
    if (!data) {
      console.error('PDF generation failed: No data provided');
      toast({
        title: "Error",
        description: "No data available for PDF generation",
        variant: "destructive",
      });
      return;
    }

    if (!items || !Array.isArray(items)) {
      console.error('PDF generation failed: No items provided or items is not an array');
      toast({
        title: "Error",
        description: "No items available for PDF generation",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsGenerating(true);
      setProgress(0);

      // Generate filename if not provided
      const pdfFilename = filename || `Inward_Entry_${data.sl_no || 'Unknown'}.pdf`;

      // Create PDF generator
      const pdfGenerator = new InwardPDFGenerator();

      // Update progress
      setProgress(25);

      // Fetch organization and branch information
      let orgInfo = {};
      try {
        // console.log('Fetching organization info from API...');
        // const orgResponse = await fetch('http://192.168.1.118:8094/api/dashboard/', {
        //   method: 'GET',
        //   headers: {
        //     'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        //     'Content-Type': 'application/json',
        //   },
        // });

        const url = `${API_BASE_URL}/api/dashboard/`;
        const orgResponse = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json',
          },
        });


        if (orgResponse.ok) {
          const orgData = await orgResponse.json();

          if (orgData.status === 200 && orgData.data?.user_info) {
            orgInfo = {
              organization: orgData.data.user_info.organization || '',
              branch: orgData.data.user_info.branch || ''
            };
          } else {
            console.warn('Invalid API response structure:', orgData);
          }
        } else {
          console.error('API request failed with status:', orgResponse.status);
        }
      } catch (error) {
        console.error('Failed to fetch organization info:', error);
        // Continue with PDF generation even if org info fails
      }

      setProgress(40);

      // Wait for images to load
      await pdfGenerator.waitForAllImages();
      setProgress(60);

      // Generate PDF with organization info
      await pdfGenerator.generatePDF(data, items, labTestParams, images, orgInfo);
      setProgress(75);

      // Save PDF
      pdfGenerator.save(pdfFilename);
      setProgress(100);

      // Success notification
      toast({
        title: "PDF Downloaded Successfully",
        description: `Inward entry details saved as ${pdfFilename}`,
      });

      if (onSuccess) {
        onSuccess(pdfFilename);
      }

    } catch (error) {
      console.error('PDF generation error details:', {
        error: error,
        message: error.message,
        stack: error.stack,
        data: data,
        items: items
      });

      let errorMessage = "Failed to generate PDF. Please try again.";

      // Provide more specific error messages
      if (error.message) {
        if (error.message.includes('CORS')) {
          errorMessage = "Image loading failed due to CORS policy. Please check image URLs.";
        } else if (error.message.includes('timeout')) {
          errorMessage = "PDF generation timed out. Please try again.";
        } else if (error.message.includes('memory')) {
          errorMessage = "PDF generation failed due to memory issues. Try with fewer images.";
        } else {
          errorMessage = `PDF generation failed: ${error.message}`;
        }
      }

      toast({
        title: "PDF Generation Failed",
        description: errorMessage,
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

    return children || (
      <>
        <Download className="h-4 w-4 " />
        <span>Download PDF</span>
      </>
    );
  };

  const isDisabled = isGenerating || !data || !items;

  return (
    <Button
      onClick={handleDownload}
      disabled={isDisabled}
      // variant={variant}
      size={size}
      className={`flex items-center space-x-2 ${className}`}
      {...props}
    >
      {getButtonContent()}
    </Button>
  );
};

export default InwardPDFButton;
