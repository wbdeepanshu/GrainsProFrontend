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

export default function StockTransferVoucherPDFView() {
  const [, setLocation] = useLocation();
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
      back: "Back to Godown Transfer",
      downloadPdf: "Download PDF",
      generating: "Generating...",
      translating: "Translating...",
      title: "STOCK TRANSFER VOUCHER",
      voucherNo: "Voucher No.",
      transferDate: "Transfer Date",
      status: "Status",
      transitMode: "Transit Mode",
      vehicleNumber: "Vehicle Number",
      driverName: "Driver Name",
      hamaliGroup: "Hamali Group",
      sourceGodown: "Source Branch",
      destinationGodown: "Destination Branch",
      dispatchedBy: "Dispatched By",
      receivedBy: "Received By",
      receivedAt: "Received At",
      items: "Items",
      siNo: "SI No.",
      stockItem: "Stock Item",
      batch: "Batch",
      dispatched: "Dispatched",
      received: "Received",
      uom: "UOM",
      itemStatus: "Item Status",
      total: "Total",
      noItemsFound: "No items found",
      na: "N/A",
      loadingDetails: "Loading voucher details...",
      voucherNotFound: "Voucher not found",
      transferInformation: "Transfer Information",
      sourceSection: "Source Section",
      destinationSection: "Destination Section",
      sourceGodownCol: "Source Godown",
      destinationGodownCol: "Destination Godown",
      noSourceLines: "No source lines",
      noDestinationLines: "No destination allocations",
    },
    hi: {
      back: "स्टॉक ट्रांसफर पर वापस जाएं",
      downloadPdf: "पीडीएफ डाउनलोड",
      generating: "बन रहा है...",
      translating: "अनुवाद हो रहा है...",
      title: "स्टॉक ट्रांसफर वाउचर",
      voucherNo: "वाउचर संख्या",
      transferDate: "ट्रांसफर तिथि",
      status: "स्थिति",
      transitMode: "परिवहन मोड",
      vehicleNumber: "वाहन संख्या",
      driverName: "चालक का नाम",
      hamaliGroup: "हमाली समूह",
      sourceGodown: "स्रोत गोदाम",
      destinationGodown: "गंतव्य गोदाम",
      dispatchedBy: "प्रेषक",
      receivedBy: "प्राप्तकर्ता",
      receivedAt: "प्राप्ति समय",
      items: "वस्तुएं",
      siNo: "क्रम सं.",
      stockItem: "स्टॉक वस्तु",
      batch: "बैच",
      dispatched: "प्रेषित",
      received: "प्राप्त",
      uom: "इकाई",
      itemStatus: "वस्तु स्थिति",
      total: "कुल",
      noItemsFound: "कोई आइटम नहीं मिला",
      na: "उपलब्ध नहीं",
      loadingDetails: "वाउचर विवरण लोड हो रहा है...",
      voucherNotFound: "वाउचर नहीं मिला",
      transferInformation: "ट्रांसफर जानकारी",
    },
    kn: {
      back: "ಸ್ಟಾಕ್ ವರ್ಗಾವಣೆಗೆ ಹಿಂತಿರುಗಿ",
      downloadPdf: "ಪಿಡಿಎಫ್ ಡೌನ್‌ಲೋಡ್",
      generating: "ರಚಿಸಲಾಗುತ್ತಿದೆ...",
      translating: "ಅನುವಾದಿಸಲಾಗುತ್ತಿದೆ...",
      title: "ಸ್ಟಾಕ್ ವರ್ಗಾವಣೆ ವೋಚರ್",
      voucherNo: "ವೋಚರ್ ಸಂಖ್ಯೆ",
      transferDate: "ವರ್ಗಾವಣೆ ದಿನಾಂಕ",
      status: "ಸ್ಥಿತಿ",
      transitMode: "ಸಾರಿಗೆ ಮೋಡ್",
      vehicleNumber: "ವಾಹನ ಸಂಖ್ಯೆ",
      driverName: "ಚಾಲಕನ ಹೆಸರು",
      hamaliGroup: "ಹಮಾಲಿ ಗುಂಪು",
      sourceGodown: "ಮೂಲ ಗೋದಾಮು",
      destinationGodown: "ಗಮ್ಯ ಗೋದಾಮು",
      dispatchedBy: "ರವಾನಿಸಿದವರು",
      receivedBy: "ಸ್ವೀಕರಿಸಿದವರು",
      receivedAt: "ಸ್ವೀಕರಿಸಿದ ಸಮಯ",
      items: "ಐಟಂಗಳು",
      siNo: "ಕ್ರಮ ಸಂ.",
      stockItem: "ಸ್ಟಾಕ್ ಐಟಂ",
      batch: "ಬ್ಯಾಚ್",
      dispatched: "ರವಾನಿಸಲಾಗಿದೆ",
      received: "ಸ್ವೀಕರಿಸಲಾಗಿದೆ",
      uom: "ಘಟಕ",
      itemStatus: "ಐಟಂ ಸ್ಥಿತಿ",
      total: "ಒಟ್ಟು",
      noItemsFound: "ಯಾವುದೇ ಐಟಂಗಳು ಸಿಗಲಿಲ್ಲ",
      na: "ಲಭ್ಯವಿಲ್ಲ",
      loadingDetails: "ವೋಚರ್ ವಿವರಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...",
      voucherNotFound: "ವೋಚರ್ ಸಿಗಲಿಲ್ಲ",
      transferInformation: "ವರ್ಗಾವಣೆ ಮಾಹಿತಿ",
    },
    gu: {
      back: "સ્ટોક ટ્રાન્સફર પર પાછા જાઓ",
      downloadPdf: "પીડીએફ ડાઉનલોડ",
      generating: "બનાવી રહ્યું છે...",
      translating: "અનુવાદ થઈ રહ્યો છે...",
      title: "સ્ટોક ટ્રાન્સફર વાઉચર",
      voucherNo: "વાઉચર નંબર",
      transferDate: "ટ્રાન્સફર તારીખ",
      status: "સ્થિતિ",
      transitMode: "પરિવહન મોડ",
      vehicleNumber: "વાહન નંબર",
      driverName: "ડ્રાઈવરનું નામ",
      hamaliGroup: "હમાલી જૂથ",
      sourceGodown: "સ્ત્રોત ગોદામ",
      destinationGodown: "ગંતવ્ય ગોદામ",
      dispatchedBy: "મોકલનાર",
      receivedBy: "મેળવનાર",
      receivedAt: "મેળવ્યાનો સમય",
      items: "આઈટમ્સ",
      siNo: "ક્રમ સં.",
      stockItem: "સ્ટોક આઈટમ",
      batch: "બેચ",
      dispatched: "મોકલ્યું",
      received: "મેળવ્યું",
      uom: "એકમ",
      itemStatus: "આઈટમ સ્થિતિ",
      total: "કુલ",
      noItemsFound: "કોઈ આઈટમ મળી નથી",
      na: "ઉપલબ્ધ નથી",
      loadingDetails: "વાઉચર વિગતો લોડ થઈ રહી છે...",
      voucherNotFound: "વાઉચર મળ્યો નથી",
      transferInformation: "ટ્રાન્સફર માહિતી",
    },
  };
  const t = translations[selectedLanguage] || translations.en;

  useEffect(() => {
    if (!id) return;

    const fetchDetails = async () => {
      setIsLoading(true);
      try {
        const url = `${API_BASE_URL}/api/voucher/stock-transfer-vouchers/${id}/`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${AuthService.getAccessToken()}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch stock transfer voucher details");
        }

        const data = await response.json();
        if (data.status && data.status !== 200) {
          throw new Error(
            data.message || "Failed to fetch stock transfer voucher details"
          );
        }

        setDetailsData(data.data);
      } catch (err) {
        toast({
          title: "Error",
          description:
            err.message || "Failed to load stock transfer voucher details",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [id, toast, API_BASE_URL]);

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const org = await fetchOrgInfo();
        setOrgInfo(org);
      } catch (err) {
        console.error("Failed to fetch org info:", err);
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
      // Lowercase snake_case identifiers (e.g. pending, dispatched values that
      // back-end keys depend on). Keep as-is so no comparisons break.
      if (/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(s)) return true;
      return false;
    };
    const cache = new Map();
    const translateKeepNumbers = async (value) => {
      const raw = String(value ?? "");
      if (
        !raw ||
        selectedLanguage === "en" ||
        isOnlyNumericLike(raw) ||
        isLikelyCodeOrIdentifier(raw)
      )
        return raw;
      const cacheKey = `${selectedLanguage}::${raw}`;
      if (cache.has(cacheKey)) return cache.get(cacheKey);
      try {
        const parts = raw.split(/(\d+(?:[.,:/-]\d+)*)/g).filter(Boolean);
        const out = [];
        for (const part of parts) {
          if (
            /\d/.test(part) ||
            isOnlyNumericLike(part) ||
            isLikelyCodeOrIdentifier(part)
          ) {
            out.push(part);
            continue;
          }
          const trimmed = part.trim();
          if (!trimmed) {
            out.push(part);
            continue;
          }
          const resp = await fetch(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
              selectedLanguage
            )}&dt=t&q=${encodeURIComponent(trimmed)}`
          );
          if (!resp.ok) {
            out.push(part);
            continue;
          }
          const json = await resp.json();
          const translated = Array.isArray(json?.[0])
            ? json[0].map((seg) => seg?.[0] || "").join("")
            : trimmed;
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
    return () => {
      cancelled = true;
    };
  }, [detailsData, selectedLanguage]);

  const generatePDF = async () => {
    if (!detailsData) return;

    setIsGeneratingPDF(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const html2canvas = (await import("html2canvas")).default;

      const element = document.getElementById("stock-transfer-voucher-content");
      if (!element) {
        throw new Error("Content element not found");
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const imgData = canvas.toDataURL("image/png");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const topMargin = 0;
      const bottomMargin = 15;
      const sideMargin = 5;
      const ratio = Math.min(
        (pdfWidth - sideMargin * 2) / imgWidth,
        (pdfHeight - topMargin - bottomMargin) / imgHeight
      );
      const imgScaledWidth = imgWidth * ratio;
      const imgScaledHeight = imgHeight * ratio;
      const xOffset = sideMargin;
      const yOffset = topMargin;

      const usableHeight = pdfHeight - topMargin - bottomMargin;
      const pageCount = Math.ceil(imgScaledHeight / usableHeight);

      for (let i = 0; i < pageCount; i++) {
        if (i > 0) {
          pdf.addPage();
        }
        const yPos = -(i * usableHeight) + yOffset;
        pdf.addImage(imgData, "PNG", xOffset, yPos, imgScaledWidth, imgScaledHeight);
      }

      const fileName = `stock-transfer-voucher-${
        detailsData.voucher_number || id
      }-${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(fileName);

      toast({
        title: "PDF Downloaded",
        description: "Stock Transfer Voucher has been downloaded as PDF",
        className: "bg-green-50 border-green-100 text-green-800",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
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
            <p className="text-gray-600">{t.loadingDetails}</p>
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
            <p className="text-gray-600">{t.voucherNotFound}</p>
            <Button
              variant="outline"
              onClick={() => setLocation("/stock-transfer")}
              className="mt-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t.back}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const orgDetails = displayData.organization_info || orgInfo || {};
  const sourceSection = Array.isArray(displayData.source_section)
    ? displayData.source_section
    : Array.isArray(displayData.items)
    ? displayData.items.map((line) => ({
        stock_item_name: line.stock_item_name,
        godown_name: line.source_godown_name,
        batch_name: line.source_batch_name || line.batch_name,
        dispatched_qty: line.dispatched_qty,
        uom_name: line.uom_name,
        item_status: line.item_status,
      }))
    : [];
  const destinationSection = Array.isArray(displayData.destination_section)
    ? displayData.destination_section
    : [];
  const transitLabel =
    displayData.transit_mode === "hamali" ? "Hamali / Labour" : "Vehicle";

  const fontFamily =
    selectedLanguage === "hi"
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
              onClick={() => setLocation("/stock-transfer")}
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
        <div className="flex-1 overflow-y-auto p-6">
          <div
            id="stock-transfer-voucher-content"
            className="max-w-4xl mx-auto bg-white"
            style={{ padding: "0" }}
          >
            <style>{`
              @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Kannada:wght@400;700&family=Noto+Sans+Gujarati:wght@400;700&display=swap');
              #stock-transfer-voucher-content {
                margin: 0 !important;
                padding: 0 !important;
              }
              .st-voucher-content {
                font-family: ${fontFamily};
                font-size: 11px;
                margin: 0;
                padding: 0;
                color: #111;
              }
              .st-voucher-content .header {
                font-size: 16px;
                font-weight: bold;
                text-align: center;
                padding: 4px 10px;
                margin: 0 0 6px 0;
              }
              .st-voucher-content table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 0;
              }
              .st-voucher-content td,
              .st-voucher-content th {
                border: 1px solid black;
                padding: 5px 6px;
                vertical-align: top;
              }
              .st-voucher-content th {
                background: #f3f4f6;
                text-align: left;
                font-weight: bold;
              }
              .st-voucher-content .center {
                text-align: center;
              }
              .st-voucher-content .right {
                text-align: right;
              }
              .st-voucher-content .bold {
                font-weight: bold;
              }
              .st-voucher-content .label {
                font-size: 10px;
                color: #555;
                display: block;
                margin-bottom: 2px;
              }
              .st-voucher-content .value {
                font-weight: bold;
              }
              .st-voucher-content .section-title {
                font-size: 12px;
                font-weight: bold;
                margin: 8px 0 4px 0;
              }
            `}</style>

            <div className="st-voucher-content">
              <div className="header">{t.title}</div>

              {/* Organization + Voucher info */}
              <table>
                <tbody>
                  <tr>
                    <td style={{ width: "60%" }}>
                      <div className="bold" style={{ fontSize: "13px" }}>
                        {orgDetails.organization || "W B Agro Products Pvt Ltd."}
                      </div>
                      {orgDetails.branch && <div>({orgDetails.branch})</div>}
                      {orgDetails.address && <div>{orgDetails.address}</div>}
                      {orgDetails.phone && <div>Ph: {orgDetails.phone}</div>}
                      {orgDetails.gstin && <div>GSTIN: {orgDetails.gstin}</div>}
                      {orgDetails.email && <div>Email: {orgDetails.email}</div>}
                    </td>
                    <td style={{ width: "40%" }}>
                      <div>
                        <span className="label">{t.voucherNo}</span>
                        <span className="value">
                          {displayData.voucher_number || t.na}
                        </span>
                      </div>
                      <div style={{ marginTop: "4px" }}>
                        <span className="label">{t.transferDate}</span>
                        <span className="value">
                          {displayData.transfer_date || t.na}
                        </span>
                      </div>
                      <div style={{ marginTop: "4px" }}>
                        <span className="label">{t.status}</span>
                        <span
                          className="value"
                          style={{ textTransform: "capitalize" }}
                        >
                          {displayData.status || t.na}
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Transfer Information */}
              <div className="section-title">{t.transferInformation}</div>
              <table>
                <tbody>
                  <tr>
                    <td style={{ width: "33.33%" }}>
                      <span className="label">{t.sourceGodown}</span>
                      <span className="value">
                        {displayData.source_branch_name ||
                          displayData.source_godown_name ||
                          t.na}
                      </span>
                    </td>
                    <td style={{ width: "33.33%" }}>
                      <span className="label">{t.destinationGodown}</span>
                      <span className="value">
                        {displayData.destination_branch_name ||
                          displayData.destination_godown_name ||
                          t.na}
                      </span>
                    </td>
                    <td style={{ width: "33.33%" }}>
                      <span className="label">{t.transitMode}</span>
                      <span className="value">{transitLabel}</span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className="label">{t.vehicleNumber}</span>
                      <span className="value">
                        {displayData.vehicle_number || t.na}
                      </span>
                    </td>
                    <td>
                      <span className="label">{t.driverName}</span>
                      <span className="value">
                        {displayData.driver_name || t.na}
                      </span>
                    </td>
                    <td>
                      <span className="label">{t.hamaliGroup}</span>
                      <span className="value">
                        {displayData.hamali_group_name || t.na}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className="label">{t.dispatchedBy}</span>
                      <span className="value">
                        {displayData.dispatched_by || t.na}
                      </span>
                    </td>
                    <td>
                      <span className="label">{t.receivedBy}</span>
                      <span className="value">
                        {displayData.received_by || t.na}
                      </span>
                    </td>
                    <td>
                      <span className="label">{t.receivedAt}</span>
                      <span className="value">
                        {displayData.received_at || t.na}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Source section */}
              <div className="section-title">
                {t.sourceSection || "Source Section"} ({sourceSection.length})
              </div>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "6%" }} className="center">
                      {t.siNo}
                    </th>
                    <th style={{ width: "24%" }}>{t.stockItem}</th>
                    <th style={{ width: "22%" }}>{t.sourceGodownCol || t.sourceGodown}</th>
                    <th style={{ width: "18%" }}>{t.batch}</th>
                    <th style={{ width: "12%" }} className="right">
                      {t.dispatched}
                    </th>
                    <th style={{ width: "8%" }}>{t.uom}</th>
                    <th style={{ width: "10%" }}>{t.itemStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceSection.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="center">
                        {t.noSourceLines || t.noItemsFound}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {sourceSection.map((line, idx) => (
                        <tr key={`src-${line.item_id || idx}`}>
                          <td className="center">{idx + 1}</td>
                          <td>{line.stock_item_name || t.na}</td>
                          <td>{line.godown_name || line.source_godown_name || "-"}</td>
                          <td>{line.batch_name || line.source_batch_name || "-"}</td>
                          <td className="right">{line.dispatched_qty ?? line.quantity ?? "-"}</td>
                          <td>{line.uom_name || "-"}</td>
                          <td style={{ textTransform: "capitalize" }}>
                            {/* {line.item_status || "-"} */}
                            Dispatched
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={4} className="right bold">
                          {t.total}
                        </td>
                        <td className="right bold">
                          {displayData.total_dispatched_qty ??
                            sourceSection.reduce(
                              (sum, l) =>
                                sum + Number(l.dispatched_qty ?? l.quantity ?? 0),
                              0
                            )}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>

              {/* Destination section */}
              <div className="section-title">
                {t.destinationSection || "Destination Section"} ({destinationSection.length})
              </div>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "6%" }} className="center">
                      {t.siNo}
                    </th>
                    <th style={{ width: "24%" }}>{t.stockItem}</th>
                    <th style={{ width: "22%" }}>{t.destinationGodownCol || t.destinationGodown}</th>
                    <th style={{ width: "18%" }}>{t.batch}</th>
                    <th style={{ width: "12%" }} className="right">
                      {t.received}
                    </th>
                    <th style={{ width: "8%" }}>{t.uom}</th>
                    <th style={{ width: "10%" }}>{t.itemStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {destinationSection.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="center">
                        {t.noDestinationLines || t.noItemsFound}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {destinationSection.map((line, idx) => (
                        <tr key={`dst-${line.id || idx}`}>
                          <td className="center">{idx + 1}</td>
                          <td>{line.stock_item_name || t.na}</td>
                          <td>{line.godown_name || line.destination_godown_name || "-"}</td>
                          <td>{line.batch_name || line.destination_batch_name || "-"}</td>
                          <td className="right">{line.received_qty ?? line.quantity ?? "-"}</td>
                          <td>{line.uom_name || "-"}</td>
                          <td style={{ textTransform: "capitalize" }}>
                            {line.status || "-"}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={4} className="right bold">
                          {t.total}
                        </td>
                        <td className="right bold">
                          {displayData.total_destination_qty ??
                            displayData.total_received_qty ??
                            destinationSection.reduce(
                              (sum, l) =>
                                sum + Number(l.received_qty ?? l.quantity ?? 0),
                              0
                            )}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
