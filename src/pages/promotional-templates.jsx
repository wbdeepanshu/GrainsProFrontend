import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Eye, Loader2, Megaphone, Plus, RefreshCw, Search, X } from "lucide-react";
import Sidebar from "../components/layout/sidebar";
import MobileSidebar from "../components/layout/mobile-sidebar";
import { useIsMobile } from "../hooks/use-mobile";
import { AuthService } from "../lib/auth";
import { createMessageTemplate, fetchMessageTemplates, sendPromotionalMultipleImages, sendPromotionalWhatsApp } from "../lib/promotional_api";

const emptyForm = () => ({
  name: "",
  category: "MARKETING",
  language: "en_US",
  header_text: "",
  body_text: "",
  footer_text: "",
  header_type: "none",
  image: null,
  header_examples: {},
  body_examples: {},
});

const extractIndexes = (value) =>
  [...new Set([...String(value || "").matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1])))]
    .sort((a, b) => a - b);

const MEDIA_HEADER_FORMATS = { IMAGE: "image", VIDEO: "video", DOCUMENT: "document" };

const getHeaderMedia = (template) => {
  const header = (template?.components || []).find(
    (component) => String(component?.type || "").toUpperCase() === "HEADER",
  );
  const mediaType = MEDIA_HEADER_FORMATS[String(header?.format || "TEXT").toUpperCase()];
  if (!mediaType) return null;
  const handle = header?.example?.header_handle;
  const raw = Array.isArray(handle) ? String(handle[0] || "") : String(handle || "");
  // Samb returns an opaque handle for some templates; only a real link is sendable.
  return { mediaType, url: /^https?:\/\//i.test(raw) ? raw : "" };
};

const getHeaderImageUrl = (template) => {
  const media = getHeaderMedia(template);
  return media && media.mediaType === "image" ? media.url : "";
};

function getComponentText(component) {
  if (!component || typeof component !== "object") return "";
  if (component.text) return String(component.text);
  return "";
}

function getExampleText(component) {
  if (!component || typeof component !== "object") return null;
  const example = component.example;
  if (!example || typeof example !== "object") return null;
  if (Array.isArray(example.header_text) && example.header_text.length > 0) {
    return String(example.header_text[0] || "");
  }
  if (Array.isArray(example.body_text)) {
    const first = example.body_text[0];
    if (Array.isArray(first) && first.length > 0) return String(first[0] || "");
    if (typeof first === "string") return first;
  }
  return null;
}

function getExampleValues(component) {
  const example = component?.example;
  if (!example || typeof example !== "object") return [];
  if (Array.isArray(example.header_text)) return example.header_text.map((value) => String(value ?? ""));
  if (Array.isArray(example.body_text)) {
    const first = example.body_text[0];
    if (Array.isArray(first)) return first.map((value) => String(value ?? ""));
    if (typeof first === "string") return [first];
  }
  return [];
}

// One parameter per {{n}} — Meta expects the variable's value, not the rendered sentence.
function buildTextParameters(component) {
  const indexes = extractIndexes(getComponentText(component));
  if (!indexes.length) return null;
  const values = getExampleValues(component);
  return indexes.map((_, position) => ({
    type: "text",
    text: String(values[position] || values[0] || "Customer"),
  }));
}

function replacePlaceholdersWithExamples(text, component) {
  const raw = String(text || "");
  const example = getExampleText(component);
  if (!example) return raw;
  return raw.replace(/\{\{(\d+)\}\}/g, example);
}

function buildSendComponents(template) {
  const components = [];
  const templateComponents = Array.isArray(template.components) ? template.components : [];

  const headerComponent = templateComponents.find(
    (component) => String(component?.type || "").toUpperCase() === "HEADER",
  );
  const bodyComponent = templateComponents.find(
    (component) => String(component?.type || "").toUpperCase() === "BODY",
  );

  const headerMedia = getHeaderMedia(template);
  if (headerMedia) {
    if (headerMedia.url) {
      const media = { link: headerMedia.url };
      if (headerMedia.mediaType === "document") {
        media.filename = headerMedia.url.split("/").pop().split("?")[0] || "document.pdf";
      }
      components.push({
        type: "header",
        parameters: [{ type: headerMedia.mediaType, [headerMedia.mediaType]: media }],
      });
    }
  } else if (headerComponent) {
    const headerParameters = buildTextParameters(headerComponent);
    if (headerParameters) {
      components.push({ type: "header", parameters: headerParameters });
    }
  }

  if (bodyComponent) {
    const bodyParameters = buildTextParameters(bodyComponent);
    if (bodyParameters) {
      components.push({ type: "body", parameters: bodyParameters });
    }
  }

  return components;
}

function ExampleFields({ label, indexes, values, onChange }) {
  if (!indexes.length) return null;
  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-medium text-slate-600">{label} examples</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {indexes.map((index) => (
          <input
            key={`${label}-${index}`}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
            value={values[index] || ""}
            placeholder={`Example for {{${index}}}`}
            onChange={(event) => onChange(index, event.target.value)}
          />
        ))}
      </div>
    </div>
  );
}

function CreateTemplateModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const headerIndexes = useMemo(() => extractIndexes(form.header_text), [form.header_text]);
  const bodyIndexes = useMemo(() => extractIndexes(form.body_text), [form.body_text]);
  const mutation = useMutation({
    mutationFn: createMessageTemplate,
    onSuccess: (result) => {
      onCreated?.(result);
      onClose();
    },
    onError: (requestError) => setError(requestError.message || "Failed to create template"),
  });

  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setError("");
    }
  }, [open]);

  if (!open) return null;

  const update = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const updateExample = (key, index, value) =>
    setForm((previous) => ({
      ...previous,
      [key]: { ...previous[key], [index]: value },
    }));

  const submit = (event) => {
    event.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Template name is required");
    if (!form.body_text.trim()) return setError("Body text is required");
    for (const index of [...headerIndexes, ...bodyIndexes]) {
      const values = headerIndexes.includes(index) && !bodyIndexes.includes(index)
        ? form.header_examples
        : form.body_examples;
      if (!String(values[index] || "").trim()) return setError(`Example for {{${index}}} is required`);
    }

    let payload = {
      name: form.name.trim(),
      category: form.category,
      language: form.language,
      body_text: form.body_text.trim(),
      allow_category_change: true,
    };
    if (form.header_text.trim()) {
      payload.header_text = form.header_text.trim();
      payload.header_examples = headerIndexes.map((index) => form.header_examples[index].trim());
    }
    if (bodyIndexes.length) {
      payload.body_examples = bodyIndexes.map((index) => form.body_examples[index].trim());
    }
    if (form.footer_text.trim()) payload.footer_text = form.footer_text.trim();
    if (form.image) {
      const multipart = new FormData();
      multipart.append("name", payload.name);
      multipart.append("category", payload.category);
      multipart.append("language", payload.language);
      multipart.append("body_text", payload.body_text);
      multipart.append("allow_category_change", "true");
      multipart.append("media_type", form.header_type);
      if (payload.header_text) multipart.append("header_text", payload.header_text);
      if (payload.footer_text) multipart.append("footer_text", payload.footer_text);
      if (payload.body_examples) multipart.append("body_example", payload.body_examples[0] || "Customer");
      if (payload.header_examples) multipart.append("header_example", payload.header_examples[0] || "Example");
      multipart.append("image", form.image);
      payload = multipart;
    }
    mutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
      <form onSubmit={submit} className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Create WhatsApp Template</h2>
            <p className="text-xs text-slate-500">Use {"{{1}}"}, {"{{2}}"} for message variables.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          <input className="h-10 w-full rounded-md border px-3 text-sm" placeholder="Template name" value={form.name} onChange={(event) => update("name", event.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <select className="h-10 rounded-md border px-3 text-sm" value={form.category} onChange={(event) => update("category", event.target.value)}>
              <option value="MARKETING">Marketing</option>
              <option value="UTILITY">Utility</option>
              <option value="AUTHENTICATION">Authentication</option>
            </select>
            <select className="h-10 rounded-md border px-3 text-sm" value={form.language} onChange={(event) => update("language", event.target.value)}>
              <option value="en_US">English (US)</option>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
            </select>
          </div>
          {form.header_type === "none" ? (
            <div>
              <input className="h-10 w-full rounded-md border px-3 text-sm" placeholder="Header text (optional), e.g. Welcome {{1}}" value={form.header_text} onChange={(event) => update("header_text", event.target.value)} />
              <ExampleFields label="Header" indexes={headerIndexes} values={form.header_examples} onChange={(index, value) => updateExample("header_examples", index, value)} />
            </div>
          ) : (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">A template can have only one header. Header text is unavailable while a media header is selected.</p>
          )}
          <div>
            <textarea className="min-h-32 w-full rounded-md border px-3 py-2 text-sm" placeholder="Body text, e.g. Dear {{1}}, your order is ready." value={form.body_text} onChange={(event) => update("body_text", event.target.value)} />
            <ExampleFields label="Body" indexes={bodyIndexes} values={form.body_examples} onChange={(index, value) => updateExample("body_examples", index, value)} />
          </div>
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <label className="block text-sm font-medium text-slate-700">Header type</label>
            <select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.header_type} onChange={(event) => { update("header_type", event.target.value); update("image", null); if (event.target.value !== "none") { update("header_text", ""); update("header_examples", {}); } }}>
              <option value="none">No media</option>
              <option value="image">Single image</option>
              <option value="video">Video</option>
              <option value="document">PDF / Document</option>
            </select>
            {form.header_type !== "none" ? <>
              <input type="file" accept={form.header_type === "image" ? "image/*" : form.header_type === "video" ? "video/*" : "application/pdf,.pdf"} className="block w-full rounded-md border bg-white px-3 py-2 text-sm" onChange={(event) => update("image", event.target.files?.[0] || null)} />
              {form.image ? <p className="text-xs text-slate-500">Selected: {form.image.name}</p> : null}
            </> : <p className="text-xs text-slate-500">Choose a media type to add an image, video, or PDF header.</p>}
          </div>
          <input className="h-10 w-full rounded-md border px-3 text-sm" placeholder="Footer text (optional)" value={form.footer_text} onChange={(event) => update("footer_text", event.target.value)} />
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {mutation.isPending ? "Submitting..." : "Submit for Approval"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TemplatePreviewModal({ open, template, onClose }) {
  if (!open || !template) return null;

  const [phone, setPhone] = useState("");
  const [sendStatus, setSendStatus] = useState(null);
  const [sendResult, setSendResult] = useState(null);
  const [multipleImages, setMultipleImages] = useState([]);

  const components = Array.isArray(template.components) ? template.components : [];
  const headerComponent = components.find(
    (component) => String(component?.type || "").toUpperCase() === "HEADER",
  );
  const bodyComponent = components.find(
    (component) => String(component?.type || "").toUpperCase() === "BODY",
  );
  const footerComponent = components.find(
    (component) => String(component?.type || "").toUpperCase() === "FOOTER",
  );

  const headerText = replacePlaceholdersWithExamples(getComponentText(headerComponent), headerComponent);
  const bodyText = replacePlaceholdersWithExamples(getComponentText(bodyComponent), bodyComponent);
  const footerText = replacePlaceholdersWithExamples(getComponentText(footerComponent), footerComponent);
  const imageUrl = getHeaderImageUrl(template);

  const displayHeaderText = headerComponent && String(headerComponent.format || "").toUpperCase() !== "IMAGE"
    ? headerText
    : "";

  const isApproved = String(template?.status || "").toUpperCase() === "APPROVED";

  const resetSendState = () => {
    setSendStatus(null);
    setSendResult(null);
  };

  const handleSend = async (event) => {
    event.preventDefault();
    resetSendState();
    const trimmedPhone = String(phone || "").trim();
    if (!trimmedPhone) {
      setSendStatus("error");
      setSendResult({ message: "Phone number is required" });
      return;
    }

    const headerMedia = getHeaderMedia(template);
    if (headerMedia && multipleImages.length > 0) {
      await sendAttachedImages(trimmedPhone);
      return;
    }

    if (headerMedia && !headerMedia.url) {
      setSendStatus("error");
      setSendResult({
        message: `This template needs a ${headerMedia.mediaType} header, but no usable link is available. Send it from the Send Messages page with a file instead.`,
      });
      return;
    }

    setSendStatus("sending");
    try {
      const sendComponents = buildSendComponents(template);
      const response = await sendPromotionalWhatsApp({
        template_name: template.name,
        language_code: template.language || "en_US",
        components: sendComponents,
        personalize_body_with_name: false,
        recipients: [
          {
            party_id: null,
            to: trimmedPhone,
            name: "",
            components: null,
          },
        ],
      });

      const recipientResult = Array.isArray(response?.data) ? response.data[0] : null;
      if (recipientResult && recipientResult.status === "sent") {
        setSendStatus("success");
        setSendResult({
          message: response.message || "Message sent successfully",
          message_id: recipientResult.message_id || null,
        });
      } else {
        setSendStatus("error");
        setSendResult({
          message: recipientResult?.message || response?.message || "Failed to send message",
        });
      }
    } catch (error) {
      setSendStatus("error");
      setSendResult({
        message: error?.message || "Failed to send message",
      });
    }
  };

  // WhatsApp allows one header image per message, so each attachment is its own message.
  const sendAttachedImages = async (trimmedPhone) => {
    setSendStatus("sending");
    try {
      const formData = new FormData();
      formData.append("template_name", template.name);
      formData.append("language_code", template.language || "en_US");
      formData.append("to", trimmedPhone);
      multipleImages.forEach((image) => formData.append("images", image));
      const response = await sendPromotionalMultipleImages(formData);
      setSendStatus("success");
      setSendResult({ message: response.message || "Images sent successfully" });
    } catch (error) {
      setSendStatus("error");
      setSendResult({ message: error?.message || "Failed to send images" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{template.name || "Template Preview"}</h3>
            <p className="text-xs text-slate-500">{template.category || "-"} · {template.language || "-"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="bg-[#e5ddd5] p-4">
          <div className="mx-auto w-full max-w-[280px] rounded-lg bg-white shadow-sm overflow-hidden">
            <div className="bg-[#075e54] px-3 py-2">
              <p className="text-xs font-medium text-white truncate">{template.name || "WhatsApp Template"}</p>
            </div>

            <div className="p-3 space-y-2">
              {imageUrl ? (
                <div className="rounded-md overflow-hidden border border-slate-200">
                  <img src={imageUrl} alt="Header" className="w-full h-40 object-cover" />
                </div>
              ) : null}

              {displayHeaderText ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase text-slate-500 mb-0.5">Header</p>
                  <p className="text-xs text-slate-800 whitespace-pre-wrap">{displayHeaderText}</p>
                </div>
              ) : null}

              <div className="rounded-lg rounded-tl-none bg-[#d9fdd3] px-3 py-2">
                <p className="text-xs text-slate-800 whitespace-pre-wrap">{bodyText || "No body text"}</p>
              </div>

              {footerText ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase text-slate-500 mb-0.5">Footer</p>
                  <p className="text-[11px] text-slate-600">{footerText}</p>
                </div>
              ) : null}
            </div>

            <div className="border-t bg-slate-50 px-3 py-2">
              <p className="text-[10px] text-slate-400 text-center">Template preview · {template.status || "UNKNOWN"}</p>
            </div>
          </div>
        </div>

        <div className="border-t bg-white p-4">
          {!isApproved ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This template is not approved yet. You can preview it, but sending is allowed only for APPROVED templates.
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Test WhatsApp Number</label>
                <input
                  type="tel"
                  inputMode="tel"
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  placeholder="e.g. 9876543210 or 917388975483"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={sendStatus === "sending"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {sendStatus === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {sendStatus === "sending"
                  ? "Sending..."
                  : multipleImages.length > 0
                    ? `Send ${multipleImages.length} image message${multipleImages.length > 1 ? "s" : ""}`
                    : "Send Test Message"}
              </button>
              {String(headerComponent?.format || "").toUpperCase() === "IMAGE" ? (
                <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
                  <label className="block text-xs font-medium text-slate-700">Attach your own image(s) — optional</label>
                  <input type="file" accept="image/*" multiple onChange={(event) => setMultipleImages(Array.from(event.target.files || []))} className="block w-full text-xs" />
                  <p className="text-[10px] text-slate-500">
                    {multipleImages.length > 0
                      ? `${multipleImages.length} selected. WhatsApp allows one image per message, so each is sent as a separate message.`
                      : "Leave empty to send the template's own image."}
                  </p>
                </div>
              ) : null}
              {sendStatus === "success" ? (
                <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                  {sendResult?.message}
                  {sendResult?.message_id ? <span className="ml-1 text-[10px] text-green-600">({sendResult.message_id})</span> : null}
                </div>
              ) : null}
              {sendStatus === "error" ? (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {sendResult?.message}
                </div>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PromotionalTemplates() {
  const isMobile = useIsMobile();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["promotional-message-templates"],
    queryFn: () => fetchMessageTemplates(),
    enabled: !!AuthService.getAccessToken(),
  });
  const templates = Array.isArray(data?.data) ? data.data : [];
  const filtered = templates.filter((template) =>
    `${template.name || ""} ${template.category || ""} ${template.status || ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="flex items-center justify-between border-b bg-white px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            {isMobile && <button type="button" onClick={() => setMobileSidebarOpen(true)} className="rounded border p-2" aria-label="Open menu">☰</button>}
            <Megaphone className="h-5 w-5 text-slate-700" />
            <div><h1 className="text-lg font-semibold text-slate-900">Promotional Templates</h1><p className="text-xs text-slate-500">Create and manage WhatsApp templates</p></div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => refetch()} disabled={isFetching} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm">{isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Refresh</button>
            <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm text-white"><Plus className="h-4 w-4" />Create Template</button>
          </div>
        </header>
        <section className="space-y-4 p-4 sm:p-6">
          <div className="relative max-w-lg"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="h-10 w-full rounded-md border bg-white pl-9 pr-3 text-sm" placeholder="Search templates" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          {error ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error.message}</div> : null}
          {isLoading ? <div className="py-12 text-center text-sm text-slate-500">Loading templates...</div> : filtered.length === 0 ? <div className="rounded-md border bg-white p-12 text-center text-sm text-slate-500">No templates found.</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((template) => { const imageUrl = getHeaderImageUrl(template); return <article key={template.id || template.name} className="overflow-hidden rounded-md border bg-white shadow-sm flex flex-col"><div className="flex items-start justify-between gap-2 p-4 pb-0"><h2 className="truncate font-semibold text-slate-900">{template.name}</h2><span className="rounded border px-2 py-0.5 text-xs">{template.status || "UNKNOWN"}</span></div>{imageUrl ? <div className="mx-4 mt-3 overflow-hidden rounded border bg-slate-100"><img src={imageUrl} alt={`${template.name || "WhatsApp"} header`} className="h-44 w-full object-cover" /><div className="flex justify-end border-t bg-white p-2"><a href={imageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"><ExternalLink className="h-3.5 w-3.5" />View image</a></div></div> : null}<div className="p-4 pt-3 flex-1"><p className="text-xs text-slate-500">{template.category || "-"} · {template.language || "-"}</p><p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{template.components?.find((component) => String(component.type || "").toUpperCase() === "BODY")?.text || "No body text"}</p></div><div className="p-4 pt-0"><button type="button" onClick={() => { setSelectedTemplate(template); setPreviewOpen(true); }} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"><Eye className="h-3.5 w-3.5" />Preview</button></div></article>; })}</div>}
        </section>
      </main>
      <CreateTemplateModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => queryClient.invalidateQueries({ queryKey: ["promotional-message-templates"] })} />
      <TemplatePreviewModal open={previewOpen} template={selectedTemplate} onClose={() => { setPreviewOpen(false); setSelectedTemplate(null); }} />
    </div>
  );
}
