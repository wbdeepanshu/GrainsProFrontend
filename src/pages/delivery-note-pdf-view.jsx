import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { AuthService } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { fetchOrgInfo } from "@/lib/orgInfo";

export default function DeliveryNotePDFView() {
  const [location, setLocation] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");
  const selectedLanguage = urlParams.get("lang") || "en";
  const isMobile = useIsMobile();
  const [detailsData, setDetailsData] = useState(null);
  const [translatedDetailsData, setTranslatedDetailsData] = useState(null);
  const [orgInfo, setOrgInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isTranslatingContent, setIsTranslatingContent] = useState(false);
  const { toast } = useToast();
  const API_BASE_URL = import.meta.env.VITE_BASE_URL;
  const translations = {
    en: {
      back: "Back to Delivery Notes",
      downloadPdf: "Download PDF",
      generating: "Generating...",
      translating: "Translating...",
      deliveryNote: "DELIVERY NOTE",
      deliveryNoteNo: "Delivery Note No.",
      referenceNoDate: "Reference No. & Date",
      buyerOrderNo: "Buyer's Order No.",
      dispatchDocNo: "Dispatch Doc No.",
      dispatchedThrough: "Dispatched through",
      dated: "Dated",
      otherReference: "Other Reference",
      destination: "Destination",
      consigneeShipTo: "Consignee (Ship to)",
      billOfLading: "Bill of Lading/LR-RR No.",
      motorVehicleNo: "Motor Vehicle No.",
      buyerBillTo: "Buyer (Bill to)",
      placeOfSupply: "Place of Supply",
      siNo: "SI No.",
      descriptionOfGoods: "Description of Goods",
      quantity: "Quantity",
      altQuantity: "Alt. Quantity",
      totalAmount: "Total Amount",
      noItemsFound: "No items found",
      total: "Total",
      stateName: "State Name",
      code: "Code",
      contact: "Contact",
      dt: "dt.",
      direct: "DIRECT",
    },
    hi: {
      back: "डिलीवरी नोट्स पर वापस जाएं",
      downloadPdf: "पीडीएफ डाउनलोड",
      generating: "बन रहा है...",
      translating: "अनुवाद हो रहा है...",
      deliveryNote: "डिलीवरी नोट",
      deliveryNoteNo: "डिलीवरी नोट नं.",
      referenceNoDate: "संदर्भ संख्या और दिनांक",
      buyerOrderNo: "क्रेता आदेश नं.",
      dispatchDocNo: "डिस्पैच दस्तावेज़ नं.",
      dispatchedThrough: "भेजा गया द्वारा",
      dated: "दिनांक",
      otherReference: "अन्य संदर्भ",
      destination: "गंतव्य",
      consigneeShipTo: "प्राप्तकर्ता (शिप टू)",
      billOfLading: "बिल ऑफ लेडिंग / एलआर-आरआर नं.",
      motorVehicleNo: "मोटर वाहन नं.",
      buyerBillTo: "क्रेता (बिल टू)",
      placeOfSupply: "आपूर्ति का स्थान",
      siNo: "क्रम सं.",
      descriptionOfGoods: "माल का विवरण",
      quantity: "मात्रा",
      altQuantity: "वैकल्पिक मात्रा",
      totalAmount: "कुल राशि",
      noItemsFound: "कोई आइटम नहीं मिला",
      total: "कुल",
      stateName: "राज्य का नाम",
      code: "कोड",
      contact: "संपर्क",
      dt: "दि.",
      direct: "प्रत्यक्ष",
    },
    kn: {
      back: "ಡೆಲಿವರಿ ನೋಟ್‌ಗಳಿಗೆ ಹಿಂತಿರುಗಿ",
      downloadPdf: "ಪಿಡಿಎಫ್ ಡೌನ್‌ಲೋಡ್",
      generating: "ರಚಿಸಲಾಗುತ್ತಿದೆ...",
      translating: "ಅನುವಾದಿಸಲಾಗುತ್ತಿದೆ...",
      deliveryNote: "ಡೆಲಿವರಿ ನೋಟ್",
      deliveryNoteNo: "ಡೆಲಿವರಿ ನೋಟ್ ಸಂಖ್ಯೆ",
      referenceNoDate: "ಉಲ್ಲೇಖ ಸಂಖ್ಯೆ ಮತ್ತು ದಿನಾಂಕ",
      buyerOrderNo: "ಖರೀದಿದಾರರ ಆದೇಶ ಸಂಖ್ಯೆ",
      dispatchDocNo: "ರವಾನೆ ಡಾಕ್ ಸಂಖ್ಯೆ",
      dispatchedThrough: "ಇದರ ಮೂಲಕ ರವಾನೆ",
      dated: "ದಿನಾಂಕ",
      otherReference: "ಇತರೆ ಉಲ್ಲೇಖ",
      destination: "ಗಮ್ಯಸ್ಥಾನ",
      consigneeShipTo: "ಸ್ವೀಕರಿಸುವವರು (ಶಿಪ್ ಟು)",
      billOfLading: "ಬಿಲ್ ಆಫ್ ಲಾಡಿಂಗ್ / ಎಲ್‌ಆರ್-ಆರ್‌ಆರ್ ಸಂಖ್ಯೆ",
      motorVehicleNo: "ಮೋಟಾರ್ ವಾಹನ ಸಂಖ್ಯೆ",
      buyerBillTo: "ಖರೀದಿದಾರ (ಬಿಲ್ ಟು)",
      placeOfSupply: "ಪೂರೈಕೆ ಸ್ಥಳ",
      siNo: "ಕ್ರಮ ಸಂ.",
      descriptionOfGoods: "ಸರಕುಗಳ ವಿವರಣೆ",
      quantity: "ಪ್ರಮಾಣ",
      altQuantity: "ಪರ್ಯಾಯ ಪ್ರಮಾಣ",
      totalAmount: "ಒಟ್ಟು ಮೊತ್ತ",
      noItemsFound: "ಯಾವುದೇ ಐಟಂಗಳು ಲಭ್ಯವಿಲ್ಲ",
      total: "ಒಟ್ಟು",
      stateName: "ರಾಜ್ಯದ ಹೆಸರು",
      code: "ಕೋಡ್",
      contact: "ಸಂಪರ್ಕ",
      dt: "ದಿ.",
      direct: "ನೇರ",
    },
    gu: {
      back: "ડિલિવરી નોટ્સ પર પાછા જાઓ",
      downloadPdf: "પીડીએફ ડાઉનલોડ",
      generating: "બનાવી રહ્યું છે...",
      translating: "અનુવાદ થઈ રહ્યો છે...",
      deliveryNote: "ડિલિવરી નોટ",
      deliveryNoteNo: "ડિલિવરી નોટ નં.",
      referenceNoDate: "સંદર્ભ નં. અને તારીખ",
      buyerOrderNo: "ખરીદદાર ઓર્ડર નં.",
      dispatchDocNo: "ડિસ્પેચ દસ્તાવેજ નં.",
      dispatchedThrough: "દ્વારા મોકલેલ",
      dated: "તારીખ",
      otherReference: "અન્ય સંદર્ભ",
      destination: "ગંતવ્ય",
      consigneeShipTo: "પ્રાપ્તકર્તા (શિપ ટુ)",
      billOfLading: "બિલ ઓફ લેડિંગ / એલઆર-આરઆર નં.",
      motorVehicleNo: "મોટર વાહન નં.",
      buyerBillTo: "ખરીદદાર (બિલ ટુ)",
      placeOfSupply: "પુરવઠાનું સ્થાન",
      siNo: "ક્રમ સં.",
      descriptionOfGoods: "માલનું વર્ણન",
      quantity: "જથ્થો",
      altQuantity: "વૈકલ્પિક જથ્થો",
      totalAmount: "કુલ રકમ",
      noItemsFound: "કોઈ આઇટમ મળ્યાં નથી",
      total: "કુલ",
      stateName: "રાજ્યનું નામ",
      code: "કોડ",
      contact: "સંપર્ક",
      dt: "તા.",
      direct: "ડાયરેક્ટ",
    },
  };
  const t = translations[selectedLanguage] || translations.en;

  // Fetch Delivery Note details
  useEffect(() => {
    if (!id) return;

    const fetchDetails = async () => {
      setIsLoading(true);
      try {
        const url = `${API_BASE_URL}/api/sales/delivery-notes/${id}/`;
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
          setDetailsData({
            ...data.data,
            items: data.data.items || [],
            total_amount: data.data.total_amount || null,
            party_info: data.data.party_info || null,
            organization_info: data.data.organization_info || null,
            order_id: data.data.order_id || data.data.so_number || null,
            so_number: data.data.so_number || data.data.order_id || null,
            order_date: data.data.order_date || null,
            customer_name: data.data.customer_name || null,
          });
        }
      } catch (err) {
        toast({
          title: "Error",
          description: err.message || "Failed to load delivery note details",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [id, toast, API_BASE_URL]);

  // Fetch organization info
  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const org = await fetchOrgInfo();
        setOrgInfo(org);
      } catch (err) {
        console.error('Failed to fetch org info:', err);
      }
    };
    fetchOrg();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const isOnlyNumericLike = (value) => {
      const s = String(value ?? "").trim();
      if (!s) return true;
      return /^[\d\s.,:/()%+-]+$/.test(s);
    };
    const isLikelyCodeOrIdentifier = (value) => {
      const s = String(value ?? "").trim();
      if (!s) return false;
      if (/^(https?:\/\/|www\.|mailto:)/i.test(s)) return true;
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return true;
      if (/^[A-Z0-9\-_/]{4,}$/.test(s)) return true;
      return false;
    };
    const cache = new Map();
    const translateKeepNumbers = async (value) => {
      const raw = String(value ?? "");
      if (!raw || selectedLanguage === "en" || isOnlyNumericLike(raw) || isLikelyCodeOrIdentifier(raw)) return raw;
      const cacheKey = `${selectedLanguage}::${raw}`;
      if (cache.has(cacheKey)) return cache.get(cacheKey);
      try {
        const parts = raw.split(/(\d+(?:[.,:/-]\d+)*)/g).filter(Boolean);
        const out = [];
        for (const part of parts) {
          if (/\d/.test(part) || isOnlyNumericLike(part) || isLikelyCodeOrIdentifier(part)) {
            out.push(part);
            continue;
          }
          const trimmed = part.trim();
          if (!trimmed) {
            out.push(part);
            continue;
          }
          const resp = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(selectedLanguage)}&dt=t&q=${encodeURIComponent(trimmed)}`);
          if (!resp.ok) {
            out.push(part);
            continue;
          }
          const json = await resp.json();
          const translated = Array.isArray(json?.[0]) ? json[0].map((seg) => seg?.[0] || "").join("") : trimmed;
          const lead = part.match(/^\s*/)?.[0] || "";
          const trail = part.match(/\s*$/)?.[0] || "";
          out.push(`${lead}${translated}${trail}`);
        }
        const finalText = out.join("");
        cache.set(cacheKey, finalText);
        return finalText;
      } catch {
        return raw;
      }
    };
    const translateDeep = async (value) => {
      if (value == null) return value;
      if (typeof value === "string") return translateKeepNumbers(value);
      if (Array.isArray(value)) {
        const arr = [];
        for (const item of value) arr.push(await translateDeep(item));
        return arr;
      }
      if (typeof value === "object") {
        const out = {};
        for (const [k, v] of Object.entries(value)) out[k] = await translateDeep(v);
        return out;
      }
      return value;
    };

    const run = async () => {
      if (!detailsData) return;
      if (selectedLanguage === "en") {
        setTranslatedDetailsData(detailsData);
        return;
      }
      setIsTranslatingContent(true);
      try {
        const translated = await translateDeep(detailsData);
        if (!cancelled) setTranslatedDetailsData(translated);
      } finally {
        if (!cancelled) setIsTranslatingContent(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [detailsData, selectedLanguage]);

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = date.toLocaleString('en-US', { month: 'short' });
      const year = date.getFullYear().toString().slice(-2);
      return `${day}-${month}-${year}`;
    } catch (e) {
      return dateString;
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '0.00';
    return parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Convert number to words (Indian format)
  const numberToWords = (num) => {
    if (num === null || num === undefined || num === 0) return 'Zero Rupees Only';

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
                  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
                  'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const convertHundreds = (n) => {
      let result = '';
      if (n >= 100) {
        result += ones[Math.floor(n / 100)] + ' Hundred ';
        n %= 100;
      }
      if (n >= 20) {
        result += tens[Math.floor(n / 10)] + ' ';
        n %= 10;
      }
      if (n > 0) {
        result += ones[n] + ' ';
      }
      return result.trim();
    };

    const convert = (n) => {
      if (n === 0) return '';

      let result = '';

      // Crores
      if (n >= 10000000) {
        const crores = Math.floor(n / 10000000);
        result += convertHundreds(crores) + ' Crore ';
        n %= 10000000;
      }

      // Lakhs
      if (n >= 100000) {
        const lakhs = Math.floor(n / 100000);
        result += convertHundreds(lakhs) + ' Lakh ';
        n %= 100000;
      }

      // Thousands
      if (n >= 1000) {
        const thousands = Math.floor(n / 1000);
        result += convertHundreds(thousands) + ' Thousand ';
        n %= 1000;
      }

      // Hundreds, Tens, Ones
      if (n > 0) {
        result += convertHundreds(n);
      }

      return result.trim();
    };

    const numStr = parseFloat(num).toFixed(2);
    const parts = numStr.split('.');
    const rupees = parseInt(parts[0]);
    const paise = parseInt(parts[1] || '0');

    let words = '';

    if (rupees > 0) {
      words = convert(rupees) + ' Rupee' + (rupees !== 1 ? 's' : '');
    } else {
      words = 'Zero Rupees';
    }

    if (paise > 0) {
      words += ' and ' + convert(paise) + ' Paise';
    }

    return words + ' Only';
  };

  // Generate PDF — capture at A4 width, full-page print layout
  const generatePDF = async () => {
    if (!detailsData) return;
    const pdfSource = translatedDetailsData || detailsData;

    setIsGeneratingPDF(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const source = document.getElementById('delivery-note-content');
      if (!source) {
        throw new Error('Content element not found');
      }

      // Off-screen clone so on-screen UI is untouched and capture is A4-stable
      const captureWidthPx = 794; // ~210mm at 96dpi
      const clone = source.cloneNode(true);
      clone.id = 'delivery-note-content-print-clone';
      // Retarget embedded CSS so clone keeps the same print styles
      clone.querySelectorAll('style').forEach((styleEl) => {
        styleEl.textContent = String(styleEl.textContent || '').replaceAll(
          '#delivery-note-content',
          '#delivery-note-content-print-clone'
        );
      });
      clone.style.cssText = [
        'position:fixed',
        'left:-10000px',
        'top:0',
        `width:${captureWidthPx}px`,
        `max-width:${captureWidthPx}px`,
        `min-width:${captureWidthPx}px`,
        'margin:0',
        'padding:16px 14px 24px 14px',
        'background:#ffffff',
        'box-sizing:border-box',
        'overflow:visible',
        'z-index:-1',
      ].join(';');
      document.body.appendChild(clone);

      // Ensure footer text is visible in the printed capture
      const cloneJurisdiction = clone.querySelector('.jurisdiction-footer');
      const cloneFooter = clone.querySelector('.pdf-footer');
      if (cloneJurisdiction) cloneJurisdiction.style.display = 'block';
      if (cloneFooter) cloneFooter.style.display = 'block';

      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      let canvas;
      try {
        canvas = await html2canvas(clone, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: captureWidthPx,
          windowWidth: captureWidthPx,
          windowHeight: Math.ceil(clone.scrollHeight),
          scrollX: 0,
          scrollY: 0,
        });
      } finally {
        document.body.removeChild(clone);
      }

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const sideMargin = 8;
      const topMargin = 8;
      const bottomMargin = 8;
      const contentWidth = pdfWidth - sideMargin * 2;
      const pageContentHeight = pdfHeight - topMargin - bottomMargin;

      const imgData = canvas.toDataURL('image/png');
      let imgWidth = contentWidth;
      let imgHeight = (canvas.height * contentWidth) / canvas.width;
      const overflow = imgHeight - pageContentHeight;

      // Prefer a single neat page when content only slightly overflows
      // (prevents footer leaking onto an almost-empty page 2)
      if (overflow <= 28) {
        const scale = overflow > 0 ? pageContentHeight / imgHeight : 1;
        const drawWidth = imgWidth * scale;
        const drawHeight = imgHeight * scale;
        const x = sideMargin + (contentWidth - drawWidth) / 2;
        pdf.addImage(imgData, 'PNG', x, topMargin, drawWidth, drawHeight);
      } else {
        // True multi-page: slice content across pages
        let heightLeft = imgHeight;
        let position = topMargin;
        pdf.addImage(imgData, 'PNG', sideMargin, position, imgWidth, imgHeight);
        heightLeft -= pageContentHeight;

        while (heightLeft > 4) {
          position = topMargin - (imgHeight - heightLeft);
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', sideMargin, position, imgWidth, imgHeight);
          heightLeft -= pageContentHeight;
        }
      }

      const fileName = `delivery-note-${pdfSource.so_number || pdfSource.order_id || id}-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      toast({
        title: "PDF Downloaded",
        description: "Delivery Note has been downloaded as PDF",
        variant: "success",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileSidebar />}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading delivery note details...</p>
          </div>
        </div>
      </div>
    );
  }

  const displayData = translatedDetailsData || detailsData;

  if (!displayData) {
    return (
      <div className="flex h-screen bg-gray-50">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileSidebar />}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600">Delivery note not found</p>
            <Button
              variant="outline"
              onClick={() => setLocation("/outward/delivery-notes")}
              className="mt-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Delivery Notes
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Get items directly from detailsData (delivery notes have items directly, not nested)
  const allItems = displayData.items || [];

  // Get organization details
  const orgDetails = displayData.organization_info || orgInfo || {};
  const partyDetails = displayData.party_info || {};
  const fontFamily = selectedLanguage === "hi"
    ? "'Noto Sans Devanagari', Arial, sans-serif"
    : selectedLanguage === "kn"
      ? "'Noto Sans Kannada', Arial, sans-serif"
      : selectedLanguage === "gu"
        ? "'Noto Sans Gujarati', Arial, sans-serif"
        : "Arial, sans-serif";

  // Calculate totals
  const totalAltQty = allItems.reduce((sum, item) => {
    return sum + (parseFloat(item.total_loaded_weight || 0));
  }, 0);

  const totalQty = allItems.reduce((sum, item) => {
    return sum + (parseFloat(item.loaded_quantity || item.quantity || 0));
  }, 0);

  // Get unique HSN codes and calculate taxable values
  const hsnMap = {};
  allItems.forEach((item) => {
    const hsn = item.hsn_code || item.hsn || 'N/A';
    const taxableValue = parseFloat(item.amount || item.total_amount || 0);
    if (hsnMap[hsn]) {
      hsnMap[hsn] += taxableValue;
    } else {
      hsnMap[hsn] = taxableValue;
    }
  });
  const totalTaxableValue = Object.values(hsnMap).reduce((sum, val) => sum + val, 0);

  return (
    <div className="flex h-screen bg-gray-50">
      {!isMobile && <Sidebar />}
      {isMobile && <MobileSidebar />}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setLocation("/outward/delivery-notes")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {t.back}
            </Button>
            <Button
              onClick={generatePDF}
              disabled={isGeneratingPDF || isTranslatingContent}
              className="flex items-center gap-2"
            >
              {isGeneratingPDF || isTranslatingContent ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isTranslatingContent ? t.translating : t.generating}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  {t.downloadPdf}
                </>
              )}
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-100">
          <div className="min-h-full w-full flex justify-center px-3 py-5 md:px-6 md:py-6">
          <div
            id="delivery-note-content"
            className="bg-white shadow-md w-full"
            style={{
              maxWidth: '210mm',
              padding: '16px 14px 20px 14px',
              boxSizing: 'border-box',
            }}
          >
            <style>{`
              @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Kannada:wght@400;700&family=Noto+Sans+Gujarati:wght@400;700&display=swap');
              #delivery-note-content {
                font-family: ${fontFamily};
                font-size: 11px;
                color: #111;
                line-height: 1.45;
                width: 100% !important;
                max-width: 210mm !important;
                margin: 0 auto !important;
                padding: 16px 14px 20px 14px !important;
                box-sizing: border-box !important;
              }
              .delivery-note-content {
                font-family: ${fontFamily};
                font-size: 11px;
                margin: 0;
                padding: 0;
                width: 100%;
                box-sizing: border-box;
              }
              .delivery-note-content .header {
                font-size: 18px;
                font-weight: 700;
                text-align: center;
                letter-spacing: 0.05em;
                padding: 12px 10px;
                margin: 0 0 0 0;
                line-height: 1.3;
                border: 1px solid #000;
                border-bottom: none;
                background: #f7f7f7;
              }
              .delivery-note-content table {
                width: 100% !important;
                border-collapse: collapse;
                margin: 0;
                table-layout: fixed;
              }
              .delivery-note-content td,
              .delivery-note-content th {
                border: 1px solid #000;
                padding: 8px 10px;
                vertical-align: top;
                word-wrap: break-word;
                overflow-wrap: break-word;
              }
              .delivery-note-content th {
                background: #f3f3f3;
                font-weight: 700;
                text-align: center;
                vertical-align: middle;
                font-size: 10px;
                line-height: 1.25;
              }
              .delivery-note-content .center { text-align: center; }
              .delivery-note-content .bold { font-weight: 700; }
              .delivery-note-content .muted { color: #555; font-size: 10px; }
              .delivery-note-content .field { margin-bottom: 8px; }
              .delivery-note-content .field:last-child { margin-bottom: 0; }
              .delivery-note-content .field-label {
                display: block;
                font-size: 10px;
                color: #555;
                margin-bottom: 2px;
              }
              .delivery-note-content .field-value {
                display: block;
                font-weight: 700;
                color: #111;
                word-break: break-word;
              }
              .delivery-note-content .section-title {
                font-weight: 700;
                margin-bottom: 6px;
                padding-bottom: 3px;
                border-bottom: 1px solid #ddd;
              }
              .delivery-note-content .stack > div { margin-bottom: 2px; }
              .delivery-note-content .jurisdiction-footer {
                margin-top: 12px;
                padding: 8px 4px 4px;
                text-align: center;
                font-size: 10px;
                line-height: 1.55;
                color: #000;
              }
              .delivery-note-content .pdf-footer {
                margin-top: 2px;
                padding-bottom: 2px;
                text-align: center;
                font-size: 9px;
                color: #444;
                line-height: 1.55;
              }
            `}</style>
            <div className="delivery-note-content">
              <div className="header">{t.deliveryNote}</div>

              <table>
                <tbody>
                <tr>
                  <td style={{ width: '42%' }}>
                    <div className="stack">
                      <div className="bold" style={{ fontSize: '13px' }}>
                        {orgDetails.organization || 'W B Agro Products Pvt Ltd.'}
                      </div>
                      {orgDetails.branch && <div className="muted">({orgDetails.branch})</div>}
                      <div>(Retail Pack / Rice Division), PLOT NO 113 TO 116 &</div>
                      <div>86 TO 89, INDUSTRIAL AREA, RAYAPUR,</div>
                      <div>DHARWAD-580009</div>
                      {orgDetails.fssai && <div>FSSAI {orgDetails.fssai}</div>}
                      {orgDetails.phone && <div>Ph: {orgDetails.phone}</div>}
                      {orgDetails.cin && <div>CIN NO. {orgDetails.cin}</div>}
                      {orgDetails.state_name && (
                        <div>State Name: {orgDetails.state_name}, Code: {orgDetails.state_code || '29'}</div>
                      )}
                      {orgDetails.gstin && <div>GSTIN: {orgDetails.gstin}</div>}
                      {orgDetails.pan && <div>PAN: {orgDetails.pan}</div>}
                      {orgDetails.contact && <div>Contact: {orgDetails.contact}</div>}
                      {orgDetails.email && <div>E-Mail: {orgDetails.email}</div>}
                      {orgDetails.website && <div>{orgDetails.website}</div>}
                    </div>
                  </td>
                  <td style={{ width: '29%' }}>
                    <div className="field">
                      <span className="field-label">{t.deliveryNoteNo}</span>
                      <span className="field-value">
                        {displayData.delivery_note_number || displayData.so_number || displayData.order_id || 'N/A'}
                      </span>
                    </div>
                    <div className="field">
                      <span className="field-label">{t.referenceNoDate}</span>
                      <span className="field-value">
                        {displayData.reference_number || displayData.so_number || 'N/A'} {t.dt}{' '}
                        {formatDate(displayData.order_date || displayData.reference_date)}
                      </span>
                    </div>
                    <div className="field">
                      <span className="field-label">{t.buyerOrderNo}</span>
                      <span className="field-value">
                        {displayData.buyers_order_no || displayData.so_number || 'N/A'}
                      </span>
                    </div>
                    <div className="field">
                      <span className="field-label">{t.dispatchDocNo}</span>
                      <span className="field-value">
                        {displayData.dispatch_doc_no || displayData.so_number || 'N/A'}
                      </span>
                    </div>
                    <div className="field">
                      <span className="field-label">{t.dispatchedThrough}</span>
                      <span className="field-value">{displayData.dispatched_through || '-'}</span>
                    </div>
                  </td>
                  <td style={{ width: '29%' }}>
                    <div className="field">
                      <span className="field-label">{t.dated}</span>
                      <span className="field-value">{formatDate(displayData.order_date || displayData.date)}</span>
                    </div>
                    <div className="field">
                      <span className="field-label">{t.otherReference}</span>
                      <span className="field-value">{displayData.other_reference || t.direct}</span>
                    </div>
                    <div className="field">
                      <span className="field-label">{t.dated}</span>
                      <span className="field-value">
                        {formatDate(displayData.other_reference_date || displayData.date)}
                      </span>
                    </div>
                    <div className="field">
                      <span className="field-label">{t.destination}</span>
                      <span className="field-value">
                        {displayData.destination || partyDetails.city || 'RAYAPUR'}
                      </span>
                    </div>
                  </td>
                </tr>
                </tbody>
              </table>

              <table>
                <tbody>
                <tr>
                  <td style={{ width: '50%' }}>
                    <div className="section-title">{t.consigneeShipTo}</div>
                    <div className="stack">
                      <div className="bold">{partyDetails.name || displayData.customer_name || 'N/A'}</div>
                      {partyDetails.address && (
                        <>
                          <div>{partyDetails.address}</div>
                          {partyDetails.city && partyDetails.state && (
                            <div>
                              {partyDetails.city}, {partyDetails.state} - {partyDetails.pincode || ''}, India
                            </div>
                          )}
                        </>
                      )}
                      {partyDetails.gst_number && <div>GSTIN/UIN: {partyDetails.gst_number}</div>}
                      {partyDetails.pan && <div>PAN/IT No: {partyDetails.pan}</div>}
                      {partyDetails.state && (
                        <div>{t.stateName}: {partyDetails.state}, {t.code}: {partyDetails.state_code || '29'}</div>
                      )}
                      {partyDetails.contact_number && (
                        <div>{t.contact}: {partyDetails.contact_number}</div>
                      )}
                    </div>
                  </td>
                  <td style={{ width: '25%' }}>
                    <div className="field">
                      <span className="field-label">{t.billOfLading}</span>
                      <span className="field-value">
                        {t.dt} {formatDate(displayData.bill_of_lading_date || displayData.date)}
                      </span>
                    </div>
                  </td>
                  <td style={{ width: '25%' }}>
                    <div className="field">
                      <span className="field-label">{t.motorVehicleNo}</span>
                      <span className="field-value">{displayData.vehicle_no || 'N/A'}</span>
                    </div>
                  </td>
                </tr>
                </tbody>
              </table>

              <table>
                <tbody>
                <tr>
                  <td>
                    <div className="section-title">{t.buyerBillTo}</div>
                    <div className="stack">
                      <div className="bold">{partyDetails.name || displayData.customer_name || 'N/A'}</div>
                      {partyDetails.address && (
                        <>
                          <div>{partyDetails.address}</div>
                          {partyDetails.city && partyDetails.state && (
                            <div>
                              {partyDetails.city}, {partyDetails.state} - {partyDetails.pincode || ''}, India
                            </div>
                          )}
                        </>
                      )}
                      {partyDetails.gst_number && <div>GSTIN/UIN: {partyDetails.gst_number}</div>}
                      {partyDetails.pan && <div>PAN/IT No: {partyDetails.pan}</div>}
                      {partyDetails.state && (
                        <div>{t.stateName}: {partyDetails.state}, {t.code}: {partyDetails.state_code || '29'}</div>
                      )}
                      {partyDetails.state && <div>{t.placeOfSupply}: {partyDetails.state}</div>}
                      {partyDetails.contact_number && (
                        <div>{t.contact}: {partyDetails.contact_number}</div>
                      )}
                    </div>
                  </td>
                </tr>
                </tbody>
              </table>

              <table>
                <thead>
                <tr>
                  <th style={{ width: '5%' }}>{t.siNo}</th>
                  <th style={{ width: '32%' }}>{t.descriptionOfGoods}</th>
                  <th style={{ width: '10%' }}>HSN/SAC</th>
                  <th style={{ width: '8%' }}>GST<br />Rate</th>
                  <th style={{ width: '11%' }}>{t.altQuantity}</th>
                  <th style={{ width: '11%' }}>{t.quantity}</th>
                  <th style={{ width: '11%' }}>Rate</th>
                  <th style={{ width: '12%' }}>{t.totalAmount}</th>
                </tr>
                </thead>
                <tbody>
                {allItems.length > 0 ? (
                  <>
                    {(() => {
                      const totalInvoiceAmount = allItems.reduce((sum, item) => {
                        return sum + parseFloat(item.total_amount || 0);
                      }, 0);
                      return (
                        <>
                          {allItems.map((item, index) => {
                      const description = item.item_name || item.name || 'N/A';
                      const qty = parseFloat(item.loaded_quantity || item.quantity || 0);
                      const uom = item.base_unit?.name || item.unit || 'pkt';
                      const rate = item.rate || item.price || 0;
                      const alternateRate = item.alternate_rate ? parseFloat(item.alternate_rate) : null;
                      const alternateUnit = item.alternate_unit?.name || null;
                      const hsn = item.hsn_code || item.hsn || 'N/A';
                      const gstRate = item.gst_rate || 0;
                      const altQty = item.alt_quantity || qty;
                      const altUnit = item.alt_unit || 'qtl';
                      const totalAmount = item.total_amount || 0;
                      
                      // Format rate display with alternate rate if available
                      const rateDisplay = alternateRate && alternateUnit
                        ? (
                            <>
                              {formatCurrency(rate)} / {uom}
                              <br />
                              <small style={{ color: '#666', fontSize: '11px' }}>
                                {formatCurrency(alternateRate)} / {alternateUnit}
                              </small>
                            </>
                          )
                        : `${formatCurrency(rate)} / ${uom}`;
                      
                      return (
                        <tr key={item.id || index}>
                          <td className="center">{index + 1}</td>
                          <td>{description}</td>
                          <td className="center">{hsn}</td>
                          <td className="center">{gstRate}%</td>
                          {/* <td className="center">{formatCurrency(altQty)} {altUnit}</td> */}
                          <td className="center">{item.total_loaded_weight}  {altUnit}</td>
                          <td className="center">{formatCurrency(qty)} {uom}</td>
                          <td className="center">{rateDisplay}</td>
                          <td className="center">{formatCurrency(totalAmount)}</td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td colSpan="4" className="center"><span className="bold">{t.total}</span></td>
                      <td className="center">
                        <span className="bold">{formatCurrency(totalAltQty)} qtl</span>
                      </td>
                      <td className="center">
                        <span className="bold">{formatCurrency(totalQty)} pkt</span>
                      </td>
                      <td></td>
                      <td className="center"><span className="bold">{formatCurrency(totalInvoiceAmount)}</span></td>
                    </tr>
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <tr>
                    <td colSpan="8" className="center">{t.noItemsFound}</td>
                  </tr>
                )}
                </tbody>
              </table>

              <table>
                <tbody>
                <tr>
                  <td style={{ width: '60%' }}>
                    <span className="bold">HSN/SAC</span>
                  </td>
                  <td style={{ width: '40%', textAlign: 'right' }}>
                    E. & O.E<br />
                    <span className="bold">Taxable<br />Value</span>
                  </td>
                </tr>
                {Object.entries(hsnMap).map(([hsn, value]) => (
                  <tr key={hsn}>
                    <td>{hsn}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(value)}</td>
                  </tr>
                ))}
                <tr>
                  <td></td>
                  <td style={{ textAlign: 'right' }}><span className="bold">{t.total}</span></td>
                </tr>
                <tr>
                  <td></td>
                  <td style={{ textAlign: 'right' }}><span className="bold">{formatCurrency(totalTaxableValue)}</span></td>
                </tr>
                </tbody>
              </table>

              <table>
                <tbody>
                <tr>
                  <td style={{ width: '50%' }}>
                    <div className="field">
                      <span className="field-label">Tax Amount (in words)</span>
                      <span className="field-value">{numberToWords(totalTaxableValue)}</span>
                    </div>
                    <div className="field">
                      <span className="field-label">Remarks</span>
                      <span className="field-value">
                        {displayData.vehicle_no ? `TO LORRY NO: ${displayData.vehicle_no}` : '-'}
                      </span>
                    </div>
                    {orgDetails.vat_tin && <div>Company's VAT TIN: {orgDetails.vat_tin}</div>}
                    {orgDetails.cst_no && <div>Company's CST No.: {orgDetails.cst_no}</div>}
                    {orgDetails.pan && <div>Company's PAN: {orgDetails.pan}</div>}
                  </td>
                  <td style={{ width: '50%', verticalAlign: 'bottom', textAlign: 'right' }}>
                    <div className="bold">for {orgDetails.organization || 'W B Agro Products Pvt Ltd'}</div>
                    <div style={{ height: '48px' }} />
                    <div className="bold">Authorised Signatory</div>
                  </td>
                </tr>
                </tbody>
              </table>

              <div className="jurisdiction-footer">
                SUBJECT TO RAYAPUR-DHARAWADA JURISDICTION
                <br />
                This is a Computer Generated Document
              </div>

              <div className="pdf-footer">
                <div>
                  Generated at:{" "}
                  {new Date().toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div>Powered by GrainsPro, Developed by MWB Technologies.</div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
