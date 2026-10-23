import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { FileText, ArrowLeft, Menu, Filter, Truck, Search, Eye, Calendar, CalendarIcon, Package, User, MapPin, Phone, Mail, IndianRupee, Download, Loader2, Building, Receipt, Upload, CheckCircle, XCircle, AlertCircle, RefreshCw, CheckCircle2, Clock, MessageSquare } from "lucide-react";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import SalesInvoiceNotifyModal from "@/components/outward/SalesInvoiceNotifyModal";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { fetchOrgInfo, getOrgInfoSync } from "@/lib/orgInfo";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";

const today = new Date();

const capitalizeFirst = (str) => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const getDeliverySourceType = (note) => {
  if (!note) return "sales_order";
  if (note.outward_purchase_return_id || note.purchase_return_id) return "purchase_return";
  return "sales_order";
};

const getDeliverySourceLabel = (note) => (
  getDeliverySourceType(note) === "purchase_return" ? "Purchase Return" : "Sales Order"
);

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const isDeliveryNoteTallySynced = (note) =>
  Boolean(note?.is_tally_sync ?? note?.is_tally_synced);

const getOutwardEntryId = (note) =>
  note?.outward_entry_id || note?.outward_id || null;

function getIsTallyEnabled() {
  const userData = AuthService.getUserData();
  const rawTallyEnabled =
    userData?.is_tally_enabled ??
    userData?.user_info?.is_tally_enabled ??
    userData?.organization?.is_tally_enabled;
  return !(
    rawTallyEnabled === false ||
    rawTallyEnabled === 0 ||
    rawTallyEnabled === "0" ||
    rawTallyEnabled === "false" ||
    rawTallyEnabled === "False"
  );
}

// Delivery Note Details Component
function DeliveryNoteDetails({ note, onClose, onSyncClick, isSyncing }) {
  const [location, setLocation] = useLocation();
  const [detailsData, setDetailsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPdfLanguageDialogOpen, setIsPdfLanguageDialogOpen] = useState(false);
  const [selectedPdfLanguage, setSelectedPdfLanguage] = useState("en");
  const [isConvertToInvoiceOpen, setIsConvertToInvoiceOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [invoiceFormData, setInvoiceFormData] = useState({
    e_waybill_number: '',
    e_invoice_number: '',
    bill_number: '',
    remarks: '',
    invoice_image: ''
  });
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (!note) return;

    const deliveryNoteId = note.outward_sales_order_id || note.outward_purchase_return_id || note.id;

    // If we have a delivery-note source id, fetch detailed data
    // The API response already includes all necessary data, but we fetch details for consistency
    if (deliveryNoteId) {
      const fetchDetails = async () => {
        setIsLoading(true);
        setError(null);

        try {
          const url = `${import.meta.env.VITE_BASE_URL}/api/sales/delivery-notes/${deliveryNoteId}/`;
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${AuthService.getAccessToken()}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error('Failed to fetch delivery note details');
          }

          const data = await response.json();

          if (data.status && data.status !== 200) {
            throw new Error(data.message || 'Failed to fetch delivery note details');
          }

          if (data.data) {
            // API response structure: items array with base_unit object, total_amount, party_info, organization_info
            const detailsData = {
              ...data.data,
              source_type: getDeliverySourceType(note),
              items: data.data.items || [],
              total_amount: data.data.total_amount || null,
              party_info: data.data.party_info || null,
              organization_info: data.data.organization_info || null,
              // Ensure all fields are properly set - use so_number as fallback for order_id
              order_id: data.data.order_id || data.data.so_number || null,
              so_number: data.data.so_number || data.data.order_id || null,
              order_date: data.data.order_date || null,
              customer_name: data.data.customer_name || null
            };
            setDetailsData(detailsData);
          } else {
            // Fallback to note data from list if details API doesn't return data
            setDetailsData(note);
          }
        } catch (err) {
          setError(err.message);
          toast({
            title: "Error",
            description: err.message || "Failed to load delivery note details",
            variant: "destructive",
          });
          // Fallback to using the note data we already have
          setDetailsData(note);
        } finally {
          setIsLoading(false);
        }
      };

      fetchDetails();
    } else {
      // Use the note data we already have from the list
      setDetailsData(note);
      setIsLoading(false);
    }
  }, [note, toast]);

  // PDF Generation function - same design as Outward Entry Details
  const generatePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      // Dynamically import jsPDF
      const { default: jsPDF } = await import('jspdf');

      // Validate data exists
      const displayData = detailsData || note;
      if (!displayData) {
        throw new Error('No data available to generate PDF');
      }
      const pdfSourceLabel = getDeliverySourceLabel(displayData);

      // Load organization/branch from cache or dashboard API
      let orgName = getOrgInfoSync()?.organization || '';
      let branchName = getOrgInfoSync()?.branch || '';
      if (!orgName || !branchName) {
        const fetched = await fetchOrgInfo();
        orgName = fetched?.organization || orgName;
        branchName = fetched?.branch || branchName;
      }

      // Get user name from localStorage (cp_manager_user_data)
      let generatedBy = '';
      try {
        const userDataStr = localStorage.getItem('cp_manager_user_data');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          generatedBy = userData?.name || '';
        }
      } catch (error) {
        console.error('Error parsing user data from localStorage:', error);
      }

      // Initialize PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const margin = 15; // Margin on all sides
      const contentWidth = pageWidth - (margin * 2);
      let currentY = margin; // Current Y position on page

      // Helper function to check if we need a new page
      const checkPageBreak = (requiredHeight) => {
        if (currentY + requiredHeight > pageHeight - margin) {
          pdf.addPage();
          currentY = margin;
          return true;
        }
        return false;
      };

      // Helper function to add text with word wrap
      const addText = (text, fontSize, isBold = false, color = [0, 0, 0], align = 'left') => {
        if (!text) return currentY;

        try {
          pdf.setFontSize(fontSize);
          pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
          pdf.setTextColor(color[0], color[1], color[2]);

          const lines = pdf.splitTextToSize(String(text), contentWidth);
          const lineHeight = fontSize * 0.4;

          checkPageBreak(lineHeight * lines.length);

          lines.forEach((line) => {
            if (currentY + lineHeight > pageHeight - margin) {
              pdf.addPage();
              currentY = margin;
            }
            const xPos = align === 'center' ? pageWidth / 2 : margin;
            pdf.text(String(line), xPos, currentY, { align });
            currentY += lineHeight;
          });
        } catch (error) {
          console.error('Error adding text to PDF:', error);
        }

        return currentY;
      };

      // Helper function to add a line
      const addLine = () => {
        checkPageBreak(5);
        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 5;
      };

      // Header Section
      if (orgName || branchName) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 64, 175);
        if (orgName) {
          checkPageBreak(8);
          pdf.text(orgName, pageWidth / 2, currentY, { align: 'center' });
          currentY += 6;
        }
        if (branchName) {
          pdf.setFontSize(12);
          pdf.text(branchName, pageWidth / 2, currentY, { align: 'center' });
          currentY += 8;
        }
        addLine();
      }

      // Title
      checkPageBreak(15);
      currentY += 5; // Add top margin to DELIVERY NOTE title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 64, 175);
      pdf.text('DELIVERY NOTE', pageWidth / 2, currentY, { align: 'center' });
      currentY += 8;

      // Entry details
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(107, 114, 128);
      const entryInfo = `Delivery Note: DN-${displayData.bill_no} | Generated by: ${generatedBy || 'N/A'} `;
      addText(entryInfo, 10, false, [107, 114, 128], 'center');
      currentY += 5;
      addLine();

      // Summary Table
      checkPageBreak(30);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);

      const summaryData = [
        [`${pdfSourceLabel}:`, String(displayData.order_id || displayData.so_number || 'N/A'), 'Order Date:', String(displayData.order_date || 'N/A'), 'Outward Date:', String(displayData.outward_date || 'N/A')],
        ['Vehicle No:', String(displayData.vehicle_no || 'N/A'), 'Total Amount:', displayData.total_amount !== null && displayData.total_amount !== undefined ? `${parseFloat(displayData.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'],
      ];

      summaryData.forEach((row) => {
        checkPageBreak(8);

        let xPos = margin;
        const gap = 25; // distance between label and value
        const colWidth = 70; // distance before next column begins

        for (let i = 0; i < row.length; i += 2) {
          pdf.setFont('helvetica', 'bold');
          pdf.text(String(row[i]), xPos, currentY, { align: 'left' });

          pdf.setFont('helvetica', 'normal');
          pdf.text(String(row[i + 1] || ''), xPos + gap, currentY, { align: 'left' });

          xPos += colWidth;
        }

        currentY += 7;
      });

      currentY += 5;

      // Party Information Section - Optimized to 2 rows
      if (displayData.party_info) {
        checkPageBreak(20);
        addLine();
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.text('PARTY INFORMATION', margin, currentY);
        currentY += 8;

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');

        // Row 1: Customer Name, GST Number, Contact, Email
        checkPageBreak(8);
        let xPos = margin;
        const gap = 25;
        const colWidth = 50;

        // Customer Name
        if (displayData.party_info.name) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('Name:', xPos, currentY, { align: 'left' });
          pdf.setFont('helvetica', 'normal');
          pdf.text(String(displayData.party_info.name), xPos + gap, currentY, { align: 'left' });
          xPos += colWidth + 20;
        }

        // GST Number
        if (displayData.party_info.gst_number) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('GST:', xPos, currentY, { align: 'left' });
          pdf.setFont('helvetica', 'normal');
          pdf.text(String(displayData.party_info.gst_number), xPos + gap, currentY, { align: 'left' });
          xPos += colWidth + 20;
        }

        // Contact
        if (displayData.party_info.contact_number) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('Contact:', xPos, currentY, { align: 'left' });
          pdf.setFont('helvetica', 'normal');
          pdf.text(String(displayData.party_info.contact_number), xPos + gap, currentY, { align: 'left' });
        }

        currentY += 7;

        // Row 2: Address (with wrapping), State, City, Pincode
        checkPageBreak(15);
        xPos = margin;

        // Address with wrapping
        if (displayData.party_info.address) {
          pdf.setFont('helvetica', 'bold');
          const addressLabel = 'Address:';
          pdf.text(addressLabel, xPos, currentY, { align: 'left' });

          pdf.setFont('helvetica', 'normal');
          const addressText = String(displayData.party_info.address);
          const labelWidth = pdf.getTextWidth(addressLabel);
          const addressWidth = contentWidth - labelWidth - 10;

          const addressLines = pdf.splitTextToSize(addressText, addressWidth);
          addressLines.forEach((line, lineIdx) => {
            if (lineIdx === 0) {
              pdf.text(line, xPos + labelWidth + 5, currentY, { align: 'left' });
            } else {
              currentY += 4;
              checkPageBreak(4);
              pdf.text(line, xPos + labelWidth + 5, currentY, { align: 'left' });
            }
          });

          const addressHeight = 4 * Math.max(0, addressLines.length - 1);
          currentY += addressHeight;
        }

        // State, City, Pincode on same line after address
        xPos = margin;
        if (displayData.party_info.state) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('State:', xPos, currentY, { align: 'left' });
          pdf.setFont('helvetica', 'normal');
          pdf.text(String(displayData.party_info.state), xPos + gap, currentY, { align: 'left' });
          xPos += colWidth + 15;
        }

        if (displayData.party_info.city) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('City:', xPos, currentY, { align: 'left' });
          pdf.setFont('helvetica', 'normal');
          pdf.text(String(displayData.party_info.city), xPos + gap, currentY, { align: 'left' });
          xPos += colWidth + 15;
        }

        if (displayData.party_info.pincode) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('Pincode:', xPos, currentY, { align: 'left' });
          pdf.setFont('helvetica', 'normal');
          pdf.text(String(displayData.party_info.pincode), xPos + gap, currentY, { align: 'left' });
        }

        currentY += 7;
        currentY += 5;
      }

      // Organization Information Section - Optimized to 2 rows
      if (displayData.organization_info) {
        checkPageBreak(20);
        addLine();
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.text('ORGANIZATION INFORMATION', margin, currentY);
        currentY += 8;

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');

        // Row 1: Organization Name, GST Number, Mobile
        checkPageBreak(8);
        let xPos = margin;
        const gap = 25;
        const colWidth = 50;

        // Organization Name
        if (displayData.organization_info.name) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('Name:', xPos, currentY, { align: 'left' });
          pdf.setFont('helvetica', 'normal');
          pdf.text(String(displayData.organization_info.name), xPos + gap, currentY, { align: 'left' });
          xPos += colWidth + 20;
        }

        // GST Number
        if (displayData.organization_info.gst_number) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('GST:', xPos, currentY, { align: 'left' });
          pdf.setFont('helvetica', 'normal');
          pdf.text(String(displayData.organization_info.gst_number), xPos + gap, currentY, { align: 'left' });
          xPos += colWidth + 20;
        }

        // Mobile
        if (displayData.organization_info.mobile) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('Mobile:', xPos, currentY, { align: 'left' });
          pdf.setFont('helvetica', 'normal');
          pdf.text(String(displayData.organization_info.mobile), xPos + gap, currentY, { align: 'left' });
        }

        currentY += 7;

        // Row 2: Address (with wrapping), State, City, Pincode
        checkPageBreak(15);
        xPos = margin;

        // Address with wrapping
        if (displayData.organization_info.address) {
          pdf.setFont('helvetica', 'bold');
          const addressLabel = 'Address:';
          pdf.text(addressLabel, xPos, currentY, { align: 'left' });

          pdf.setFont('helvetica', 'normal');
          const addressText = String(displayData.organization_info.address);
          const labelWidth = pdf.getTextWidth(addressLabel);
          const addressWidth = contentWidth - labelWidth - 10;

          const addressLines = pdf.splitTextToSize(addressText, addressWidth);
          addressLines.forEach((line, lineIdx) => {
            if (lineIdx === 0) {
              pdf.text(line, xPos + labelWidth + 5, currentY, { align: 'left' });
            } else {
              currentY += 4;
              checkPageBreak(4);
              pdf.text(line, xPos + labelWidth + 5, currentY, { align: 'left' });
            }
          });

          const addressHeight = 4 * Math.max(0, addressLines.length - 1);
          currentY += addressHeight;
        }

        // State, City, Pincode on same line after address
        xPos = margin;
        if (displayData.organization_info.state) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('State:', xPos, currentY, { align: 'left' });
          pdf.setFont('helvetica', 'normal');
          pdf.text(String(displayData.organization_info.state), xPos + gap, currentY, { align: 'left' });
          xPos += colWidth + 15;
        }

        if (displayData.organization_info.city) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('City:', xPos, currentY, { align: 'left' });
          pdf.setFont('helvetica', 'normal');
          pdf.text(String(displayData.organization_info.city), xPos + gap, currentY, { align: 'left' });
          xPos += colWidth + 15;
        }

        if (displayData.organization_info.pincode) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('Pincode:', xPos, currentY, { align: 'left' });
          pdf.setFont('helvetica', 'normal');
          pdf.text(String(displayData.organization_info.pincode), xPos + gap, currentY, { align: 'left' });
        }

        currentY += 7;
        currentY += 5;
      }

      // Items Section - Table format with 4 columns only
      if (displayData.items && displayData.items.length > 0) {
        checkPageBreak(20);
        addLine();
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 64, 175);
        pdf.text(`ITEMS (${displayData.items.length})`, margin, currentY);
        currentY += 8;

        // Calculate column widths for 4 columns: Item Name (40%), Loaded Quantity (20%), Rate (20%), Amount (20%)
        const col1Width = contentWidth * 0.40; // Item Name
        const col2Width = contentWidth * 0.20; // Loaded Quantity
        const col3Width = contentWidth * 0.20; // Rate
        const col4Width = contentWidth * 0.20; // Amount

        const rowHeight = 8; // Height of each row
        const headerHeight = 7; // Height of header row

        // Table header with borders
        const headerY = currentY;
        pdf.setFillColor(30, 64, 175);
        pdf.rect(margin, headerY - 4, contentWidth, headerHeight, 'F');

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(255, 255, 255);

        // Header text with proper padding - prevent overlap
        pdf.text('Item Name', margin + 4, headerY + 1, { align: 'left' });
        pdf.text('Loaded Quantity', margin + col1Width + 4, headerY + 1, { align: 'left' });
        pdf.text('Rate', margin + col1Width + col2Width + 4, headerY + 1, { align: 'left' });
        pdf.text('Amount', margin + col1Width + col2Width + col3Width + 4, headerY + 1, { align: 'left' });

        // Draw header border and vertical lines
        pdf.setDrawColor(30, 64, 175);
        pdf.setLineWidth(0.5);
        pdf.rect(margin, headerY - 4, contentWidth, headerHeight, 'S');
        // Vertical lines in header
        pdf.line(margin + col1Width, headerY - 4, margin + col1Width, headerY - 4 + headerHeight);
        pdf.line(margin + col1Width + col2Width, headerY - 4, margin + col1Width + col2Width, headerY - 4 + headerHeight);
        pdf.line(margin + col1Width + col2Width + col3Width, headerY - 4, margin + col1Width + col2Width + col3Width, headerY - 4 + headerHeight);

        currentY = headerY + headerHeight;
        pdf.setTextColor(0, 0, 0);

        // Items rows with proper table borders - prevent text overlap
        displayData.items.forEach((item, index) => {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);

          const itemName = String(item.item_name || 'N/A');
          const loadedQty = item.loaded_quantity !== null && item.loaded_quantity !== undefined
            ? `${item.loaded_quantity}${item.base_unit?.name ? ` ${item.base_unit.name}` : ''}`
            : 'N/A';
          const rate = item.rate !== null && item.rate !== undefined
            ? `${parseFloat(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${item.base_unit?.name ? ` / ${item.base_unit.name}` : ''}`
            : 'N/A';
          const alternateRate = item.alternate_rate && item.alternate_unit?.name
            ? `${parseFloat(item.alternate_rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${item.alternate_unit.name}`
            : null;
          const amount = item.total_amount !== null && item.total_amount !== undefined
            ? `${parseFloat(item.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : 'N/A';

          // Calculate item name height (handle wrapping)
          const itemNameLines = pdf.splitTextToSize(itemName, col1Width - 8);
          // Add extra height if alternate rate exists
          const alternateRateHeight = alternateRate ? 4 : 0;
          const actualRowHeight = Math.max(rowHeight, (itemNameLines.length * 4) + 2 + alternateRateHeight);

          checkPageBreak(actualRowHeight + 2);

          const rowY = currentY;

          // Draw row border
          pdf.setDrawColor(200, 200, 200);
          pdf.setLineWidth(0.2);
          pdf.rect(margin, rowY - 3, contentWidth, actualRowHeight, 'S');

          // Draw vertical lines between columns
          pdf.line(margin + col1Width, rowY - 3, margin + col1Width, rowY - 3 + actualRowHeight);
          pdf.line(margin + col1Width + col2Width, rowY - 3, margin + col1Width + col2Width, rowY - 3 + actualRowHeight);
          pdf.line(margin + col1Width + col2Width + col3Width, rowY - 3, margin + col1Width + col2Width + col3Width, rowY - 3 + actualRowHeight);

          pdf.setTextColor(0, 0, 0);

          // Item Name - left aligned with padding (handle multi-line) - prevent overlap
          itemNameLines.forEach((line, lineIdx) => {
            pdf.text(line, margin + 4, rowY + 1 + (lineIdx * 4), { align: 'left' });
          });

          // Loaded Quantity - left aligned with padding (center vertically if item name wraps)
          const qtyY = rowY + 1 + (itemNameLines.length > 1 ? (itemNameLines.length - 1) * 2 : 0);
          pdf.text(loadedQty, margin + col1Width + 4, qtyY, { align: 'left' });

          // Rate - left aligned with padding (center vertically if item name wraps) - same font as Loaded Quantity
          pdf.text(rate, margin + col1Width + col2Width + 4, qtyY, { align: 'left' });

          // Alternate Rate - below the main rate if available
          if (alternateRate) {
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            pdf.text(alternateRate, margin + col1Width + col2Width + 4, qtyY + 4, { align: 'left' });
            pdf.setFontSize(10);
            pdf.setTextColor(0, 0, 0);
          }

          // Amount - left aligned with padding (center vertically if item name wraps) - same font as Loaded Quantity
          pdf.text(amount, margin + col1Width + col2Width + col3Width + 4, qtyY, { align: 'left' });

          currentY += actualRowHeight;
        });

        // Draw bottom border of table
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.line(margin, currentY - 3, margin + contentWidth, currentY - 3);

        currentY += 8;

        // Grand Total
        if (displayData.total_amount !== null && displayData.total_amount !== undefined) {
          checkPageBreak(10);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(12);
          pdf.setTextColor(16, 185, 129);
          const totalText = `Grand Total: ${parseFloat(displayData.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          pdf.text(totalText, pageWidth - margin, currentY, { align: 'right' });
          currentY += 8;
        }
      }

      // Footer
      checkPageBreak(10);
      addLine();
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(107, 114, 128);
      const footerText = `Generated on ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })} | ${pdfSourceLabel} #${displayData.order_id || displayData.so_number || 'N/A'}`;
      pdf.text(footerText, pageWidth / 2, currentY, { align: 'center' });

      // Download the PDF
      pdf.save(`delivery-note-${displayData.order_id || displayData.so_number || 'note'}-${new Date().toISOString().split('T')[0]}.pdf`);

      toast({
        title: "PDF Downloaded",
        description: "Delivery note has been downloaded as PDF",
        variant: "success",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      });
      toast({
        title: "Error",
        description: error?.message || "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Handle convert to invoice
  const handleConvertToInvoice = async () => {
    if (!displayData || !displayData.items || displayData.items.length === 0) {
      toast({
        title: "Error",
        description: "No items found to convert",
        variant: "destructive",
      });
      return;
    }

    const outward_sales_order_id = note.outward_sales_order_id || note.id;
    if (getDeliverySourceType(note) === "purchase_return") {
      toast({
        title: "Not Available",
        description: "Invoice conversion is currently available for Sales Order delivery notes only.",
        variant: "destructive",
      });
      return;
    }
    if (!outward_sales_order_id) {
      toast({
        title: "Error",
        description: "Invalid delivery note ID",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingInvoice(true);
    try {
      // Prepare invoice data for entire sales order
      const invoiceData = {
        e_waybill_number: invoiceFormData.e_waybill_number || '',
        e_invoice_number: invoiceFormData.e_invoice_number || '',
        bill_number: invoiceFormData.bill_number || '',
        remarks: invoiceFormData.remarks || '',
        invoice_image: invoiceFormData.invoice_image || ''
      };

      const url = `${import.meta.env.VITE_BASE_URL}/api/sales/convert-to-invoice/${outward_sales_order_id}/`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AuthService.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoiceData),
      });

      const data = await response.json();

      // Handle partial success (207) or errors
      if (!response.ok || (data.status && data.status !== 200 && data.status !== 207)) {
        // Show detailed error messages if available
        let errorMessage = data.message || 'Failed to convert delivery note to invoice';
        if (data.data && data.data.errors && data.data.errors.length > 0) {
          errorMessage += `\n\nErrors:\n${data.data.errors.slice(0, 3).join('\n')}`;
          if (data.data.errors.length > 3) {
            errorMessage += `\n... and ${data.data.errors.length - 3} more error(s)`;
          }
        }
        throw new Error(errorMessage);
      }

      // Handle partial success (207 status)
      if (data.status === 207) {
        toast({
          title: "Partial Success",
          description: data.message || `Successfully converted ${data.data?.total_processed || 0} item(s), ${data.data?.total_failed || 0} item(s) failed`,
          variant: "destructive",
        });
      } else {
        // Full success
        toast({
          title: "Success",
          description: data.message || `Successfully converted ${data.data?.total_items_processed || 0} item(s) to invoice`,
          variant: "success",
        });
      }

      // Close the dialog and refresh details
      setIsConvertToInvoiceOpen(false);
      setInvoiceFormData({
        e_waybill_number: '',
        e_invoice_number: '',
        bill_number: '',
        remarks: '',
        invoice_image: ''
      });

      // Refresh the details data
      if (outward_sales_order_id) {
        const detailsUrl = `${import.meta.env.VITE_BASE_URL}/api/sales/delivery-notes/${outward_sales_order_id}/`;
        const detailsResponse = await fetch(detailsUrl, {
          headers: {
            'Authorization': `Bearer ${AuthService.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
        });
        if (detailsResponse.ok) {
          const detailsData = await detailsResponse.json();
          if (detailsData.data) {
            setDetailsData(detailsData.data);
          }
        }
      }
    } catch (error) {
      console.error('Error converting to invoice:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to convert delivery note to invoice",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingInvoice(false);
    }
  };

  // Handle image upload for invoice
  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image size should be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      setInvoiceFormData(prev => ({
        ...prev,
        invoice_image: base64String
      }));
    };
    reader.readAsDataURL(file);
  };

  if (!note) return null;

  const displayData = {
    ...(detailsData || note || {}),
    is_tally_sync: isDeliveryNoteTallySynced(note) || isDeliveryNoteTallySynced(detailsData),
    is_tally_synced: isDeliveryNoteTallySynced(note) || isDeliveryNoteTallySynced(detailsData),
  };
  const sourceType = getDeliverySourceType(displayData);
  const sourceLabel = sourceType === "purchase_return" ? "Purchase Return" : "Sales Order";
  const sourceId = displayData.order_id || displayData.so_number || "N/A";
  const canConvertToInvoice = sourceType === "sales_order";
  const isTallyEnabled = getIsTallyEnabled();

  return (
    <>
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Delivery Note - {sourceLabel}: {sourceId}
            </div>
            <div className="flex items-center gap-2">
              {displayData && isTallyEnabled && (
                <>
                  {isDeliveryNoteTallySynced(displayData) ? (
                    <Badge className="flex items-center space-x-1 text-xs">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Synced</span>
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="flex items-center space-x-1 text-xs">
                      <Clock className="h-3 w-3" />
                      <span>Not Synced</span>
                    </Badge>
                  )}
                  {!isDeliveryNoteTallySynced(displayData) && onSyncClick && (
                    <Button
                      size="sm"
                      onClick={() => onSyncClick(displayData)}
                      disabled={isSyncing}
                      className="flex items-center gap-2"
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Sync to Tally
                        </>
                      )}
                    </Button>
                  )}
                  {displayData.is_converted_to_invoice && (
                    <Badge className="bg-green-100 text-green-800 border-green-200 mr-2">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Invoice Created
                    </Badge>
                  )}
                  {displayData.invoice_status === 'partial' && !displayData.is_converted_to_invoice && (
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 mr-2">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      Partial Invoice
                    </Badge>
                  )}
                </>
              )}
              {displayData && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setNotifyOpen(true)}
                    disabled={sourceType !== "sales_order" || isLoading}
                    className="flex items-center gap-2"
                    title="Notify customer on WhatsApp / SMS"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Notify
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setIsPdfLanguageDialogOpen(true)}
                    className="flex items-center gap-2 mr-6"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                </>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <CommonLoader />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600">{error}</p>
          </div>
        ) : displayData ? (
          <div className="space-y-4">
            {/* Basic Information and Organization Information - Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="px-4 py-2.5 border-b bg-gray-50 rounded-t-lg">
                  <CardTitle className="text-sm font-semibold text-gray-800">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">{sourceLabel}</Label>
                    <p className="text-base font-semibold">{sourceId}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Order Date</Label>
                    <p className="text-base">{displayData.order_date || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Gate Pass No</Label>
                    <p className="text-base">{displayData.bill_no}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Outward Date</Label>
                    <p className="text-base">{displayData.outward_date || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Vehicle Number</Label>
                    <p className="text-base">{displayData.vehicle_no}</p>
                  </div>
                  {isTallyEnabled && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Tally Status</Label>
                      <div className="mt-1">
                        {isDeliveryNoteTallySynced(displayData) ? (
                          <Badge className="flex items-center space-x-1 text-xs w-fit">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Synced</span>
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="flex items-center space-x-1 text-xs w-fit">
                            <Clock className="h-3 w-3" />
                            <span>Not Synced</span>
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                  {displayData.total_amount !== null && displayData.total_amount !== undefined && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Total Amount</Label>
                      <p className="text-base font-semibold text-green-600">
                        ₹{parseFloat(displayData.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {displayData.organization_info && (
                <Card>
                  <CardHeader className="px-4 py-2.5 border-b bg-gray-50 rounded-t-lg">
                    <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Organization Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Organization Name</Label>
                        <p className="font-semibold">{displayData.organization_info.name || 'N/A'}</p>
                      </div>
                      {displayData.organization_info.gst_number && (
                        <div>
                          <Label className="text-sm font-medium text-gray-600">GST Number</Label>
                          <p>{displayData.organization_info.gst_number}</p>
                        </div>
                      )}
                    </div>

                    {displayData.organization_info.address && (
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Address</Label>
                        <p className="text-sm">{displayData.organization_info.address}</p>
                      </div>
                    )}
                    {(displayData.organization_info.state ||
                      displayData.organization_info.city ||
                      displayData.organization_info.pincode) && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {displayData.organization_info.state && (
                          <div>
                            <Label className="text-sm font-medium text-gray-600">State</Label>
                            <p>{displayData.organization_info.state}</p>
                          </div>
                        )}
                        {displayData.organization_info.city && (
                          <div>
                            <Label className="text-sm font-medium text-gray-600">City</Label>
                            <p>{displayData.organization_info.city}</p>
                          </div>
                        )}
                        {displayData.organization_info.pincode && (
                          <div>
                            <Label className="text-sm font-medium text-gray-600">Pincode</Label>
                            <p>{displayData.organization_info.pincode}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Party Information - Full Width */}
            {displayData.party_info && (
              <Card>
                <CardHeader className="px-4 py-2.5 border-b bg-gray-50 rounded-t-lg">
                  <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Party Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <Label className="text-sm font-medium text-gray-600">Customer Name</Label>
                      <p className="font-semibold break-words">{displayData.party_info.name || 'N/A'}</p>
                    </div>
                    {displayData.party_info.gst_number && (
                      <div className="min-w-0">
                        <Label className="text-sm font-medium text-gray-600">GST Number</Label>
                        <p className="break-all">{displayData.party_info.gst_number}</p>
                      </div>
                    )}
                    {displayData.party_info.contact_number && (
                      <div className="min-w-0">
                        <Label className="text-sm font-medium text-gray-600 flex items-center gap-1">
                          <Phone className="h-4 w-4 shrink-0" />
                          Contact Number
                        </Label>
                        <p>{displayData.party_info.contact_number}</p>
                      </div>
                    )}
                    {displayData.party_info.email && (
                      <div className="min-w-0">
                        <Label className="text-sm font-medium text-gray-600 flex items-center gap-1">
                          <Mail className="h-4 w-4" />
                          Email
                        </Label>
                        <p className="break-all">{displayData.party_info.email}</p>
                      </div>
                    )}
                  </div>

                  {displayData.party_info.address && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Address</Label>
                      <p className="text-sm">{displayData.party_info.address}</p>
                    </div>
                  )}
                  {(displayData.party_info.state ||
                    displayData.party_info.city ||
                    displayData.party_info.pincode) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {displayData.party_info.state && (
                        <div>
                          <Label className="text-sm font-medium text-gray-600">State</Label>
                          <p>{displayData.party_info.state}</p>
                        </div>
                      )}
                      {displayData.party_info.city && (
                        <div>
                          <Label className="text-sm font-medium text-gray-600">City</Label>
                          <p>{displayData.party_info.city}</p>
                        </div>
                      )}
                      {displayData.party_info.pincode && (
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Pincode</Label>
                          <p>{displayData.party_info.pincode}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {(displayData.party_info.shipping_address ||
                    displayData.party_info.shipping_city ||
                    displayData.party_info.shipping_state ||
                    displayData.party_info.shipping_pincode) && (
                      <div className="space-y-3 border-t pt-3">
                        {displayData.party_info.shipping_address && (
                          <div>
                            <Label className="text-sm font-medium text-gray-600">Shipping Address</Label>
                            <p className="text-sm">{displayData.party_info.shipping_address}</p>
                          </div>
                        )}
                        {(displayData.party_info.shipping_state ||
                          displayData.party_info.shipping_city ||
                          displayData.party_info.shipping_pincode) && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {displayData.party_info.shipping_state && (
                              <div>
                                <Label className="text-sm font-medium text-gray-600">State</Label>
                                <p>{displayData.party_info.shipping_state}</p>
                              </div>
                            )}
                            {displayData.party_info.shipping_city && (
                              <div>
                                <Label className="text-sm font-medium text-gray-600">City</Label>
                                <p>{displayData.party_info.shipping_city}</p>
                              </div>
                            )}
                            {displayData.party_info.shipping_pincode && (
                              <div>
                                <Label className="text-sm font-medium text-gray-600">Pincode</Label>
                                <p>{displayData.party_info.shipping_pincode}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                </CardContent>
              </Card>
            )}

            {/* Items Information */}
            {displayData.items && displayData.items.length > 0 && (
              <Card>
                <CardHeader className="px-4 py-2.5 border-b bg-gray-50 rounded-t-lg">
                  <CardTitle className="text-sm font-semibold text-gray-800">
                    Items ({displayData.items.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Name</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Loaded</TableHead>
                          <TableHead>Weight</TableHead>
                          <TableHead>Rate</TableHead>
                          <TableHead>Alt. Rate</TableHead>
                          <TableHead>Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayData.items && displayData.items.length > 0 ? (
                          displayData.items.map((item, index) => {
                            // API response structure: total_quantity, loaded_quantity, base_unit object with id and name
                            const totalQty = item.total_quantity ?? null;
                            const loadedQty = item.loaded_quantity ?? null;
                            // base_unit is an object: { id: number, name: string }
                            const baseUnitName = item.base_unit?.name || '';
                            // Rate can be null if not found in sales order (when outward entry has no linked sales order)
                            const rate = item.rate !== null && item.rate !== undefined ? parseFloat(item.rate) : null;
                            // Total amount can be null if rate is null
                            const totalAmount = item.total_amount !== null && item.total_amount !== undefined ? parseFloat(item.total_amount) : null;

                            return (
                              <TableRow key={item.id || index}>
                                <TableCell className="font-medium">{item.item_name || 'N/A'}</TableCell>
                                <TableCell>
                                  {totalQty !== null && totalQty !== undefined ? `${totalQty}${baseUnitName ? ` ${baseUnitName}` : ''}` : 'N/A'}
                                </TableCell>
                                <TableCell>
                                  {loadedQty !== null && loadedQty !== undefined ? `${loadedQty}${baseUnitName ? ` ${baseUnitName}` : ''}` : 'N/A'}
                                </TableCell>
                                <TableCell>
                                  {item.total_loaded_weight} {item.alternate_unit?.name }
                                </TableCell>
                                <TableCell>
                                  {rate !== null ? (
                                    `₹${rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${baseUnitName ? ` / ${baseUnitName}` : ''}`
                                  ) : 'N/A'}
                                </TableCell>
                                <TableCell>
                                  {item.alternate_rate && item.alternate_unit?.name ? (
                                    `₹${parseFloat(item.alternate_rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${item.alternate_unit.name}`
                                  ) : '-'}
                                </TableCell>
                                <TableCell className="font-semibold">
                                  {totalAmount !== null ? (
                                    `₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  ) : 'N/A'}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-gray-500 py-4">
                              No items found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {displayData.total_amount !== null && displayData.total_amount !== undefined && (
                    <div className="mt-4 pt-4 border-t flex justify-end">
                      <div className="text-right">
                        <Label className="text-sm font-medium text-gray-600">Grand Total</Label>
                        <p className="text-2xl font-bold text-green-600">
                          ₹{parseFloat(displayData.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        ) : null}
      </DialogContent>

      {/* Convert to Invoice Dialog */}
      <Dialog open={isConvertToInvoiceOpen} onOpenChange={setIsConvertToInvoiceOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Convert to Invoice - {sourceLabel}: {displayData?.order_id || displayData?.so_number || 'N/A'}
            </DialogTitle>
          </DialogHeader>

          {displayData && displayData.items && displayData.items.length > 0 ? (
            <div className="space-y-4 mt-4">
              <div className="text-sm text-gray-600 mb-4">
                Fill in the invoice details for the selected source. These details will be applied to all {displayData.items.length} completed item(s).
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Invoice Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="ewaybill">E-Waybill Number</Label>
                      <Input
                        id="ewaybill"
                        value={invoiceFormData.e_waybill_number || ''}
                        onChange={(e) => {
                          setInvoiceFormData(prev => ({
                            ...prev,
                            e_waybill_number: e.target.value
                          }));
                        }}
                        placeholder="Enter e-waybill number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="einvoice">E-Invoice Number</Label>
                      <Input
                        id="einvoice"
                        value={invoiceFormData.e_invoice_number || ''}
                        onChange={(e) => {
                          setInvoiceFormData(prev => ({
                            ...prev,
                            e_invoice_number: e.target.value
                          }));
                        }}
                        placeholder="Enter e-invoice number"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bill">Bill Number</Label>
                      <Input
                        id="bill"
                        value={invoiceFormData.bill_number || ''}
                        onChange={(e) => {
                          setInvoiceFormData(prev => ({
                            ...prev,
                            bill_number: e.target.value
                          }));
                        }}
                        placeholder="Enter bill number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="image">Invoice Image (Optional)</Label>
                      <Input
                        id="image"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="cursor-pointer"
                      />
                      {invoiceFormData.invoice_image && (
                        <p className="text-xs text-green-600 mt-1">Image uploaded successfully</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="remarks">Remarks</Label>
                    <Textarea
                      id="remarks"
                      value={invoiceFormData.remarks || ''}
                      onChange={(e) => {
                        setInvoiceFormData(prev => ({
                          ...prev,
                          remarks: e.target.value
                        }));
                      }}
                      placeholder="Enter remarks (optional)"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This will create/update invoice details for all {displayData.items.length} completed item(s) in {sourceLabel} {displayData?.order_id || displayData?.so_number || 'N/A'}.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsConvertToInvoiceOpen(false);
                    setInvoiceFormData({
                      e_waybill_number: '',
                      e_invoice_number: '',
                      bill_number: '',
                      remarks: '',
                      invoice_image: ''
                    });
                  }}
                  disabled={isSubmittingInvoice}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConvertToInvoice}
                  disabled={isSubmittingInvoice}
                  className="flex items-center gap-2"
                >
                  {isSubmittingInvoice ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <Receipt className="h-4 w-4" />
                      Convert to Invoice
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No items found to convert
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isPdfLanguageDialogOpen} onOpenChange={setIsPdfLanguageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select PDF Language</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose a language for Delivery Note PDF. Numbers and codes remain unchanged.
            </p>
            <Select value={selectedPdfLanguage} onValueChange={setSelectedPdfLanguage}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="kn">Kannada (ಕನ್ನಡ)</SelectItem>
                <SelectItem value="hi">Hindi (हिंदी)</SelectItem>
                <SelectItem value="gu">Gujarati (ગુજરાતી)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsPdfLanguageDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const noteId = note?.outward_sales_order_id || note?.outward_purchase_return_id || note?.id;
                  setIsPdfLanguageDialogOpen(false);
                  setLocation(`/outward/delivery-note-pdf?id=${noteId}&lang=${selectedPdfLanguage || "en"}`);
                }}
              >
                Download
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>

      <SalesInvoiceNotifyModal
        open={notifyOpen && Boolean(displayData) && sourceType === "sales_order"}
        onClose={() => setNotifyOpen(false)}
        detail={{
          ...displayData,
          id:
            displayData.outward_entry_id ||
            displayData.outward_id ||
            displayData.id,
          outward_entry_id:
            displayData.outward_entry_id ||
            displayData.outward_id ||
            getOutwardEntryId(note) ||
            displayData.id,
          outward_sales_order_id:
            displayData.outward_sales_order_id || note?.outward_sales_order_id,
          sales_order_id:
            displayData.sales_order_id ||
            displayData.order_id ||
            displayData.so_number,
          party: displayData.party || {
            customer_name:
              displayData.party_info?.name || displayData.customer_name,
            name: displayData.party_info?.name || displayData.customer_name,
            contact_number: displayData.party_info?.contact_number,
            whatsapp_number:
              displayData.party_info?.whatsapp_number ||
              displayData.party_info?.contact_number,
            address: displayData.party_info?.address,
          },
          organization:
            displayData.organization ||
            displayData.organization_info ||
            displayData.organization_details,
        }}
        onSuccess={(result) => {
          toast({
            title: "Notification sent",
            description:
              result?.message ||
              "Customer notified on the selected channel(s).",
            variant: "success",
          });
        }}
        onError={(message) => {
          toast({
            title: "Notify failed",
            description: message || "Failed to notify customer",
            variant: "destructive",
          });
        }}
      />
    </>
  );
}

export default function DeliveryNotes() {
  const isTallyEnabled = getIsTallyEnabled();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isVoucherDialogOpen, setIsVoucherDialogOpen] = useState(false);
  const [noteToSync, setNoteToSync] = useState(null);
  const [selectedVoucherType, setSelectedVoucherType] = useState(null);
  const [voucherTypeSearchTerm, setVoucherTypeSearchTerm] = useState("");

  // Initialize with URL parameters if available
  const getInitialValues = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromDateParam = urlParams.get('from_date');
    const toDateParam = urlParams.get('to_date');
    const hasUrlDates = !!(fromDateParam && toDateParam);
    const now = new Date();
    const todayStr = format(startOfDay(now), "yyyy-MM-dd");

    return {
      fromDate: fromDateParam || todayStr,
      toDate: toDateParam || todayStr,
      dateRangePreset: hasUrlDates ? "custom" : "today", // "today" | "weekly" | "monthly" | "custom"
    };
  };

  const initialValues = getInitialValues();
  const [filters, setFilters] = useState({
    fromDate: initialValues.fromDate,
    toDate: initialValues.toDate,
    searchTerm: ""
  });
  const [dateRangePreset, setDateRangePreset] = useState(initialValues.dateRangePreset);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });

  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Get user permissions
  const {
    hasReadPermission,
    hasModuleAccess,
    isLoading: permissionsLoading
  } = useUserPermissions();

  // Apply date range preset: set fromDate/toDate for today/weekly/monthly
  useEffect(() => {
    const now = new Date();

    if (dateRangePreset === "today") {
      const d = format(startOfDay(now), "yyyy-MM-dd");
      setFilters(prev => ({ ...prev, fromDate: d, toDate: d }));
    } else if (dateRangePreset === "weekly") {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });     // Sunday
      setFilters(prev => ({
        ...prev,
        fromDate: format(weekStart, "yyyy-MM-dd"),
        toDate: format(weekEnd, "yyyy-MM-dd"),
      }));
    } else if (dateRangePreset === "monthly") {
      const mStart = startOfMonth(now);
      const mEnd = endOfMonth(now);
      setFilters(prev => ({
        ...prev,
        fromDate: format(mStart, "yyyy-MM-dd"),
        toDate: format(mEnd, "yyyy-MM-dd"),
      }));
    }
    // For "custom" we leave filters.fromDate / toDate for manual selection
  }, [dateRangePreset]);

  // Build query parameters
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (filters.fromDate) params.append('start_date', filters.fromDate);
    if (filters.toDate) params.append('end_date', filters.toDate);
    return params.toString();
  };

  // Fetch delivery notes
  const { data: deliveryNotesData, isLoading, error, refetch } = useQuery({
    queryKey: ['delivery-notes', filters.fromDate, filters.toDate],
    queryFn: async () => {
      const queryParams = buildQueryParams();
      const url = `${import.meta.env.VITE_BASE_URL}/api/sales/delivery-notes/?${queryParams}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${AuthService.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch delivery notes');
      }

      const data = await response.json();

      if (data.status && data.status !== 200) {
        throw new Error(data.message || 'Failed to fetch delivery notes');
      }

      return data;
    },
    enabled: true,
  });

  const { data: voucherTypesData, isLoading: isLoadingVoucherTypes, error: voucherTypesError } = useQuery({
    queryKey: ['delivery-note-voucher-types'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `${API_BASE_URL}/api/get-voucher-types/`);
        const data = await response.json();
        if (data.status === 200 && data.data) {
          return Array.isArray(data.data) ? data.data : [];
        }
        if (Array.isArray(data)) {
          return data;
        }
        return [];
      } catch (err) {
        console.error('Error fetching voucher types:', err);
        return [];
      }
    },
    enabled: isVoucherDialogOpen && !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  const filteredVoucherTypes = useMemo(() => {
    if (!voucherTypesData) return [];
    if (!voucherTypeSearchTerm) return voucherTypesData;
    const searchLower = voucherTypeSearchTerm.toLowerCase();
    return voucherTypesData.filter((vt) =>
      (vt.name && vt.name.toLowerCase().includes(searchLower)) ||
      (vt.display_name && vt.display_name.toLowerCase().includes(searchLower)) ||
      (vt.parent && vt.parent.toLowerCase().includes(searchLower))
    );
  }, [voucherTypesData, voucherTypeSearchTerm]);

  const syncDeliveryNoteMutation = useMutation({
    mutationFn: async ({ outwardId, voucherTypeName }) => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/sales/sync-delivery-note/`, {
        outward_id: outwardId,
        voucher_type_name: voucherTypeName || 'Delivery Note [R]',
      });
      return response.json();
    },
    onSuccess: async (data) => {
      toast({
        title: "Success",
        description: data.message || "Delivery note synced successfully to Tally",
        variant: "success",
      });
      setIsVoucherDialogOpen(false);
      setSelectedVoucherType(null);
      setVoucherTypeSearchTerm("");
      setNoteToSync(null);
      if (selectedNote) {
        setSelectedNote((prev) => prev ? { ...prev, is_tally_sync: true, is_tally_synced: true } : prev);
      }
      await queryClient.invalidateQueries({ queryKey: ['delivery-notes'], exact: false });
      await refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to sync delivery note to Tally",
        variant: "destructive",
      });
    },
  });

  const handleSyncClick = (note) => {
    const outwardId = getOutwardEntryId(note);
    if (!outwardId) {
      toast({
        title: "Error",
        description: "Outward entry ID is required to sync delivery note",
        variant: "destructive",
      });
      return;
    }
    setNoteToSync(note);
    setSelectedVoucherType(null);
    setVoucherTypeSearchTerm("");
    setIsVoucherDialogOpen(true);
  };

  const handleVoucherSelectAndSync = () => {
    const outwardId = getOutwardEntryId(noteToSync);
    if (!outwardId) {
      toast({
        title: "Error",
        description: "Outward entry is required",
        variant: "destructive",
      });
      return;
    }
    if (!selectedVoucherType) {
      toast({
        title: "Error",
        description: "Please select a voucher type first",
        variant: "destructive",
      });
      return;
    }
    syncDeliveryNoteMutation.mutate({
      outwardId,
      voucherTypeName: selectedVoucherType.name || 'Delivery Note [R]',
    });
  };

  const allDeliveryNotes = deliveryNotesData?.data || [];

  // Frontend filtering logic
  const filteredNotes = allDeliveryNotes.filter(note => {
    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      const orderId = note.order_id?.toLowerCase() || '';
      const soNumber = note.so_number?.toLowerCase() || '';
      const customerName = note.customer_name?.toLowerCase() || '';
      const billNo = note.bill_no?.toLowerCase() || '';
      const vehicleNo = note.vehicle_no?.toLowerCase() || '';

      if (!orderId.includes(searchTerm) &&
        !soNumber.includes(searchTerm) &&
        !customerName.includes(searchTerm) &&
        !billNo.includes(searchTerm) &&
        !vehicleNo.includes(searchTerm)) {
        return false;
      }
    }

    return true;
  });

  // Use total_amount from API response directly (already calculated on backend)
  const notesWithTotal = filteredNotes;

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleDateRangePresetChange = (value) => {
    setDateRangePreset(value);
  };

  const handleClearFilters = () => {
    const now = new Date();
    const todayStr = format(startOfDay(now), "yyyy-MM-dd");
    setDateRangePreset("today");
    setFilters({
      fromDate: todayStr,
      toDate: todayStr,
      searchTerm: "",
    });
  };

  // Handle view details
  const handleViewDetails = (note) => {
    setSelectedNote(note);
    setIsDetailModalOpen(true);
  };

  // Handle close details
  const handleCloseDetails = () => {
    setSelectedNote(null);
    setIsDetailModalOpen(false);
  };

  if (isLoading || permissionsLoading) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <CommonLoader />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-4">Error loading delivery notes: {error.message}</p>
            <Button onClick={() => refetch()}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  // Check permissions
  const hasOutwardAccess = hasModuleAccess("outward") || hasReadPermission("outward");

  if (!hasOutwardAccess) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                <FileText className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
              <p className="text-red-600 mb-4">
                You don't have permission to view delivery notes. Contact your administrator for access.
              </p>
              <Button onClick={() => setLocation('/dashboard')} variant="outline">
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-white flex-shrink-0">
          <div className="flex items-center space-x-3">
            {isMobile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Delivery Notes</h1>
              <p className="text-sm text-gray-600 leading-tight">View completed delivery notes with party information</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 sm:p-5 min-h-0">
          {/* Filters */}
          <Card className="mb-4">
            <CardHeader className="px-4 py-2.5 border-b bg-gray-50 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_2fr_auto] gap-4 items-end">
                {/* Date Range Preset */}
                <div>
                  <Label htmlFor="dateRangePreset" className="block mb-1.5 text-sm font-medium text-gray-700">Date Range</Label>
                  <Select
                    value={dateRangePreset}
                    onValueChange={handleDateRangePresetChange}
                  >
                    <SelectTrigger id="dateRangePreset">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="weekly">Weekly (Mon–Sun)</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="fromDate" className="block mb-1.5 text-sm font-medium text-gray-700">From Date</Label>
                  <Popover
                    open={dateRangePreset === "custom" ? isDatePickerOpen.from : false}
                    onOpenChange={(open) => {
                      if (dateRangePreset !== "custom") return;
                      setIsDatePickerOpen((prev) => ({ ...prev, from: open }));
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={dateRangePreset !== "custom"}
                        className={`w-full h-10 justify-start text-left font-normal ${dateRangePreset !== "custom" ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
                        id="fromDate"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                        <span className="truncate">
                          {filters.fromDate ? format(new Date(filters.fromDate), "dd-MM-yyyy") : "From Date"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        key={`from-${filters.fromDate || "null"}`}
                        mode="single"
                        selected={filters.fromDate ? new Date(filters.fromDate) : undefined}
                        onSelect={(date) => {
                          if (!date) return;
                          const dateStr = format(date, "yyyy-MM-dd");
                          handleFilterChange("fromDate", dateStr);
                          if (dateStr && filters.toDate && dateStr > filters.toDate) {
                            handleFilterChange("toDate", dateStr);
                          }
                          setIsDatePickerOpen((prev) => ({ ...prev, from: false }));
                        }}
                        disabled={{ after: today }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="toDate" className="block mb-1.5 text-sm font-medium text-gray-700">To Date</Label>
                  <Popover
                    open={dateRangePreset === "custom" ? isDatePickerOpen.to : false}
                    onOpenChange={(open) => {
                      if (dateRangePreset !== "custom") return;
                      setIsDatePickerOpen((prev) => ({ ...prev, to: open }));
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={dateRangePreset !== "custom"}
                        className={`w-full h-10 justify-start text-left font-normal ${dateRangePreset !== "custom" ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
                        id="toDate"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                        <span className="truncate">
                          {filters.toDate ? format(new Date(filters.toDate), "dd-MM-yyyy") : "To Date"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        key={`to-${filters.toDate || "null"}`}
                        mode="single"
                        selected={filters.toDate ? new Date(filters.toDate) : undefined}
                        onSelect={(date) => {
                          if (!date) return;
                          handleFilterChange("toDate", format(date, "yyyy-MM-dd"));
                          setIsDatePickerOpen((prev) => ({ ...prev, to: false }));
                        }}
                        disabled={[
                          filters.fromDate ? { before: new Date(filters.fromDate) } : null,
                          { after: today },
                        ].filter(Boolean)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="md:col-span-2 lg:col-span-1">
                  <Label htmlFor="searchTerm" className="block mb-1.5 text-sm font-medium text-gray-700">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="searchTerm"
                      placeholder="Search by order, customer, GP No, or vehicle"
                      value={filters.searchTerm}
                      onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={() => refetch()} className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Search
                  </Button>
                  <Button type="button" variant="outline" onClick={handleClearFilters}>
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <Card>
            <CardHeader className="px-4 py-2.5 border-b bg-gray-50 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <FileText className="h-4 w-4" />
                Delivery Notes ({notesWithTotal.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {notesWithTotal.length > 0 ? (
                <div className="overflow-x-auto [&_td]:py-2.5">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Gate Pass No</TableHead>
                        <TableHead>Vehicle No</TableHead>

                        <TableHead className="whitespace-nowrap">Items</TableHead>
                        <TableHead>Total Amount</TableHead>
                        <TableHead className="whitespace-nowrap">Created at</TableHead>
                        {isTallyEnabled && <TableHead>Tally Status</TableHead>}
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notesWithTotal.map((note, index) => (
                        <TableRow key={`${note.order_id || note.so_number || note.bill_no || index}-${index}`}>
                          <TableCell className="font-medium">
                            {note.order_id || note.so_number || 'N/A'}
                          </TableCell>
                          <TableCell>{note.customer_name || 'N/A'}</TableCell>
                          <TableCell>{note.bill_no || 'N/A'}</TableCell>
                          <TableCell>{note.vehicle_no || 'N/A'}</TableCell>

                          <TableCell className="whitespace-nowrap">
                            <Badge variant="outline" className="whitespace-nowrap">
                              {note.items?.length || 0} item(s)
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {note.total_amount !== null && note.total_amount !== undefined ? (
                              `₹${parseFloat(note.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            ) : 'N/A'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{note.outward_date || 'N/A'}</TableCell>
                          {isTallyEnabled && (
                            <TableCell>
                              {isDeliveryNoteTallySynced(note) ? (
                                <Badge className="flex items-center space-x-1 text-xs w-fit">
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>Synced</span>
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="flex items-center space-x-1 text-xs w-fit">
                                  <Clock className="h-3 w-3" />
                                  <span>Not Synced</span>
                                </Badge>
                              )}
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewDetails(note)}
                                className="flex items-center gap-1"
                              >
                                <Eye className="h-4 w-4" />
                                View
                              </Button>
                              {isTallyEnabled && !isDeliveryNoteTallySynced(note) && (
                                <Button
                                  size="sm"
                                  onClick={() => handleSyncClick(note)}
                                  disabled={syncDeliveryNoteMutation.isPending}
                                  title="Sync to Tally"
                                  className="inline-flex items-center justify-center h-8 w-8 p-0"
                                >
                                  {syncDeliveryNoteMutation.isPending && getOutwardEntryId(noteToSync) === getOutwardEntryId(note) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-10">
                  <FileText className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-base font-medium text-gray-900 mb-1">No delivery notes found</h3>
                  <p className="text-gray-500 mb-4">
                    {Object.values(filters).some(f => f)
                      ? 'Try adjusting your filters to see more results.'
                      : 'No completed delivery notes available.'
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Details Modal */}
      {isDetailModalOpen && (
        <DeliveryNoteDetails
          note={selectedNote}
          onClose={handleCloseDetails}
          onSyncClick={handleSyncClick}
          isSyncing={syncDeliveryNoteMutation.isPending}
        />
      )}

      <Dialog
        open={isVoucherDialogOpen}
        onOpenChange={(open) => {
          if (syncDeliveryNoteMutation.isPending) return;
          setIsVoucherDialogOpen(open);
          if (!open) {
            setNoteToSync(null);
            setSelectedVoucherType(null);
            setVoucherTypeSearchTerm("");
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" aria-describedby="dn-voucher-dialog-description">
          <DialogHeader className="shrink-0">
            <DialogTitle>Select Voucher Type for Tally Sync</DialogTitle>
            <DialogDescription id="dn-voucher-dialog-description">
              Select a voucher type first (required), then sync this delivery note to Tally.
              {noteToSync && (
                <span className="block mt-1 font-medium">
                  Delivery Note: {noteToSync.bill_no || noteToSync.order_id || noteToSync.so_number}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col flex-1 min-h-0 space-y-4 overflow-y-auto">
            <div className="space-y-2 shrink-0">
              <p className="text-sm font-medium text-gray-700">Voucher Type (required)</p>
              {!selectedVoucherType ? (
                <>
                  <div className="relative shrink-0">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search voucher types by name..."
                      value={voucherTypeSearchTerm}
                      onChange={(e) => setVoucherTypeSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="border rounded-lg flex-1 min-h-0 overflow-y-auto max-h-72">
                    {isLoadingVoucherTypes ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        <span className="ml-2 text-gray-500">Loading voucher types...</span>
                      </div>
                    ) : filteredVoucherTypes && filteredVoucherTypes.length > 0 ? (
                      <div className="divide-y">
                        {filteredVoucherTypes.map((voucherType) => (
                          <div
                            key={voucherType.id}
                            onClick={() => setSelectedVoucherType(voucherType)}
                            className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">
                                  {voucherType.display_name || voucherType.name}
                                </p>
                                {voucherType.parent && (
                                  <p className="text-sm text-gray-500 mt-1">Parent: {voucherType.parent}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : voucherTypesError ? (
                      <div className="flex items-center justify-center py-8 text-red-500">
                        <span>Error loading voucher types. Please try again.</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-8 text-gray-500">
                        {voucherTypeSearchTerm ? 'No voucher types found matching your search' : 'No voucher types available'}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-900">Selected Voucher Type:</p>
                    <p className="text-green-700 font-semibold">{selectedVoucherType.display_name || selectedVoucherType.name}</p>
                    {selectedVoucherType.parent && (
                      <p className="text-sm text-green-600 mt-0.5">Parent: {selectedVoucherType.parent}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { setSelectedVoucherType(null); setVoucherTypeSearchTerm(""); }}
                    disabled={syncDeliveryNoteMutation.isPending}
                  >
                    Change Voucher Type
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                if (syncDeliveryNoteMutation.isPending) return;
                setIsVoucherDialogOpen(false);
                setNoteToSync(null);
                setSelectedVoucherType(null);
                setVoucherTypeSearchTerm("");
              }}
              disabled={syncDeliveryNoteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleVoucherSelectAndSync}
              disabled={syncDeliveryNoteMutation.isPending || !selectedVoucherType}
              className="flex items-center gap-2"
            >
              {syncDeliveryNoteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Sync to Tally
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}