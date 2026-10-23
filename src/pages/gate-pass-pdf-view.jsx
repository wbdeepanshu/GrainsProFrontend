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

export default function GatePassPDFView() {
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
      back: "Back to Gate Pass Report",
      downloadPdf: "Download PDF",
      generating: "Generating...",
      translating: "Translating...",
      gatePass: "GATE PASS",
      gpNo: "GP No.",
      dated: "Dated",
      referenceNoDate: "Reference No. & Date",
      otherReference: "Other Reference",
      buyersOrderNo: "Buyer's Order No.",
      destination: "Destination",
      consigneeShipTo: "Consignee (Ship to)",
      billOfLading: "Bill of Lading/LR-RR No.",
      motorVehicleNo: "Motor Vehicle No.",
      siNo: "SI No.",
      descriptionOfGoods: "Description of Goods",
      quantity: "Quantity",
      per: "per",
      loadedQuantity: "Loaded Quantity",
      total: "Total",
      noItemsFound: "No items found",
      stateName: "State Name",
      code: "Code",
      contact: "Contact",
      email: "E-Mail",
      dt: "dt.",
      direct: "DIRECT",
      na: "N/A",
      loadingGatePass: "Loading gate pass details...",
      gatePassNotFound: "Gate pass not found",
      retailPackDivision: "(Retail Pack / Rice Division), PLOT NO 113 TO 116 &",
      industrialArea: "86 TO 89, INDUSTRIAL AREA, RAYAPUR,",
      cityLine: "DHARWAD-580009",
      stateLine: "Karnataka - 580009, India",
      fssai: "FSSAI",
      ph: "Ph:",
      cinNo: "CIN NO.",
      gstin: "GSTIN",
      pan: "PAN",
      panItNo: "PAN/IT No",
      batchPrefix: "Batch:",
      bagsSuffix: "bags",
    },
    hi: {
      back: "गेट पास रिपोर्ट पर वापस जाएं",
      downloadPdf: "पीडीएफ डाउनलोड",
      generating: "बन रहा है...",
      translating: "अनुवाद हो रहा है...",
      gatePass: "गेट पास",
      gpNo: "जीपी संख्या",
      dated: "दिनांक",
      referenceNoDate: "संदर्भ संख्या और दिनांक",
      otherReference: "अन्य संदर्भ",
      buyersOrderNo: "क्रेता आदेश संख्या",
      destination: "गंतव्य",
      consigneeShipTo: "प्राप्तकर्ता (शिप टू)",
      billOfLading: "बिल ऑफ लेडिंग/एलआर-आरआर संख्या",
      motorVehicleNo: "मोटर वाहन संख्या",
      siNo: "क्रम सं.",
      descriptionOfGoods: "माल का विवरण",
      quantity: "मात्रा",
      per: "प्रति",
      loadedQuantity: "लोड मात्रा",
      total: "कुल",
      noItemsFound: "कोई आइटम नहीं मिला",
      stateName: "राज्य का नाम",
      code: "कोड",
      contact: "संपर्क",
      email: "ई-मेल",
      dt: "दि.",
      direct: "प्रत्यक्ष",
      na: "उपलब्ध नहीं",
      loadingGatePass: "गेट पास विवरण लोड हो रहा है...",
      gatePassNotFound: "गेट पास नहीं मिला",
      retailPackDivision: "(रिटेल पैक / राइस डिवीजन), प्लॉट नं 113 से 116 और",
      industrialArea: "86 से 89, औद्योगिक क्षेत्र, रायापुर,",
      cityLine: "धारवाड़-580009",
      stateLine: "कर्नाटक - 580009, भारत",
      fssai: "एफएसएसएआई",
      ph: "फोन:",
      cinNo: "सीआईएन नं.",
      gstin: "जीएसटीआईएन",
      pan: "पैन",
      panItNo: "पैन/आईटी नं",
      batchPrefix: "बैच:",
      bagsSuffix: "बैग",
    },
    kn: {
      back: "ಗೇಟ್ ಪಾಸ್ ವರದಿಗೆ ಹಿಂತಿರುಗಿ",
      downloadPdf: "ಪಿಡಿಎಫ್ ಡೌನ್‌ಲೋಡ್",
      generating: "ರಚಿಸಲಾಗುತ್ತಿದೆ...",
      translating: "ಅನುವಾದಿಸಲಾಗುತ್ತಿದೆ...",
      gatePass: "ಗೇಟ್ ಪಾಸ್",
      gpNo: "ಜಿಪಿ ಸಂಖ್ಯೆ",
      dated: "ದಿನಾಂಕ",
      referenceNoDate: "ಉಲ್ಲೇಖ ಸಂಖ್ಯೆ ಮತ್ತು ದಿನಾಂಕ",
      otherReference: "ಇತರೆ ಉಲ್ಲೇಖ",
      buyersOrderNo: "ಖರೀದಿದಾರರ ಆದೇಶ ಸಂಖ್ಯೆ",
      destination: "ಗಮ್ಯಸ್ಥಾನ",
      consigneeShipTo: "ಸ್ವೀಕರಿಸುವವರು (ಶಿಪ್ ಟು)",
      billOfLading: "ಬಿಲ್ ಆಫ್ ಲೇಡಿಂಗ್/ಎಲ್‌ಆರ್-ಆರ್‌ಆರ್ ಸಂಖ್ಯೆ",
      motorVehicleNo: "ಮೋಟಾರ್ ವಾಹನ ಸಂಖ್ಯೆ",
      siNo: "ಕ್ರಮ ಸಂ.",
      descriptionOfGoods: "ಸರಕುಗಳ ವಿವರಣೆ",
      quantity: "ಪ್ರಮಾಣ",
      per: "ಪ್ರತಿ",
      loadedQuantity: "ಲೋಡ್ ಪ್ರಮಾಣ",
      total: "ಒಟ್ಟು",
      noItemsFound: "ಯಾವುದೇ ಐಟಂಗಳು ಸಿಗಲಿಲ್ಲ",
      stateName: "ರಾಜ್ಯದ ಹೆಸರು",
      code: "ಕೋಡ್",
      contact: "ಸಂಪರ್ಕ",
      email: "ಇ-ಮೇಲ್",
      dt: "ದಿ.",
      direct: "ನೇರ",
      na: "ಲಭ್ಯವಿಲ್ಲ",
      loadingGatePass: "ಗೇಟ್ ಪಾಸ್ ವಿವರಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...",
      gatePassNotFound: "ಗೇಟ್ ಪಾಸ್ ಸಿಗಲಿಲ್ಲ",
      retailPackDivision: "(ರಿಟೇಲ್ ಪ್ಯಾಕ್ / ರೈಸ್ ಡಿವಿಷನ್), ಪ್ಲಾಟ್ ಸಂಖ್ಯೆ 113 ರಿಂದ 116 ಮತ್ತು",
      industrialArea: "86 ರಿಂದ 89, ಇಂಡಸ್ಟ್ರಿಯಲ್ ಏರಿಯಾ, ರಾಯಾಪುರ,",
      cityLine: "ಧಾರವಾಡ-580009",
      stateLine: "ಕರ್ನಾಟಕ - 580009, ಭಾರತ",
      fssai: "ಎಫ್‌ಎಸ್‌ಎಸ್‌ಎಐ",
      ph: "ದೂರವಾಣಿ:",
      cinNo: "ಸಿಐಎನ್ ಸಂಖ್ಯೆ",
      gstin: "ಜಿಎಸ್ಟಿಐಎನ್",
      pan: "ಪ್ಯಾನ್",
      panItNo: "ಪ್ಯಾನ್/ಐಟಿ ಸಂಖ್ಯೆ",
      batchPrefix: "ಬ್ಯಾಚ್:",
      bagsSuffix: "ಚೀಲಗಳು",
    },
    gu: {
      back: "ગેટ પાસ રિપોર્ટ પર પાછા જાઓ",
      downloadPdf: "પીડીએફ ડાઉનલોડ",
      generating: "બનાવી રહ્યું છે...",
      translating: "અનુવાદ થઈ રહ્યો છે...",
      gatePass: "ગેટ પાસ",
      gpNo: "જીપી નંબર",
      dated: "તારીખ",
      referenceNoDate: "સંદર્ભ નંબર અને તારીખ",
      otherReference: "અન્ય સંદર્ભ",
      buyersOrderNo: "ખરીદદાર ઓર્ડર નંબર",
      destination: "ગંતવ્ય",
      consigneeShipTo: "પ્રાપ્તકર્તા (શિપ ટુ)",
      billOfLading: "બિલ ઓફ લેડિંગ/એલઆર-આરઆર નંબર",
      motorVehicleNo: "મોટર વાહન નંબર",
      siNo: "ક્રમ સં.",
      descriptionOfGoods: "માલનું વર્ણન",
      quantity: "જથ્થો",
      per: "પ્રતિ",
      loadedQuantity: "લોડ જથ્થો",
      total: "કુલ",
      noItemsFound: "કોઈ આઇટમ મળ્યા નથી",
      stateName: "રાજ્યનું નામ",
      code: "કોડ",
      contact: "સંપર્ક",
      email: "ઇ-મેઇલ",
      dt: "તા.",
      direct: "ડાયરેક્ટ",
      na: "ઉપલબ્ધ નથી",
      loadingGatePass: "ગેટ પાસ વિગતો લોડ થઈ રહી છે...",
      gatePassNotFound: "ગેટ પાસ મળ્યો નથી",
      retailPackDivision: "(રિટેલ પેક / રાઇસ ડિવિઝન), પ્લોટ નં. 113 થી 116 અને",
      industrialArea: "86 થી 89, ઇન્ડસ્ટ્રીયલ એરિયા, રાયાપુર,",
      cityLine: "ધારવાડ-580009",
      stateLine: "કર્ણાટક - 580009, ભારત",
      fssai: "એફએસએસએઆઈ",
      ph: "ફોન:",
      cinNo: "સીઆઈએન નં.",
      gstin: "જીએસટીઆઈએન",
      pan: "પેન",
      panItNo: "પેન/આઈટી નં",
      batchPrefix: "બેચ:",
      bagsSuffix: "બેગ્સ",
    },
  };
  const t = translations[selectedLanguage] || translations.en;

  // Fetch Gate Pass details
  useEffect(() => {
    if (!id) return;

    const fetchDetails = async () => {
      setIsLoading(true);
      try {
        const url = `${API_BASE_URL}/api/sales/outward-entries/${id}/`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${AuthService.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch gate pass details');
        }

        const data = await response.json();
        if (data.status && data.status !== 200) {
          throw new Error(data.message || 'Failed to fetch gate pass details');
        }

        setDetailsData(data.data);
      } catch (err) {
        toast({
          title: "Error",
          description: err.message || "Failed to load gate pass details",
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

  // Translate dynamic API content while preserving numbers/codes.
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
      if (Number.isNaN(date.getTime())) return String(dateString);
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

  // Generate PDF — same approach as Delivery Note (A4 clone + neat page break)
  const generatePDF = async () => {
    if (!detailsData) return;

    setIsGeneratingPDF(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const source = document.getElementById('gate-pass-content');
      if (!source) {
        throw new Error('Content element not found');
      }

      const captureWidthPx = 794; // ~210mm at 96dpi
      const clone = source.cloneNode(true);
      clone.id = 'gate-pass-content-print-clone';
      clone.querySelectorAll('style').forEach((styleEl) => {
        styleEl.textContent = String(styleEl.textContent || '').replaceAll(
          '#gate-pass-content',
          '#gate-pass-content-print-clone'
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

      if (overflow <= 28) {
        const scale = overflow > 0 ? pageContentHeight / imgHeight : 1;
        const drawWidth = imgWidth * scale;
        const drawHeight = imgHeight * scale;
        const x = sideMargin + (contentWidth - drawWidth) / 2;
        pdf.addImage(imgData, 'PNG', x, topMargin, drawWidth, drawHeight);
      } else {
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

      const fileName = `gate-pass-GP-${detailsData.outward_entry_no || detailsData.bill_no || id}-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      toast({
        title: "PDF Downloaded",
        description: "Gate Pass has been downloaded as PDF",
        className: "bg-green-50 border-green-100 text-green-800",
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
            <p className="text-gray-600">{t.loadingGatePass}</p>
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
            <p className="text-gray-600">{t.gatePassNotFound}</p>
            <Button
              variant="outline"
              onClick={() => setLocation("/outward/outward-list")}
              className="mt-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {/* {t.back} */}
              Back to Gate Pass Report
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Collect all items from sales orders
  const allItems = [];
  if (displayData.sales_orders) {
    displayData.sales_orders.forEach((soGroup) => {
      if (soGroup.items) {
        soGroup.items.forEach((item) => {
          allItems.push(item);
        });
      }
    });
  }

  // Get organization details
  const orgDetails = displayData.organization_info || orgInfo || {};
  const fontFamily = selectedLanguage === "hi"
    ? "'Noto Sans Devanagari', Arial, sans-serif"
    : selectedLanguage === "kn"
      ? "'Noto Sans Kannada', Arial, sans-serif"
      : selectedLanguage === "gu"
        ? "'Noto Sans Gujarati', Arial, sans-serif"
        : "Arial, sans-serif";

  return (
    <div className="flex h-screen bg-gray-50">
      {!isMobile && <Sidebar />}
      {isMobile && <MobileSidebar />}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setLocation("/outward/outward-list")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {/* {t.back} */}
              Back to Gate Pass Report
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
                  {/* {t.downloadPdf} */}
                  Download PDF
                </>
              )}
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-100">
          <div className="min-h-full w-full flex justify-center px-3 py-5 md:px-6 md:py-6">
            <div
              id="gate-pass-content"
              className="bg-white shadow-md w-full"
              style={{
                maxWidth: '210mm',
                padding: '16px 14px 20px 14px',
                boxSizing: 'border-box',
              }}
            >
              <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Kannada:wght@400;700&family=Noto+Sans+Gujarati:wght@400;700&display=swap');
                #gate-pass-content {
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
                .gate-pass-content {
                  font-family: ${fontFamily};
                  font-size: 11px;
                  margin: 0;
                  padding: 0;
                  width: 100%;
                  box-sizing: border-box;
                }
                .gate-pass-content .header {
                  font-size: 18px;
                  font-weight: 700;
                  text-align: center;
                  letter-spacing: 0.05em;
                  padding: 12px 10px;
                  margin: 0;
                  line-height: 1.3;
                  border: 1px solid #000;
                  border-bottom: none;
                  background: #f7f7f7;
                }
                .gate-pass-content table {
                  width: 100% !important;
                  border-collapse: collapse;
                  margin: 0;
                  table-layout: fixed;
                }
                .gate-pass-content td,
                .gate-pass-content th {
                  border: 1px solid #000;
                  padding: 8px 10px;
                  vertical-align: top;
                  word-wrap: break-word;
                  overflow-wrap: break-word;
                }
                .gate-pass-content th {
                  background: #f3f3f3;
                  font-weight: 700;
                  text-align: center;
                  vertical-align: middle;
                  font-size: 10px;
                  line-height: 1.25;
                }
                .gate-pass-content .center { text-align: center; }
                .gate-pass-content .bold { font-weight: 700; }
                .gate-pass-content .muted { color: #555; font-size: 10px; }
                .gate-pass-content .field { margin-bottom: 8px; }
                .gate-pass-content .field:last-child { margin-bottom: 0; }
                .gate-pass-content .field-label {
                  display: block;
                  font-size: 10px;
                  color: #555;
                  margin-bottom: 2px;
                }
                .gate-pass-content .field-value {
                  display: block;
                  font-weight: 700;
                  color: #111;
                  word-break: break-word;
                }
                .gate-pass-content .section-title {
                  font-weight: 700;
                  margin-bottom: 6px;
                  padding-bottom: 3px;
                  border-bottom: 1px solid #ddd;
                }
                .gate-pass-content .stack > div { margin-bottom: 2px; }
                .gate-pass-content .batch-line {
                  text-align: right;
                  padding-right: 8px;
                  color: #333;
                  font-size: 10px;
                }
                .gate-pass-content .jurisdiction-footer {
                  margin-top: 12px;
                  padding: 8px 4px 4px;
                  text-align: center;
                  font-size: 10px;
                  line-height: 1.55;
                  color: #000;
                }
                .gate-pass-content .pdf-footer {
                  margin-top: 2px;
                  padding-bottom: 2px;
                  text-align: center;
                  font-size: 9px;
                  color: #444;
                  line-height: 1.55;
                }
              `}</style>
              <div className="gate-pass-content">
                <div className="header">{t.gatePass}</div>

                <table>
                  <tbody>
                    <tr>
                      <td style={{ width: '42%' }}>
                        <div className="stack">
                          <div className="bold" style={{ fontSize: '13px' }}>
                            {orgDetails.organization || 'W B Agro Products Pvt Ltd.'}
                          </div>
                          {orgDetails.branch && <div className="muted">({orgDetails.branch})</div>}
                          <div>{t.retailPackDivision}</div>
                          <div>{t.industrialArea}</div>
                          <div>{t.cityLine}</div>
                          {orgDetails.fssai && <div>{t.fssai} {orgDetails.fssai}</div>}
                          {orgDetails.phone && <div>{t.ph} {orgDetails.phone}</div>}
                          {orgDetails.cin && <div>{t.cinNo} {orgDetails.cin}</div>}
                          {orgDetails.state_name && (
                            <div>
                              {t.stateName}: {orgDetails.state_name}, {t.code}: {orgDetails.state_code || '29'}
                            </div>
                          )}
                          {orgDetails.gstin && <div>{t.gstin}: {orgDetails.gstin}</div>}
                          {orgDetails.pan && <div>{t.pan}: {orgDetails.pan}</div>}
                          {orgDetails.contact && <div>{t.contact}: {orgDetails.contact}</div>}
                          {orgDetails.email && <div>{t.email}: {orgDetails.email}</div>}
                          {orgDetails.website && <div>{orgDetails.website}</div>}
                        </div>
                      </td>
                      <td style={{ width: '29%' }}>
                        <div className="field">
                          <span className="field-label">{t.gpNo}</span>
                          <span className="field-value">
                            {displayData.outward_entry_no || `GP-${displayData.bill_no || t.na}`}
                          </span>
                        </div>
                        <div className="field">
                          <span className="field-label">{t.referenceNoDate}</span>
                          <span className="field-value">
                            {displayData.sales_orders?.[0]?.so_number ||
                              displayData.sales_orders?.[0]?.order_id ||
                              t.na}{' '}
                            {t.dt}{' '}
                            {formatDate(displayData.date || displayData.sales_orders?.[0]?.order_date)}
                          </span>
                        </div>
                        <div className="field">
                          <span className="field-label">{t.buyersOrderNo}</span>
                          <span className="field-value">
                            {displayData.sales_orders?.[0]?.buyers_order_no || '-'}
                          </span>
                        </div>
                      </td>
                      <td style={{ width: '29%' }}>
                        <div className="field">
                          <span className="field-label">{t.dated}</span>
                          <span className="field-value">{formatDate(displayData.date)}</span>
                        </div>
                        <div className="field">
                          <span className="field-label">{t.otherReference}</span>
                          <span className="field-value">{t.direct}</span>
                        </div>
                        <div className="field">
                          <span className="field-label">{t.dated}</span>
                          <span className="field-value">{formatDate(displayData.date)}</span>
                        </div>
                        <div className="field">
                          <span className="field-label">{t.destination}</span>
                          <span className="field-value">RAYAPUR</span>
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
                          <div className="bold">
                            {displayData.sales_orders?.[0]?.customer_name || t.na}
                          </div>
                          <div>{t.retailPackDivision}</div>
                          <div>{t.industrialArea}</div>
                          <div>{t.cityLine}</div>
                          <div>{t.stateLine}</div>
                          {displayData.sales_orders?.[0]?.party_info?.gst_number && (
                            <div>GSTIN/UIN: {displayData.sales_orders[0].party_info.gst_number}</div>
                          )}
                          {orgDetails.pan && <div>{t.panItNo}: {orgDetails.pan}</div>}
                          <div>
                            {t.stateName}: Karnataka, {t.code}: 29
                          </div>
                          {displayData.sales_orders?.[0]?.party_info?.contact_number && (
                            <div>
                              {t.contact}: {displayData.sales_orders[0].party_info.contact_number}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ width: '25%' }}>
                        <div className="field">
                          <span className="field-label">{t.billOfLading}</span>
                          <span className="field-value">
                            {t.dt} {formatDate(displayData.date)}
                          </span>
                        </div>
                      </td>
                      <td style={{ width: '25%' }}>
                        <div className="field">
                          <span className="field-label">{t.motorVehicleNo}</span>
                          <span className="field-value">{displayData.vehicle_no || t.na}</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '5%' }}>{t.siNo}</th>
                      <th style={{ width: '50%' }}>{t.descriptionOfGoods}</th>
                      <th style={{ width: '15%' }}>{t.quantity}</th>
                      <th style={{ width: '10%' }}>{t.per}</th>
                      <th style={{ width: '20%' }}>{t.loadedQuantity}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allItems.length > 0 ? (
                      <>
                        {allItems.map((item, itemIndex) => {
                          const allBatches = [];
                          if (item.godowns && Array.isArray(item.godowns)) {
                            item.godowns.forEach((godownGroup) => {
                              if (godownGroup.batches && Array.isArray(godownGroup.batches)) {
                                godownGroup.batches.forEach((batch) => {
                                  allBatches.push({
                                    batch,
                                    godown: godownGroup.godown_name || godownGroup.godown || '',
                                  });
                                });
                              }
                            });
                          }

                          const qty = parseFloat(item.total_quantity || item.number_of_bags || 0);
                          const uom = item.item_unit || item.base_unit?.name || 'pkt';
                          const itemName = item.item_name || t.na;

                          if (allBatches.length === 0) {
                            return (
                              <tr key={`item-${item.id || itemIndex}`}>
                                <td className="center">{itemIndex + 1}</td>
                                <td>{itemName}</td>
                                <td className="center">{formatCurrency(qty)}</td>
                                <td className="center">{uom}</td>
                                <td className="center"></td>
                              </tr>
                            );
                          }

                          return (
                            <React.Fragment key={`item-${item.id || itemIndex}`}>
                              <tr>
                                <td className="center" rowSpan={allBatches.length + 1}>
                                  {itemIndex + 1}
                                </td>
                                <td>{itemName}</td>
                                <td className="center">{formatCurrency(qty)}</td>
                                <td className="center">{uom}</td>
                                <td className="center"></td>
                              </tr>
                              {allBatches.map((batchData, batchIdx) => {
                                const batch = batchData.batch;
                                const batchName = batch.name || t.na;
                                const batchBags = batch.number_of_bags
                                  ? Math.round(parseFloat(batch.number_of_bags))
                                  : 0;
                                const godownName = batchData.godown ? ` - ${batchData.godown}` : '';
                                const batchText = `${t.batchPrefix} ${batchName} (${batchBags} ${t.bagsSuffix})${godownName}`;
                                const noBags =
                                  batch.number_of_bags !== undefined && batch.number_of_bags !== null
                                    ? parseFloat(batch.number_of_bags)
                                    : 0;

                                return (
                                  <tr key={`batch-${item.id || itemIndex}-${batchIdx}`}>
                                    <td className="batch-line">{batchText}</td>
                                    <td className="center">
                                      {noBags > 0 ? formatCurrency(noBags) : ''}
                                    </td>
                                    <td></td>
                                    <td></td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                        <tr>
                          <td colSpan="2" className="center">
                            <span className="bold">{t.total}</span>
                          </td>
                          <td className="center">
                            <span className="bold">
                              {formatCurrency(
                                allItems.reduce(
                                  (sum, item) =>
                                    sum + parseFloat(item.total_quantity || item.number_of_bags || 0),
                                  0
                                )
                              )}
                            </span>
                          </td>
                          <td></td>
                          <td></td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td colSpan="5" className="center">
                          {t.noItemsFound}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="jurisdiction-footer">
                  SUBJECT TO RAYAPUR-DHARAWADA JURISDICTION
                  <br />
                  This is a Computer Generated Document
                </div>

                <div className="pdf-footer">
                  <div>
                    Generated at:{' '}
                    {new Date().toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
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
