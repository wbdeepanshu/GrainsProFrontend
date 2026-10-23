import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { Receipt, Menu, Filter, Truck, Search, Eye, Calendar, Package, User, MapPin, Phone, Mail, IndianRupee, Download, Loader2, Building, Hash, Percent, FileText, ChevronsUpDown, Check, CalendarIcon } from "lucide-react";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchOrgInfo, getOrgInfoSync } from "@/lib/orgInfo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar as CalendarComponent } from "../components/ui/calendar";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, parse } from "date-fns";

const today = new Date();

/** Parse invoice created_at for filtering (API may return DD-MM-YYYY HH:mm:ss or ISO). */
const parseInvoiceCreatedAt = (value) => {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  const ddMmYyyyTime = /^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/;
  const m = s.match(ddMmYyyyTime);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]) - 1;
    const year = Number(m[3]);
    const hh = m[4] != null ? Number(m[4]) : 0;
    const mm = m[5] != null ? Number(m[5]) : 0;
    const ss = m[6] != null ? Number(m[6]) : 0;
    const d = new Date(year, month, day, hh, mm, ss);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t);
  return null;
};

const capitalizeFirst = (str) => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/** Google Translate–style helper: preserves digit groups; skips codes/URLs. */
function createInvoicePdfTranslators(targetLang) {
  const cache = new Map();
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
  const translateKeepNumbers = async (value) => {
    const raw = String(value ?? "");
    if (!raw || targetLang === "en" || isOnlyNumericLike(raw) || isLikelyCodeOrIdentifier(raw)) return raw;
    const cacheKey = `${targetLang}::${raw}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    try {
      const parts = raw.split(/(\d+(?:[.,:/-]\d+)*)/g).filter((p) => p !== "");
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
        const resp = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(trimmed)}`
        );
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
  return { translateKeepNumbers, translateDeep };
}

const INVOICE_PDF_LABELS = {
  en: {
    invoiceTitle: "INVOICE",
    buyerShipTo: "Buyer(Ship to)",
    gstinUin: "GSTIN/UIN:",
    contact: "Contact:",
    stateName: "State Name:",
    email: "E-Mail:",
    phone: "Phone:",
    invoiceNo: "Invoice No:",
    eWayBillNo: "e-Way Bill No",
    dated: "Dated:",
    deliveryNote: "Delivery Note",
    referenceNoDate: "Reference No & Date",
    otherReference: "Other Reference",
    buyersOrderNo: "Buyer's Order No.",
    dispatchDocNo: "Dispatch Doc No.",
    deliveryNoteDate: "Delivery Note Date:",
    dispatchedThrough: "Dispatched through",
    destination: "Destination",
    billOfLanding: "Bill of Landing/LR-RR NO",
    dtPrefix: "dt,",
    motorVehicleNo: "Motor Vehicle No",
    slNoHtml: "Sl<br />No",
    descriptionOfGoods: "Description of Goods",
    hsnSac: "HSN/SAC",
    gstRate: "GST Rate",
    qty: "QTY",
    rate: "Rate",
    amount: "Amount",
    per: "per",
    outputCgstAt: "OUTPUT CGST @",
    outputSgstAt: "OUTPUT SGST @",
    total: "Total",
    amountChargeableWords: "Amount Chargeable (in words):",
    only: "Only",
    eAndOE: "E & O.E",
    taxableValueHtml: "Taxable <br />Value",
    cgst: "CGST",
    sgstUtgst: "SGST/UTGST",
    rateHdr: "Rate",
    amountHdr: "Amount",
    taxAmountWords: "Tax Amount (in words) :",
    remarks: "Remarks:",
    beingMaterial: "BEING MATERIAL DISPATCH THROUGH VEHICLE NO :",
    declaration: "Declaration:",
    declarationBody:
      "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct. Payment terms: Net 30 days from invoice date. Interest @18% per annum will be charged on overdue payments.",
    companyBank: "Company's Bank Details:",
    acHolder: "A/c Holder's Name:",
    bankName: "Bank Name:",
    acNo: "A/c No:",
    branchIfsc: "Branch & IFSC Code:",
    forPrefix: "for",
    authorisedSignature: "Authorised Signature",
    subjectJurisdiction: "SUBJECT TO BANGALORE JURISDICTION",
    computerGenerated: "This is a Computer Generated Invoice",
    selectLanguageTitle: "PDF language",
    selectLanguageHint: "Choose the language for the invoice PDF. Numbers and codes stay unchanged.",
    downloadInLanguage: "Download",
    cancel: "Cancel",
  },
  hi: {
    invoiceTitle: "चालान",
    buyerShipTo: "क्रेता (शिप टू)",
    gstinUin: "जीएसटीआईएन/यूआईएन:",
    contact: "संपर्क:",
    stateName: "राज्य का नाम:",
    email: "ई-मेल:",
    phone: "फोन:",
    invoiceNo: "चालान संख्या:",
    eWayBillNo: "ई-वे बिल नं.",
    dated: "दिनांक:",
    deliveryNote: "डिलीवरी नोट",
    referenceNoDate: "संदर्भ संख्या और दिनांक",
    otherReference: "अन्य संदर्भ",
    buyersOrderNo: "क्रेता आदेश नं.",
    dispatchDocNo: "डिस्पैच दस्तावेज़ नं.",
    deliveryNoteDate: "डिलीवरी नोट दिनांक:",
    dispatchedThrough: "भेजा गया द्वारा",
    destination: "गंतव्य",
    billOfLanding: "बिल ऑफ लैंडिंग/एलआर-आरआर नं.",
    dtPrefix: "दिनांक,",
    motorVehicleNo: "मोटर वाहन नं.",
    slNoHtml: "क्रम<br />सं.",
    descriptionOfGoods: "माल का विवरण",
    hsnSac: "एचएसएन/एसएसी",
    gstRate: "जीएसटी दर",
    qty: "मात्रा",
    rate: "दर",
    amount: "राशि",
    per: "प्रति",
    outputCgstAt: "आउटपुट सीजीएसटी @",
    outputSgstAt: "आउटपुट एसजीएसटी @",
    total: "कुल",
    amountChargeableWords: "देय राशि (शब्दों में):",
    only: "मात्र",
    eAndOE: "ई. एंड ओ.ई",
    taxableValueHtml: "कर योग्य <br />मूल्य",
    cgst: "सीजीएसटी",
    sgstUtgst: "एसजीएसटी/यूटीजीएसटी",
    rateHdr: "दर",
    amountHdr: "राशि",
    taxAmountWords: "कर राशि (शब्दों में) :",
    remarks: "टिप्पणी:",
    beingMaterial: "वाहन नं. के माध्यम से सामान भेजा जा रहा है :",
    declaration: "घोषणा:",
    declarationBody:
      "हम घोषणा करते हैं कि यह चालान वर्णित वस्तुओं का वास्तविक मूल्य दर्शाता है और सभी विवरण सत्य और सही हैं। भुगतान की शर्तें: चालान दिनांक से 30 दिन नेट। विलंबित भुगतान पर वार्षिक 18% ब्याज लिया जाएगा।",
    companyBank: "कंपनी के बैंक विवरण:",
    acHolder: "खाताधारक का नाम:",
    bankName: "बैंक का नाम:",
    acNo: "खाता संख्या:",
    branchIfsc: "शाखा और आईएफएससी कोड:",
    forPrefix: "के लिए",
    authorisedSignature: "अधिकृत हस्ताक्षर",
    subjectJurisdiction: "बैंगलोर न्यायाधिकरण के अधीन",
    computerGenerated: "यह कंप्यूटर जनित चालान है",
    selectLanguageTitle: "पीडीएफ भाषा",
    selectLanguageHint: "चालान पीडीएफ की भाषा चुनें। संख्याएँ और कोड वैसे ही रहेंगे।",
    downloadInLanguage: "डाउनलोड",
    cancel: "रद्द करें",
  },
  kn: {
    invoiceTitle: "ಸರಕುಪಟ್ಟಿ",
    buyerShipTo: "ಖರೀದಿದಾರ (ಶಿಪ್ ಟು)",
    gstinUin: "ಜಿಎಸ್ಟಿಐಎನ್/ಯುಐಎನ್:",
    contact: "ಸಂಪರ್ಕ:",
    stateName: "ರಾಜ್ಯದ ಹೆಸರು:",
    email: "ಇ-ಮೇಲ್:",
    phone: "ಫೋನ್:",
    invoiceNo: "ಸರಕುಪಟ್ಟಿ ಸಂಖ್ಯೆ:",
    eWayBillNo: "ಇ-ವೇ ಬಿಲ್ ಸಂ.",
    dated: "ದಿನಾಂಕ:",
    deliveryNote: "ಡೆಲಿವರಿ ನೋಟ್",
    referenceNoDate: "ಉಲ್ಲೇಖ ಸಂಖ್ಯೆ ಮತ್ತು ದಿನಾಂಕ",
    otherReference: "ಇತರೆ ಉಲ್ಲೇಖ",
    buyersOrderNo: "ಖರೀದಿದಾರರ ಆದೇಶ ಸಂಖ್ಯೆ",
    dispatchDocNo: "ರವಾನೆ ಡಾಕ್ ಸಂಖ್ಯೆ",
    deliveryNoteDate: "ಡೆಲಿವರಿ ನೋಟ್ ದಿನಾಂಕ:",
    dispatchedThrough: "ಇದರ ಮೂಲಕ ರವಾನೆ",
    destination: "ಗಮ್ಯಸ್ಥಾನ",
    billOfLanding: "ಬಿಲ್ ಆಫ್ ಲ್ಯಾಂಡಿಂಗ್/ಎಲ್‌ಆರ್-ಆರ್‌ಆರ್ ಸಂ.",
    dtPrefix: "ದಿನಾಂಕ,",
    motorVehicleNo: "ಮೋಟಾರ್ ವಾಹನ ಸಂಖ್ಯೆ",
    slNoHtml: "ಕ್ರಮ<br />ಸಂ.",
    descriptionOfGoods: "ಸರಕುಗಳ ವಿವರಣೆ",
    hsnSac: "HSN/SAC",
    gstRate: "ಜಿಎಸ್ಟಿ ದರ",
    qty: "ಪ್ರಮಾಣ",
    rate: "ದರ",
    amount: "ಮೊತ್ತ",
    per: "ಪ್ರತಿ",
    outputCgstAt: "ಔಟ್‌ಪುಟ್ ಸಿಜಿಎಸ್ಟಿ @",
    outputSgstAt: "ಔಟ್‌ಪುಟ್ ಎಸ್‌ಜಿಎಸ್ಟಿ @",
    total: "ಒಟ್ಟು",
    amountChargeableWords: "ವಿಧಿಸಬಹುದಾದ ಮೊತ್ತ (ಪದಗಳಲ್ಲಿ):",
    only: "ಮಾತ್ರ",
    eAndOE: "ಇ. ಮತ್ತು ಓ.ಇ",
    taxableValueHtml: "ತೆರಿಗೆ ಯೋಗ್ಯ <br />ಮೌಲ್ಯ",
    cgst: "ಸಿಜಿಎಸ್ಟಿ",
    sgstUtgst: "ಎಸ್‌ಜಿಎಸ್ಟಿ/ಯುಟಿಜಿಎಸ್ಟಿ",
    rateHdr: "ದರ",
    amountHdr: "ಮೊತ್ತ",
    taxAmountWords: "ತೆರಿಗೆ ಮೊತ್ತ (ಪದಗಳಲ್ಲಿ) :",
    remarks: "ಟಿಪ್ಪಣಿ:",
    beingMaterial: "ವಾಹನ ಸಂಖ್ಯೆಯ ಮೂಲಕ ಸಾಮಾನು ರವಾನೆ :",
    declaration: "ಘೋಷಣೆ:",
    declarationBody:
      "ಈ ಸರಕುಪಟ್ಟಿಯು ವಿವರಿಸಲಾದ ಸರಕುಗಳ ನಿಜವಾದ ಬೆಲೆಯನ್ನು ತೋರಿಸುತ್ತದೆ ಮತ್ತು ಎಲ್ಲಾ ವಿವರಗಳು ಸತ್ಯ ಮತ್ತು ಸರಿಯಾಗಿವೆ ಎಂದು ನಾವು ಘೋಷಿಸುತ್ತೇವೆ. ಪಾವತಿ ನಿಯಮಗಳು: ಸರಕುಪಟ್ಟಿ ದಿನಾಂಕದಿಂದ 30 ದಿನಗಳ ನೆಟ್. ವಿಳಂಬಿತ ಪಾವತಿಗಳ ಮೇಲೆ ವಾರ್ಷಿಕ 18% ಬಡ್ಡಿ ವಿಧಿಸಲಾಗುವುದು.",
    companyBank: "ಕಂಪನಿಯ ಬ್ಯಾಂಕ್ ವಿವರಗಳು:",
    acHolder: "ಖಾತೆದಾರರ ಹೆಸರು:",
    bankName: "ಬ್ಯಾಂಕ್ ಹೆಸರು:",
    acNo: "ಖಾತೆ ಸಂಖ್ಯೆ:",
    branchIfsc: "ಶಾಖೆ ಮತ್ತು ಐಎಫ್‌ಎಸ್‌ಸಿ ಕೋಡ್:",
    forPrefix: "ಇವರಿಗೆ",
    authorisedSignature: "ಅಧಿಕೃತ ಸಹಿ",
    subjectJurisdiction: "ಬೆಂಗಳೂರು ನ್ಯಾಯವ್ಯಾಪ್ತಿಗೆ ಒಳಪಟ್ಟಿದೆ",
    computerGenerated: "ಇದು ಕಂಪ್ಯೂಟರ್ ನಿರ್ಮಿತ ಸರಕುಪಟ್ಟಿ",
    selectLanguageTitle: "ಪಿಡಿಎಫ್ ಭಾಷೆ",
    selectLanguageHint: "ಸರಕುಪಟ್ಟಿ ಪಿಡಿಎಫ್‌ಗೆ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ. ಸಂಖ್ಯೆಗಳು ಮತ್ತು ಕೋಡ್‌ಗಳು ಬದಲಾಗುವುದಿಲ್ಲ.",
    downloadInLanguage: "ಡೌನ್‌ಲೋಡ್",
    cancel: "ರದ್ದು",
  },
  gu: {
    invoiceTitle: "ઇન્વૉઇસ",
    buyerShipTo: "ખરીદદાર (શિપ ટુ)",
    gstinUin: "જીએસટીઆઈએન/યુઆઈએન:",
    contact: "સંપર્ક:",
    stateName: "રાજ્યનું નામ:",
    email: "ઇ-મેઇલ:",
    phone: "ફોન:",
    invoiceNo: "ઇન્વૉઇસ નંબર:",
    eWayBillNo: "ઇ-વે બિલ નં.",
    dated: "તારીખ:",
    deliveryNote: "ડિલિવરી નોટ",
    referenceNoDate: "સંદર્ભ નં. અને તારીખ",
    otherReference: "અન્ય સંદર્ભ",
    buyersOrderNo: "ખરીદદાર ઓર્ડર નં.",
    dispatchDocNo: "ડિસ્પેચ દસ્તાવેજ નં.",
    deliveryNoteDate: "ડિલિવરી નોટ તારીખ:",
    dispatchedThrough: "દ્વારા મોકલેલ",
    destination: "ગંતવ્ય",
    billOfLanding: "બિલ ઓફ લેન્ડિંગ/એલઆર-આરઆર નં.",
    dtPrefix: "તારીખ,",
    motorVehicleNo: "મોટર વાહન નં.",
    slNoHtml: "ક્રમ<br />નં.",
    descriptionOfGoods: "માલનું વર્ણન",
    hsnSac: "HSN/SAC",
    gstRate: "જીએસટી દર",
    qty: "જથ્થો",
    rate: "દર",
    amount: "રકમ",
    per: "પ્રતિ",
    outputCgstAt: "આઉટપુટ સીજીએસટી @",
    outputSgstAt: "આઉટપુટ એસજીએસટી @",
    total: "કુલ",
    amountChargeableWords: "વસૂલાતપાત્ર રકમ (શબ્દોમાં):",
    only: "જ",
    eAndOE: "ઇ. એન્ડ ઓ.ઇ",
    taxableValueHtml: "કરપાત્ર <br />મૂલ્ય",
    cgst: "સીજીએસટી",
    sgstUtgst: "એસજીએસટી/યુટીજીએસટી",
    rateHdr: "દર",
    amountHdr: "રકમ",
    taxAmountWords: "કર રકમ (શબ્દોમાં) :",
    remarks: "ટિપ્પણી:",
    beingMaterial: "વાહન નંબર દ્વારા માલ મોકલાયો :",
    declaration: "ઘોષણા:",
    declarationBody:
      "અમે ઘોષણા કરીએ છીએ કે આ ઇન્વૉઇસ વર્ણવેલા માલનો વાસ્તવિક ભાવ બતાવે છે અને બધી વિગતો સાચી અને યોગ્ય છે. ચુકવણીની શરતો: ઇન્વૉઇસ તારીખથી 30 દિવસ નેટ. મોડી ચુકવણી પર વાર્ષિક 18% વ્યાજ લેવામાં આવશે.",
    companyBank: "કંપનીના બેંક વિગતો:",
    acHolder: "ખાતાધારકનું નામ:",
    bankName: "બેંકનું નામ:",
    acNo: "ખાતા નંબર:",
    branchIfsc: "શાખા અને આઇએફએસસી કોડ:",
    forPrefix: "માટે",
    authorisedSignature: "અધિકૃત હસ્તાક્ષર",
    subjectJurisdiction: "બેંગલોર અધિકારક્ષેત્રને આધીન",
    computerGenerated: "આ કમ્પ્યુટર જનરેટેડ ઇન્વૉઇસ છે",
    selectLanguageTitle: "પીડીએફ ભાષા",
    selectLanguageHint: "ઇન્વૉઇસ પીડીએફ માટે ભાષા પસંદ કરો. નંબરો અને કોડ એ જ રહેશે.",
    downloadInLanguage: "ડાઉનલોડ",
    cancel: "રદ કરો",
  },
};

// Invoice Details Component
function InvoiceDetails({ invoice, onClose }) {
  const [detailsData, setDetailsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfLangPickerOpen, setPdfLangPickerOpen] = useState(false);
  const [pickPdfLang, setPickPdfLang] = useState("en");
  const { toast } = useToast();

  React.useEffect(() => {
    if (!invoice) return;

    if (invoice.outward_sales_order_id) {
      const fetchDetails = async () => {
        setIsLoading(true);
        setError(null);

        try {
          const url = `${import.meta.env.VITE_BASE_URL}/api/sales/invoices/${invoice.outward_sales_order_id}/`;
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${AuthService.getAccessToken()}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error('Failed to fetch invoice details');
          }

          const data = await response.json();

          if (data.status && data.status !== 200) {
            throw new Error(data.message || 'Failed to fetch invoice details');
          }

          if (data.data) {
            const detailsData = {
              ...data.data,
              items: data.data.items || [],
              total_amount: data.data.total_amount || null,
              party_info: data.data.party_info || null,
              organization_info: data.data.organization_info || null,
              order_id: data.data.order_id || data.data.so_number || null,
              so_number: data.data.so_number || data.data.order_id || null,
              order_date: data.data.order_date || null,
              customer_name: data.data.customer_name || null
            };
            setDetailsData(detailsData);
          } else {
            setDetailsData(invoice);
          }
        } catch (err) {
          setError(err.message);
          toast({
            title: "Error",
            description: err.message || "Failed to load invoice details",
            variant: "destructive",
          });
          setDetailsData(invoice);
        } finally {
          setIsLoading(false);
        }
      };

      fetchDetails();
    } else {
      setDetailsData(invoice);
      setIsLoading(false);
    }
  }, [invoice, toast]);

  // PDF Generation function using HTML format
  const generatePDF = async (lang = "en") => {
    setIsGeneratingPDF(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      if (!detailsData) {
        throw new Error('No data available to generate PDF');
      }

      const L = INVOICE_PDF_LABELS[lang] || INVOICE_PDF_LABELS.en;
      const { translateKeepNumbers, translateDeep } = createInvoicePdfTranslators(lang);

      let dataForPdf = detailsData;
      if (lang !== "en") {
        dataForPdf = await translateDeep(JSON.parse(JSON.stringify(detailsData)));
      }

      let orgInfo = getOrgInfoSync();
      if (!orgInfo?.organization || !orgInfo?.branch) {
        orgInfo = await fetchOrgInfo();
      }

      let orgName = orgInfo?.organization || '';
      let branchName = orgInfo?.branch || '';
      if (lang !== "en") {
        if (orgName) orgName = await translateKeepNumbers(orgName);
        if (branchName) branchName = await translateKeepNumbers(branchName);
      }

      const orgAddress = dataForPdf.organization_info?.address || '';
      const orgCity = dataForPdf.organization_info?.city || '';
      const orgState = dataForPdf.organization_info?.state || '';
      const orgPincode = dataForPdf.organization_info?.pincode || '';
      const orgGST = dataForPdf.organization_info?.gst_number || '';
      const orgContact = dataForPdf.organization_info?.contact_number || '';
      const orgEmail = dataForPdf.organization_info?.email || '';

      const partyName = dataForPdf.party_info?.name || dataForPdf.customer_name || '';
      const partyAddress = dataForPdf.party_info?.address || '';
      const partyCity = dataForPdf.party_info?.city || '';
      const partyState = dataForPdf.party_info?.state || '';
      const partyPincode = dataForPdf.party_info?.pincode || '';
      const partyGST = dataForPdf.party_info?.gst_number || '';
      const partyContact = dataForPdf.party_info?.contact_number || '';

      const invoiceNo = dataForPdf.invoice_details?.bill_number || dataForPdf.bill_no || dataForPdf.order_id || '';
      const eWayBill = dataForPdf.invoice_details?.e_waybill_number || '';
      const invoiceDate = dataForPdf.order_date || '';
      const referenceNo = dataForPdf.so_number || dataForPdf.order_id || '';
      const buyerOrderNo = dataForPdf.so_number || '';
      const dispatchDocNo = dataForPdf.bill_no || '';
      const vehicleNo = dataForPdf.vehicle_no || '';
      const destination = partyCity || '';

      // Calculate totals and tax breakdown
      const items = dataForPdf.items || [];
      let totalAmount = 0;
      const taxGroups = {};

      items.forEach(item => {
        const amount = parseFloat(item.total_amount || 0);
        totalAmount += amount;
        const gstRate = parseFloat(item.gst_rate || 0);
        const taxableValue = amount / (1 + gstRate / 100);
        
        if (!taxGroups[gstRate]) {
          taxGroups[gstRate] = { taxableValue: 0, cgst: 0, sgst: 0, totalTax: 0 };
        }
        taxGroups[gstRate].taxableValue += taxableValue;
        taxGroups[gstRate].cgst += (taxableValue * gstRate / 100) / 2;
        taxGroups[gstRate].sgst += (taxableValue * gstRate / 100) / 2;
        taxGroups[gstRate].totalTax += taxableValue * gstRate / 100;
      });

      // Calculate totals
      let totalTaxableValue = 0;
      let totalCGST = 0;
      let totalSGST = 0;
      let totalTax = 0;

      Object.keys(taxGroups).forEach(rate => {
        totalTaxableValue += taxGroups[rate].taxableValue;
        totalCGST += taxGroups[rate].cgst;
        totalSGST += taxGroups[rate].sgst;
        totalTax += taxGroups[rate].totalTax;
      });

      const grandTotal = totalAmount + totalTax;
      const roundOff = Math.round(grandTotal) - grandTotal;

      // Format currency
      const formatCurrency = (value) => {
        return parseFloat(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      // Number to words function (simplified)
      const numberToWords = (num) => {
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        
        if (num === 0) return 'Zero';
        if (num < 20) return ones[num];
        if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
        if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + numberToWords(num % 100) : '');
        if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
        if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '');
        return numberToWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + numberToWords(num % 10000000) : '');
      };

      const googleFontHref =
        lang === "hi"
          ? "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&display=swap"
          : lang === "kn"
            ? "https://fonts.googleapis.com/css2?family=Noto+Sans+Kannada:wght@400;700&display=swap"
            : lang === "gu"
              ? "https://fonts.googleapis.com/css2?family=Noto+Sans+Gujarati:wght@400;700&display=swap"
              : "";

      const fontLinks = googleFontHref
        ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="${googleFontHref}" rel="stylesheet">`
        : "";

      const bodyFontFamily =
        lang === "hi"
          ? "'Noto Sans Devanagari', Arial, sans-serif"
          : lang === "kn"
            ? "'Noto Sans Kannada', Arial, sans-serif"
            : lang === "gu"
              ? "'Noto Sans Gujarati', Arial, sans-serif"
              : "Arial, sans-serif";

      const amtWordsNum = Math.round(grandTotal + roundOff);
      const amountWordsLine =
        lang === "en"
          ? `INR ${numberToWords(amtWordsNum)} Only`
          : await translateKeepNumbers(`INR ${numberToWords(amtWordsNum)} Only`);

      const taxWordsNum = Math.round(totalTax);
      const taxWordsLine =
        lang === "en"
          ? `INR ${numberToWords(taxWordsNum)} Only`
          : await translateKeepNumbers(`INR ${numberToWords(taxWordsNum)} Only`);

      // Create HTML content
      const invoiceHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          ${fontLinks}
          <style>
            body {
              font-family: ${bodyFontFamily};
              font-size: 10px;
              margin: 0;
              padding: 5px 10px;
            }
            table {
              table-layout: fixed;
              width: 100%;
              border-collapse: collapse;
              border: 1px solid black;
              margin: 0;
            }
            td, th {
              border: 1px solid black;
              padding: 4px;
              vertical-align: top;
              word-wrap: break-word;
            }
            .header-table td {
              padding: 10px;
              font-size: 11px;
              line-height: 1.4;
            }
            .header-table strong {
              font-size: 12px;
              font-weight: bold;
            }
            .column-wrapper {
              margin-bottom: 10px;
            }
            .center {
              text-align: center !important;
            }
            .alignright {
              text-align: right;
            }
            .column {
              float: left;
              width: 50%;
              margin-bottom: 0;
            }
            .column-wrapper {
              margin-bottom: 0;
              overflow: hidden;
            }
            .table-left td,
            .table-left th {
              border-right-width: 0 !important;
            }
            .table-right td,
            .table-right th {
              border-left-width: 0 !important;
            }
            .invoice-header {
              font-size: 24px;
              font-weight: bold;
              text-align: center;
              margin: 5px 0;
              letter-spacing: 2px;
            }
            .items-section {
              clear: both;
              margin-top: 0;
            }
          </style>
        </head>
        <body>
          <div class="invoice-header">${L.invoiceTitle}</div>

          <div class="column-wrapper">
            <div class="column">
              <table class="table table-bordered header-table" style="margin-bottom: 0;">
                <tbody>
                  <tr>
                    <td>
                      <strong>${orgName}</strong><br />
                      ${branchName ? `${branchName}<br />` : ''}
                      ${orgAddress}<br />
                      ${orgCity} - ${orgPincode}<br />
                      ${orgGST ? `${L.gstinUin} ${orgGST}<br />` : ''}
                      ${orgContact ? `${L.contact} ${orgContact}<br />` : ''}
                      ${orgState ? `${L.stateName} ${orgState}<br />` : ''}
                      ${orgEmail ? `${L.email} ${orgEmail}` : ''}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      ${L.buyerShipTo}<br />
                      <strong>${partyName}</strong><br />
                      ${partyAddress || '-'}<br />
                      ${partyCity ? `${partyCity} - ${partyPincode}` : (partyPincode ? partyPincode : '-')}<br />
                      ${partyGST ? `${L.gstinUin} ${partyGST}<br />` : ''}
                      ${partyContact ? `${L.phone} ${partyContact}<br />` : ''}
                      ${partyState ? `${L.stateName} ${partyState}` : ''}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="column">
              <table class="table table-bordered header-table" style="margin-bottom: 0;">
                <tbody>
                  <tr>
                    <td style="width:33%">
                      ${L.invoiceNo}<br />
                      <strong>${invoiceNo}</strong>
                    </td>
                    <td style="width:33%">
                      ${L.eWayBillNo}<br />
                      <strong>${eWayBill}</strong>
                    </td>
                    <td style="width:33%">${L.dated}<br /><strong>${invoiceDate}</strong></td>
                  </tr>
                  <tr>
                    <td colSpan="2">${L.deliveryNote}</td>
                    <td colSpan="1"></td>
                  </tr>
                  <tr>
                    <td colSpan="2">${L.referenceNoDate}<br /><strong>${referenceNo}</strong></td>
                    <td colSpan="1">${L.otherReference} <br /><strong></strong></td>
                  </tr>
                  <tr>
                    <td colSpan="2">${L.buyersOrderNo}<br /><strong>${buyerOrderNo}</strong></td>
                    <td colSpan="1">${L.dated}<br /><strong>${invoiceDate}</strong></td>
                  </tr>
                  <tr>
                    <td>${L.dispatchDocNo}<br /><strong>${dispatchDocNo}</strong></td>
                    <td colSpan="2">${L.deliveryNoteDate} <strong>${invoiceDate}</strong></td>
                  </tr>
                  <tr>
                    <td>${L.dispatchedThrough}<br /><strong>${vehicleNo}</strong></td>
                    <td colSpan="2">${L.destination}<br /><strong>${destination}</strong></td>
                  </tr>
                  <tr>
                    <td>${L.billOfLanding}<br /><strong>${L.dtPrefix} ${invoiceDate}</strong></td>
                    <td colSpan="2">${L.motorVehicleNo}<br /><strong>${vehicleNo}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="items-section">
            <table class="table table-bordered" style="font-size:14px">
              <thead>
                <tr>
                  <th style="width: 3%;">${L.slNoHtml}</th>
                  <th style="width: 28%;">${L.descriptionOfGoods}</th>
                  <th style="width: 8%;">${L.hsnSac}</th>
                  <th style="width: 8%;">${L.gstRate}</th>
                  <th style="width: 13%;">${L.qty}</th>
                  <th style="width: 18%;">${L.rate}</th>
                  <th style="width: 22%">${L.amount}</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((item, index) => {
                  const qty = parseFloat(item.loaded_quantity || 0);
                  const altQty = parseFloat(item.alternate_loaded_quantity || 0);
                  const rate = parseFloat(item.rate || 0);
                  const amount = parseFloat(item.total_amount || 0);
                  const uom = item.base_unit?.name || '';
                  const alternateUom = item.alternate_unit?.name || '';
                  const alternateRate = item.alternate_rate ? parseFloat(item.alternate_rate) : null;
                  
                  // Format QTY column: base qty on top, alt qty below (same font size)
                  const qtyDisplay = alternateUom && altQty > 0
                    ? `${formatCurrency(qty)} ${uom}<br/>${formatCurrency(altQty)} ${alternateUom}`
                    : `${formatCurrency(qty)} ${uom}`;
                  
                  // Format Rate column: base rate with unit on top, alt rate with unit below (same font size)
                  const rateDisplay = alternateRate && alternateUom
                    ? `${formatCurrency(rate)} ${L.per} ${uom}<br/>${formatCurrency(alternateRate)} ${L.per} ${alternateUom}`
                    : `${formatCurrency(rate)} ${L.per} ${uom}`;
                  
                  const gstRate = item.gst_rate !== null && item.gst_rate !== undefined ? parseFloat(item.gst_rate) : 0;
                  
                  return `
                    <tr>
                      <td>${index + 1}</td>
                      <td>${item.item_name || ''}</td>
                      <td>${item.hsn_code || ''}</td>
                      <td class="center">${gstRate}%</td>
                      <td>${qtyDisplay}</td>
                      <td>${rateDisplay}</td>
                      <td class="alignright">${formatCurrency(amount)}</td>
                    </tr>
                  `;
                }).join('')}
                <tr>
                  <td colSpan="6"></td>
                  <td colSpan="1" class="alignright"><strong>${formatCurrency(totalAmount)}</strong></td>
                </tr>
                ${Object.keys(taxGroups).map(rate => {
                  const group = taxGroups[rate];
                  const rateNum = parseFloat(rate);
                  if (rateNum === 0) return '';
                  return `
                    <tr>
                      <td></td>
                      <td style="text-align:right"><strong>${L.outputCgstAt}${rateNum / 2}%<br />${L.outputSgstAt}${rateNum / 2}%</strong></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td class="center">${rateNum}% <br /> ${rateNum}%</td>
                      <td class="alignright"><strong>${formatCurrency(group.cgst)}<br /> ${formatCurrency(group.sgst)}</strong></td>
                    </tr>
                  `;
                }).join('')}
                <tr>
                  <td colSpan="2">${L.total}</td>
                  <td></td>
                  <td></td>
                  <td>
                    <strong>${formatCurrency(items.reduce((sum, item) => sum + parseFloat(item.loaded_quantity || 0), 0))}</strong>
                    ${(() => {
                      const totalAltQty = items.reduce((sum, item) => sum + parseFloat(item.alternate_loaded_quantity || 0), 0);
                      const firstItem = items[0];
                      const altUnit = firstItem?.alternate_unit?.name;
                      const baseUnit = firstItem?.base_unit?.name;
                      return altUnit && totalAltQty > 0 ? `<br/><strong>${formatCurrency(totalAltQty)} ${altUnit}</strong>` : '';
                    })()}
                  </td>
                  <td></td>
                  <td class="alignright">
                    <strong> ₹ ${formatCurrency(grandTotal + roundOff)}</strong>
                  </td>
                </tr>
                <tr>
                  <td colSpan="7">
                    <div style="display: flex; justify-content: space-between;">
                      <div>
                        ${L.amountChargeableWords}<br />
                        <strong>${amountWordsLine}</strong>
                        <span style="float:right"> ${L.eAndOE}</span>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td colSpan="3" rowSpan="2" style="text-align:right">
                    ${L.taxableValueHtml}
                  </td>
                  <td colSpan="1" class="center">
                    ${L.cgst}
                  </td>
                  <td colSpan="2" class="center">
                    ${L.sgstUtgst}
                  </td>
                </tr>
                <tr>
                  <td class="center">${L.rateHdr}</td>
                  <td class="center">${L.amountHdr}</td>
                  <td class="center">${L.rateHdr}</td>
                  <td class="center">${L.amountHdr}</td>
                </tr>
                ${Object.keys(taxGroups).map(rate => {
                  const group = taxGroups[rate];
                  const rateNum = parseFloat(rate);
                  return `
                    <tr>
                      <td colSpan="4" style="text-align:right"><strong>${formatCurrency(group.taxableValue)}</strong></td>
                      <td class="center">${rateNum/2}% </td>
                      <td class="center">${formatCurrency(group.cgst)}</td>
                      <td class="center">${rateNum/2}% </td>
                      <td class="alignright"><strong>${formatCurrency(group.sgst)}</strong></td>
                    </tr>
                  `;
                }).join('')}
                <tr>
                  <td colSpan="4" class="alignright"><strong>${L.total}:&nbsp;&nbsp;${formatCurrency(totalTaxableValue)}</strong> </td>
                  <td></td>
                  <td class="center"><strong>${formatCurrency(totalCGST)}</strong></td>
                  <td></td>
                  <td class="alignright"><strong>${formatCurrency(totalSGST)}</strong></td>
                </tr>
              </tbody>
            </table>

            <div class="column" style="flex: 1;">
              <table class="table table-bordered table-left" style="width: 100%;">
                <tbody>
                  <tr>
                    <td style="padding: 6px;">
                      ${L.taxAmountWords} <strong>${taxWordsLine} </strong><br />
                      <span>
                        ${L.remarks}
                        <br />
                        ${L.beingMaterial} ${vehicleNo}
                      </span>
                      <br />
                      <span style="font-size:11px">
                        ${L.declaration}
                        <br />
                        ${L.declarationBody}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="column" style="flex: 1;">
              <table class="table table-bordered table-right" style="width: 100%;">
                <tbody>
                  <tr>
                    <td style="padding: 6px;">
                      ${L.companyBank}<br />
                      ${L.acHolder} ${orgName}<br />
                      ${L.bankName} <strong>HDFC BANK</strong><br />
                      ${L.acNo} 50100123456789<br />
                      ${L.branchIfsc} <strong>Koramangala & HDFC0001234</strong>
                    </td>
                  </tr>
                  <tr>
                    <td style="text-align:right; padding: 6px;">
                      ${L.forPrefix} ${orgName}<br />
                      ${L.authorisedSignature}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <table style="margin-top: 5px;">
              <tbody>
                <tr>
                  <td style="padding: 4px; border: none;">
                    <p class="center" style="font-size:11px; margin: 0;">${L.subjectJurisdiction}<br />${L.computerGenerated} </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </body>
        </html>
      `;

      // Create a temporary container
      const pdfContainer = document.createElement('div');
      pdfContainer.style.position = 'absolute';
      pdfContainer.style.left = '-9999px';
      pdfContainer.style.width = '210mm';
      pdfContainer.innerHTML = invoiceHTML;
      document.body.appendChild(pdfContainer);

      if (lang !== "en" && googleFontHref) {
        try {
          await document.fonts.ready;
        } catch {
          /* ignore */
        }
      }

      // Wait for layout/fonts (longer when non-Latin scripts)
      await new Promise((resolve) => setTimeout(resolve, lang !== "en" ? 900 : 500));

      // Convert to canvas
      const canvas = await html2canvas(pdfContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: pdfContainer.scrollWidth,
        windowHeight: pdfContainer.scrollHeight,
      });

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min((pdfWidth - 10) / imgWidth, (pdfHeight - 10) / imgHeight);
      const imgScaledWidth = imgWidth * ratio;
      const imgScaledHeight = imgHeight * ratio;
      const xOffset = 5; // Reduced left margin
      let yOffset = 5; // Reduced top margin

      // Handle multi-page
      const pageHeight = pdfHeight - 10;
      let remainingHeight = imgScaledHeight;

      while (remainingHeight > 0) {
        pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgScaledWidth, imgScaledHeight);
        remainingHeight -= pageHeight;
        yOffset -= pageHeight;
        if (remainingHeight > 0) {
          pdf.addPage();
        }
      }

      // Clean up
      document.body.removeChild(pdfContainer);

      // Download the PDF
      pdf.save(`invoice-${invoiceNo}-${new Date().toISOString().split('T')[0]}.pdf`);

      toast({
        title: "PDF Downloaded",
        description: "Invoice details have been downloaded as PDF",
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

  if (!invoice) return null;

  const displayData = detailsData || invoice;

  return (
    <>
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Invoice Details - {invoice.order_id || displayData?.order_id}
            </div>
            {displayData && (
              <Popover open={pdfLangPickerOpen} onOpenChange={setPdfLangPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    disabled={isGeneratingPDF}
                    className="flex items-center gap-2 mr-10"
                  >
                    {isGeneratingPDF ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Download PDF
                      </>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 z-[300]">
                  <p className="text-sm font-medium">
                    {INVOICE_PDF_LABELS[pickPdfLang]?.selectLanguageTitle || "PDF language"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    {INVOICE_PDF_LABELS[pickPdfLang]?.selectLanguageHint}
                  </p>
                  <Label className="text-sm mb-2 block">Language</Label>
                  <Select value={pickPdfLang} onValueChange={setPickPdfLang}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[320]">
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="hi">Hindi (हिंदी)</SelectItem>
                      <SelectItem value="kn">Kannada (ಕನ್ನಡ)</SelectItem>
                      <SelectItem value="gu">Gujarati (ગુજરાતી)</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPdfLangPickerOpen(false)}
                    >
                      {INVOICE_PDF_LABELS[pickPdfLang]?.cancel || "Cancel"}
                    </Button>
                    <Button
                      type="button"
                      disabled={isGeneratingPDF}
                      onClick={async () => {
                        const lang = pickPdfLang;
                        setPdfLangPickerOpen(false);
                        await generatePDF(lang);
                      }}
                      className="gap-2"
                    >
                      {isGeneratingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {INVOICE_PDF_LABELS[pickPdfLang]?.downloadInLanguage || "Download"}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            <span className="ml-2 text-gray-600">Loading details...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600">{error}</p>
          </div>
        ) : displayData ? (
          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Order ID</Label>
                  <p className="text-lg font-semibold">{displayData.order_id || displayData.so_number}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Order Date</Label>
                  <p className="text-lg">{displayData.order_date}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Outward Number</Label>
                  <p className="text-lg">{displayData.bill_no}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Customer Name</Label>
                  <p className="text-lg">{displayData.customer_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Vehicle Number</Label>
                  <p className="text-lg">{displayData.vehicle_no}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Outward Date</Label>
                  <p className="text-lg">{displayData.outward_date}</p>
                </div>
              </CardContent>
            </Card>

            {/* Organization Information */}
            {displayData.organization_info && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Organization Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Name</Label>
                    <p className="text-lg font-semibold">{displayData.organization_info.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">GST Number</Label>
                    <p className="text-lg">
                      {displayData?.organization_info?.gst_number ? displayData.organization_info.gst_number : "-"}
                    </p>

                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium text-gray-600">Address</Label>
                    <p className="text-lg">{displayData.organization_info.address}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">City, State</Label>
                    <p className="text-lg">{displayData.organization_info.city} - {displayData.organization_info.state}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Pincode</Label>
                    <p className="text-lg">{displayData.organization_info.pincode}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Party Information */}
            {displayData.party_info && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Party Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Name</Label>
                    <p className="text-lg font-semibold">{displayData.party_info.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">GST Number</Label>
                    <p className="text-lg">
                      {displayData?.party_info?.gst_number || "-"}
                    </p>

                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium text-gray-600">Address</Label>
                    <p className="text-lg">{displayData.party_info.address}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">City, State</Label>
                    <p className="text-lg">{displayData.party_info.city} - {displayData.party_info.state}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Pincode</Label>
                    <p className="text-lg">{displayData.party_info.pincode}</p>
                  </div>
                  {displayData.party_info.contact_number && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Contact Number</Label>
                      <p className="text-lg">{displayData.party_info.contact_number}</p>
                    </div>
                  )}
                  {displayData.party_info.email && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Email</Label>
                      <p className="text-lg">{displayData.party_info.email}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Invoice Details (Sales Order Level) */}
            {displayData.invoice_details && (displayData.invoice_details.e_invoice_number || displayData.invoice_details.e_waybill_number || displayData.invoice_details.bill_number) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Invoice Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {displayData.invoice_details.e_invoice_number && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                        <Label className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1 mb-1">
                          <FileText className="h-3 w-3" />
                          E-Invoice
                        </Label>
                        <p className="text-sm font-semibold mt-1 text-gray-900">
                          {displayData.invoice_details.e_invoice_number}
                        </p>
                      </div>
                    )}
                    {displayData.invoice_details.e_waybill_number && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                        <Label className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1 mb-1">
                          <Truck className="h-3 w-3" />
                          E-Waybill
                        </Label>
                        <p className="text-sm font-semibold mt-1 text-gray-900">
                          {displayData.invoice_details.e_waybill_number}
                        </p>
                      </div>
                    )}
                    {displayData.invoice_details.bill_number && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                        <Label className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1 mb-1">
                          <Receipt className="h-3 w-3" />
                          Bill Number
                        </Label>
                        <p className="text-sm font-semibold mt-1 text-gray-900">
                          {displayData.invoice_details.bill_number}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Items Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Items ({displayData.items?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {displayData.items  && displayData.items.length > 0 ? (
                  <div className="space-y-4">
                    {displayData.items.map((item, index) => (
                      <Card key={item.id || index} className="border-l-4 border-l-blue-500">
                        <CardContent className="p-4">
                          {/* Item Name and Details */}
                          <div className="mb-3">
                            <h3 className="text-base font-semibold text-gray-900 mb-1.5">
                              {index + 1}. {item.item_name}
                            </h3>
                            <div className="flex items-center gap-2 flex-wrap">
                              {item.hsn_code && (
                                <Badge variant="outline" className="text-xs py-0.5 px-2">
                                  <Hash className="h-3 w-3 mr-1" />
                                  HSN: {item.hsn_code}
                                </Badge>
                              )}
                              {item.gst_rate !== null && item.gst_rate !== undefined && (
                                <Badge variant="outline" className="text-xs py-0.5 px-2">
                                  <Percent className="h-3 w-3 mr-1" />
                                  GST: {item.gst_rate}%
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Quantity and Rate Details - Compact Row */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t">
                            <div>
                              <Label className="text-xs font-medium text-gray-500 uppercase">Quantity</Label>
                              <p className="text-sm font-semibold mt-0.5">
                                {item.loaded_quantity || '0'} {item.base_unit?.name || ''} = {parseFloat(item.alternate_loaded_quantity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.alternate_unit.name}

                              </p>
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-500 uppercase">Rate</Label>
                              <p className="text-sm font-semibold mt-0.5">
                                ₹{item.rate ? parseFloat(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                                {item.base_unit?.name ? ` / ${item.base_unit.name}` : ''}
                              </p>
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-500 uppercase">Alt. Rate</Label>
                              <p className="text-sm font-semibold mt-0.5">
                                {item.alternate_rate && item.alternate_unit?.name ? (
                                  `₹${parseFloat(item.alternate_rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${item.alternate_unit.name}`
                                ) : '-'}
                              </p>
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-500 uppercase">Total</Label>
                              <p className="text-sm font-semibold mt-0.5 text-green-600">
                                ₹{item.total_amount ? parseFloat(item.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : null}
                {displayData.total_amount !== null && displayData.total_amount !== undefined && (
                  <div className="mt-6 pt-4 border-t-2 border-gray-200">
                    <div className="flex justify-end">
                      <div className="text-right bg-green-50 rounded-lg p-4 min-w-[200px]">
                        <Label className="text-sm font-medium text-gray-600 block mb-1">Grand Total</Label>
                        <p className="text-3xl font-bold text-green-600">
                          ₹{parseFloat(displayData.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>

    </>
  );
}

export default function Invoices() {
  const [location, setLocation] = useLocation();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const getInitialValues = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromDateParam = urlParams.get("from_date");
    const toDateParam = urlParams.get("to_date");
    const presetParam = urlParams.get("date_range");
    const hasUrlDates = !!(fromDateParam && toDateParam);
    const now = new Date();
    const todayStr = format(startOfDay(now), "yyyy-MM-dd");

    return {
      fromDate: fromDateParam || todayStr,
      toDate: toDateParam || todayStr,
      dateRangePreset:
        presetParam && ["today", "weekly", "monthly", "custom"].includes(presetParam)
          ? presetParam
          : hasUrlDates
            ? "custom"
            : "today",
      selectedBranchId: urlParams.get("branch_id") || "all",
      searchTerm: urlParams.get("search") || "",
    };
  };

  const initialValues = getInitialValues();
  const [filters, setFilters] = useState({
    fromDate: initialValues.fromDate,
    toDate: initialValues.toDate,
    searchTerm: initialValues.searchTerm,
  });
  const [dateRangePreset, setDateRangePreset] = useState(initialValues.dateRangePreset);
  const [selectedBranchId, setSelectedBranchId] = useState(initialValues.selectedBranchId);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });

  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Get user permissions
  const {
    hasReadPermission,
    hasModuleAccess,
    isLoading: permissionsLoading
  } = useUserPermissions();

  useEffect(() => {
    const now = new Date();

    if (dateRangePreset === "today") {
      const d = format(startOfDay(now), "yyyy-MM-dd");
      setFilters((prev) => ({ ...prev, fromDate: d, toDate: d }));
    } else if (dateRangePreset === "weekly") {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      setFilters((prev) => ({
        ...prev,
        fromDate: format(weekStart, "yyyy-MM-dd"),
        toDate: format(weekEnd, "yyyy-MM-dd"),
      }));
    } else if (dateRangePreset === "monthly") {
      const mStart = startOfMonth(now);
      const mEnd = endOfMonth(now);
      setFilters((prev) => ({
        ...prev,
        fromDate: format(mStart, "yyyy-MM-dd"),
        toDate: format(mEnd, "yyyy-MM-dd"),
      }));
    }
  }, [dateRangePreset]);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (filters.fromDate) params.append("start_date", filters.fromDate);
    if (filters.toDate) params.append("end_date", filters.toDate);
    return params.toString();
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleDateRangePresetChange = (value) => {
    setDateRangePreset(value);
  };

  // Fetch invoices
  const { data: invoicesData, isLoading, error, refetch } = useQuery({
    queryKey: ["invoices", filters.fromDate, filters.toDate],
    queryFn: async () => {
      const queryParams = buildQueryParams();
      const url = `${import.meta.env.VITE_BASE_URL}/api/sales/invoices/${queryParams ? `?${queryParams}` : ""}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${AuthService.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }

      const data = await response.json();

      if (data.status && data.status !== 200) {
        throw new Error(data.message || 'Failed to fetch invoices');
      }

      return data;
    },
    enabled: true,
  });

  const fetchBranches = async () => {
    const response = await fetch(`${import.meta.env.VITE_BASE_URL}/api/get-branches/`, {
      headers: {
        Authorization: `Bearer ${AuthService.getAccessToken()}`,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Failed to fetch branches");
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data)) return data;
    return [];
  };

  const { data: branchesData = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: fetchBranches,
    enabled: !!AuthService.getAccessToken(),
    staleTime: 5 * 60 * 1000,
  });

  const allInvoices = invoicesData?.data || [];
  const getInvoiceBranchName = (invoice) =>
    String(
      invoice?.branch_name ||
      invoice?.branch ||
      invoice?.inward_branch_name ||
      invoice?.po_branch_name ||
      invoice?.godown_branch_name ||
      ""
    ).trim();

  const selectedBranch = useMemo(
    () => (Array.isArray(branchesData) ? branchesData.find((b) => String(b.id) === String(selectedBranchId)) : null),
    [branchesData, selectedBranchId]
  );

  // Frontend: filter by Created At in range (backend may not apply start_date/end_date to created_at)
  const filteredInvoices = useMemo(() => {
    const fromStart =
      filters.fromDate && filters.toDate
        ? startOfDay(parse(filters.fromDate, "yyyy-MM-dd", new Date()))
        : null;
    const toEnd =
      filters.fromDate && filters.toDate
        ? endOfDay(parse(filters.toDate, "yyyy-MM-dd", new Date()))
        : null;

    return allInvoices.filter((invoice) => {
      if (fromStart && toEnd) {
        const created = parseInvoiceCreatedAt(invoice.created_at);
        if (!created) return false;
        if (created < fromStart || created > toEnd) return false;
      }

      if (selectedBranchId !== "all") {
        const branchName = getInvoiceBranchName(invoice).toLowerCase();
        const selectedBranchName = String(selectedBranch?.name || "").trim().toLowerCase();
        if (!branchName || !selectedBranchName || branchName !== selectedBranchName) return false;
      }

      if (filters.searchTerm) {
        const search = filters.searchTerm.toLowerCase();
        const orderId = invoice.order_id?.toLowerCase() || "";
        const soNumber = invoice.so_number?.toLowerCase() || "";
        const customerName = invoice.customer_name?.toLowerCase() || "";
        const billNo = invoice.bill_no?.toLowerCase() || "";
        const vehicleNo = invoice.vehicle_no?.toLowerCase() || "";
        const eInvoice = invoice.first_e_invoice_number?.toLowerCase() || "";

        if (
          !orderId.includes(search) &&
          !soNumber.includes(search) &&
          !customerName.includes(search) &&
          !billNo.includes(search) &&
          !vehicleNo.includes(search) &&
          !eInvoice.includes(search)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [allInvoices, filters.fromDate, filters.toDate, filters.searchTerm, selectedBranchId, selectedBranch]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (dateRangePreset) params.set("date_range", dateRangePreset);
    if (filters.fromDate) params.set("from_date", filters.fromDate);
    if (filters.toDate) params.set("to_date", filters.toDate);
    if (selectedBranchId !== "all") params.set("branch_id", selectedBranchId);
    if (filters.searchTerm.trim()) params.set("search", filters.searchTerm.trim());
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [dateRangePreset, filters.fromDate, filters.toDate, filters.searchTerm, selectedBranchId]);

  const handleClearFilters = () => {
    const todayStr = format(startOfDay(new Date()), "yyyy-MM-dd");
    setDateRangePreset("today");
    setFilters((prev) => ({ ...prev, fromDate: todayStr, toDate: todayStr, searchTerm: "" }));
    setSelectedBranchId("all");
  };

  // Handle view details
  const handleViewDetails = (invoice) => {
    setSelectedInvoice(invoice);
    setIsDetailModalOpen(true);
  };

  // Handle close details
  const handleCloseDetails = () => {
    setSelectedInvoice(null);
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
            <p className="text-red-600 mb-4">Error loading invoices: {error.message}</p>
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
                <Receipt className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
              <p className="text-red-600 mb-4">
                You don't have permission to view invoices. Contact your administrator for access.
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
        <div className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0">
          <div className="flex items-center space-x-4">
            {isMobile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}

            <div>
              <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
              <p className="text-gray-600">View invoices with HSN codes and GST rates</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 sm:p-6 min-h-0">
          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="invoiceDateRangePreset" className="block mb-2">Date Range</Label>
                  <Select
                    value={dateRangePreset}
                    onValueChange={handleDateRangePresetChange}
                  >
                    <SelectTrigger id="invoiceDateRangePreset">
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

                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="invoiceFromDate" className="block mb-2">From Date</Label>
                  <Popover
                    open={dateRangePreset === "custom" ? isDatePickerOpen.from : false}
                    onOpenChange={(open) => {
                      if (dateRangePreset !== "custom") return;
                      setIsDatePickerOpen((prev) => ({ ...prev, from: open }));
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={dateRangePreset !== "custom"}
                        className={`w-full h-10 px-3 inline-flex items-center justify-start rounded-md border text-sm ${
                          dateRangePreset === "custom"
                            ? "bg-white text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            : "bg-gray-100 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                        <span className="truncate">
                          {filters.fromDate ? format(parse(filters.fromDate, "yyyy-MM-dd", new Date()), "dd-MM-yyyy") : "Start date"}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        key={`invoice-from-${filters.fromDate || "null"}`}
                        mode="single"
                        selected={filters.fromDate ? parse(filters.fromDate, "yyyy-MM-dd", new Date()) : undefined}
                        onSelect={(date) => {
                          const dateStr = date ? format(date, "yyyy-MM-dd") : "";
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
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="invoiceToDate" className="block mb-2">To Date</Label>
                  <Popover
                    open={dateRangePreset === "custom" ? isDatePickerOpen.to : false}
                    onOpenChange={(open) => {
                      if (dateRangePreset !== "custom") return;
                      setIsDatePickerOpen((prev) => ({ ...prev, to: open }));
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={dateRangePreset !== "custom"}
                        className={`w-full h-10 px-3 inline-flex items-center justify-start rounded-md border text-sm ${
                          dateRangePreset === "custom"
                            ? "bg-white text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            : "bg-gray-100 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                        <span className="truncate">
                          {filters.toDate ? format(parse(filters.toDate, "yyyy-MM-dd", new Date()), "dd-MM-yyyy") : "End date"}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        key={`invoice-to-${filters.toDate || "null"}`}
                        mode="single"
                        selected={filters.toDate ? parse(filters.toDate, "yyyy-MM-dd", new Date()) : undefined}
                        onSelect={(date) => {
                          handleFilterChange("toDate", date ? format(date, "yyyy-MM-dd") : "");
                          setIsDatePickerOpen((prev) => ({ ...prev, to: false }));
                        }}
                        disabled={[
                          filters.fromDate ? { before: parse(filters.fromDate, "yyyy-MM-dd", new Date()) } : null,
                          { after: today },
                        ].filter(Boolean)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2 md:col-span-1">
                  <Label className="block mb-2">Branch</Label>
                  <Popover
                    open={branchDropdownOpen}
                    onOpenChange={(open) => {
                      setBranchDropdownOpen(open);
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={branchDropdownOpen} className="w-full justify-between h-10">
                        <span className="truncate flex-1 min-w-0 text-left">
                          {selectedBranchId === "all"
                            ? "All Branches"
                            : selectedBranch?.name || "Select branch"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[310]" align="start" side="bottom" sideOffset={4}>
                      <Command>
                        <CommandInput placeholder="Search branches..." />
                        <CommandList>
                          <CommandEmpty>
                            {branchesLoading ? (
                              <div className="flex items-center justify-center py-6">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Loading branches...
                              </div>
                            ) : (
                              "No branches found."
                            )}
                          </CommandEmpty>
                          <CommandGroup>
                            <ScrollArea className="h-64">
                              <CommandItem
                                key="all"
                                value="All"
                                onSelect={() => {
                                  setSelectedBranchId("all");
                                  setBranchDropdownOpen(false);
                                }}
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                              >
                                <div className="flex items-center gap-3">
                                  <Check className={`h-4 w-4 ${selectedBranchId === "all" ? "opacity-100 text-blue-600" : "opacity-0"}`} />
                                  <div className="font-medium text-gray-900">All Branches</div>
                                </div>
                              </CommandItem>
                              {branchesData?.map((branch) => (
                                <CommandItem
                                  key={branch.id}
                                  value={branch.name}
                                  onSelect={() => {
                                    setSelectedBranchId(String(branch.id));
                                    setBranchDropdownOpen(false);
                                  }}
                                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                >
                                  <div className="flex items-center gap-3">
                                    <Check className={`h-4 w-4 ${selectedBranchId === String(branch.id) ? "opacity-100 text-blue-600" : "opacity-0"}`} />
                                    <div>
                                      <div className="font-medium text-gray-900">{branch.name}</div>
                                      {branch.organization && (
                                        <div className="text-sm text-gray-500">{branch.organization}</div>
                                      )}
                                    </div>
                                  </div>
                                </CommandItem>
                              ))}
                            </ScrollArea>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="invoiceSearchTerm" className="block mb-2">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="invoiceSearchTerm"
                      placeholder="Search by order ID, customer name, bill number, vehicle number, or e-invoice number"
                      value={filters.searchTerm}
                      onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label className="block mb-2">&nbsp;</Label>
                  <Button type="button" variant="outline" onClick={handleClearFilters} className="w-full h-10">
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Invoices ({filteredInvoices.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredInvoices.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>E-Invoice</TableHead>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Customer</TableHead>

                        <TableHead>Vehicle No</TableHead>

                        <TableHead>Items</TableHead>
                        <TableHead>Created At</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map((invoice) => (
                        <TableRow key={invoice.outward_sales_order_id}>
                          <TableCell>{invoice.first_e_invoice_number || 'N/A'}</TableCell>
                          <TableCell className="font-medium">{invoice.order_id || invoice.so_number}</TableCell>
                          <TableCell>{invoice.customer_name || 'N/A'}</TableCell>

                          <TableCell>{invoice.vehicle_no || 'N/A'}</TableCell>

                          <TableCell>
                            <Badge variant="outline">{invoice.invoice_count} item(s)</Badge>
                          </TableCell>
                          <TableCell>{invoice.created_at || 'N/A'}</TableCell>
                          <TableCell>{invoice.created_by || 'N/A'}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(invoice)}
                              className="flex items-center gap-1"
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
                  <p className="text-gray-500">
                    {allInvoices.length === 0
                      ? "No invoices have been created yet."
                      : filters.searchTerm
                        ? "Try adjusting your search to see more results."
                        : "Try adjusting your date range to see more results."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Details Modal */}
      {isDetailModalOpen && (
        <InvoiceDetails
          invoice={selectedInvoice}
          onClose={handleCloseDetails}
        />
      )}
    </div>
  );
}

