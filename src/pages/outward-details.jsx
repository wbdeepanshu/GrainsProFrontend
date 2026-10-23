import React, { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { isAdminSettingEnabled } from "@/lib/adminSettings";
import {
  Package, Truck, FileText, User, Clock, Tag, Loader2, Edit,
  Image, Eye, Save, X, Download, Building2, Layers, Camera, ChevronLeft, Menu, Plus, MapPin,
} from "lucide-react";
import vehicleTopView from "@/assets/vehicle.png";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useParams, useLocation } from "wouter";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import OutwardItemVoiceRecorder from "@/components/common/OutwardItemVoiceRecorder";
import VoiceRemarkPlaybackButton from "@/components/common/VoiceRemarkPlaybackButton";
import SplitLoadingRouteMapModal, {
  buildSplitVehicleMapRoutes,
} from "@/components/outward/SplitLoadingRouteMapModal";

// Status colors matching inward-list.jsx
const statusColors = {
  approved: "bg-green-100 text-green-700",
  completed: "bg-green-200 text-green-800",
  rejected: "bg-red-100 text-red-700",
  unloaded_but_rejected: "bg-red-200 text-red-800",
  pending: "bg-yellow-100 text-yellow-700",
  "assignment-pending": "bg-yellow-200 text-yellow-800",
  unloaded: "bg-blue-100 text-blue-700",
  "not uploaded": "bg-gray-100 text-gray-700",
  partial_completed: "bg-orange-100 text-orange-700",
};

const MAX_IMAGE_SIZE_BYTES = 50 * 1024 * 1024;

const validateImageFile = (file, toast) => {
  if (!file?.type?.startsWith("image/")) {
    toast?.({
      title: "Invalid file",
      description: "Please select an image file",
      variant: "destructive",
    });
    return false;
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    toast?.({
      title: "File too large",
      description: "Image size should be less than 50MB",
      variant: "destructive",
    });
    return false;
  }
  return true;
};

const capitalizeFirst = (str) => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const getSourceGroups = (detailsData) => {
  const soGroups = (detailsData?.sales_orders || []).map((g) => ({ ...g, _source_type: "sales_order" }));
  const prGroups = (detailsData?.purchase_returns || []).map((g) => ({ ...g, _source_type: "purchase_return" }));
  return [...soGroups, ...prGroups];
};

const DEFAULT_STACK_ROW_COUNT = 4;

const VEHICLE_CARGO_OVERLAY = { left: 22, top: 22, width: 67.5, height: 60 };
const VEHICLE_COLUMN_INSET = { top: 14, right: -2, left: 2, bottom: 4 };

const getStackBagsTotal = (stackRows = []) =>
  (stackRows || []).reduce((sum, row) => {
    const bags = parseFloat(row.bags_count);
    return sum + (Number.isFinite(bags) ? bags : 0);
  }, 0);

const applyStackTotalToGodowns = (godowns = [], stackTotal = 0) => {
  if (!godowns.length || stackTotal <= 0) return godowns;

  const updated = godowns.map((godown) => ({
    ...godown,
    batches: (godown.batches || []).map((batch) => ({ ...batch })),
  }));

  let remaining = stackTotal;
  for (const godown of updated) {
    for (const batch of godown.batches) {
      if (remaining <= 0) break;
      const maxBags = Math.round(
        parseFloat(batch.number_of_bags ?? batch.total_bags ?? 0)
      );
      const capacity = maxBags > 0 ? maxBags : remaining;
      const assignQty = Math.min(remaining, capacity);
      batch.loaded_quantity = assignQty;
      remaining -= assignQty;
    }
  }

  if (remaining > 0 && updated[0]?.batches?.[0]) {
    const firstBatch = updated[0].batches[0];
    firstBatch.loaded_quantity =
      (parseFloat(firstBatch.loaded_quantity) || 0) + remaining;
  }

  return updated;
};

const formatStackTotalForWeight = (total) => {
  if (!Number.isFinite(total) || total <= 0) return "";
  return Number.isInteger(total) ? String(total) : String(Number(total.toFixed(2)));
};

const formatDateTimeLocalValue = (date = new Date()) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatStartTimeForApi = (localDatetimeValue) => {
  if (!localDatetimeValue) return null;
  const d = new Date(localDatetimeValue);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const hours = d.getHours();
  const h12 = hours % 12 || 12;
  const ampm = hours >= 12 ? "PM" : "AM";
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(h12)}:${pad(d.getMinutes())} ${ampm}`;
};

const getStackTotalBags = getStackBagsTotal;

const sortStackColumnsForVehicle = (stackRows = []) =>
  [...(stackRows || [])]
    .filter((row) => String(row.bags_count ?? "").trim() !== "")
    .sort((a, b) => (parseInt(a.stack_number, 10) || 0) - (parseInt(b.stack_number, 10) || 0));

const apiStackInfoToLocalRows = (stackInfo = []) =>
  (stackInfo || []).map((entry, index) => ({
    localId: `api-${entry.id ?? entry.stack_number ?? index}`,
    stack_number: String(entry.stack_number ?? ""),
    bags_count: String(entry.bags_count ?? ""),
    images: (entry.images || []).map((img, imgIndex) => ({
      localId: `api-img-${img.id ?? imgIndex}`,
      url: img.media_url || img.url || img.image_url || "",
      uploading: false,
    })),
  }));

const apiEntryImagesToLocal = (images = []) =>
  (images || []).map((img, index) => ({
    localId: `api-entry-img-${img.id ?? index}`,
    id: img.id,
    type: img.type || "vehicle_photo",
    url: img.image_url || img.url || "",
    uploading: false,
  }));

const getStackRowImageUrls = (row) =>
  (row?.images || [])
    .map((img) => img?.url || img?.media_url || img?.image_url || "")
    .filter((url) => String(url).trim());

const createEmptyStackRow = (stackNumber = "") => ({
  localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  stack_number: stackNumber ? String(stackNumber) : "",
  bags_count: "",
  images: [],
});

const buildInitialStackRows = (count = DEFAULT_STACK_ROW_COUNT) =>
  Array.from({ length: count }, (_, index) => createEmptyStackRow(index + 1));

function StackRowInputGrid({
  stackRows = [],
  isUpdating,
  onUpdateRow,
  onRemoveRow,
  onAddRow,
  onImageSelect,
  onRemoveImage,
}) {
  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-blue-600" />
          Stack wise loading
        </span>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onAddRow} disabled={isUpdating}>
          <Plus className="h-3 w-3 mr-0.5" />
          Row
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {stackRows.map((row, rowIndex) => {
          const rowImages = row.images || [];
          const uploadedImage = rowImages.find((img) => img.url && !img.uploading);
          const isUploading = rowImages.some((img) => img.uploading);
          return (
            <div key={row.localId} className="rounded-md border bg-white p-2 shadow-sm min-w-0">
              <div className="flex items-center justify-between gap-0.5 mb-1.5">
                <span className="text-[11px] font-semibold text-gray-700 truncate">Stack</span>
                {rowIndex >= DEFAULT_STACK_ROW_COUNT && (
                  <button
                    type="button"
                    onClick={() => onRemoveRow(row.localId)}
                    disabled={isUpdating}
                    className="text-red-400 hover:text-red-600 shrink-0"
                    aria-label={`Remove stack ${row.stack_number}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Label className="text-[10px] font-medium text-gray-500 mb-1 block">No.</Label>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="1"
                className="h-7 mb-1.5 text-sm tabular-nums px-2"
                value={row.stack_number}
                onChange={(e) => onUpdateRow(row.localId, { stack_number: e.target.value })}
                disabled={isUpdating}
              />
              <Label className="text-[10px] font-medium text-gray-500 mb-1 block">Bags</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  className="h-8 flex-1 min-w-0 text-sm tabular-nums px-2"
                  value={row.bags_count}
                  onChange={(e) => onUpdateRow(row.localId, { bags_count: e.target.value })}
                  disabled={isUpdating}
                />
                <label
                  className={`relative inline-flex items-center justify-center h-8 w-8 shrink-0 rounded-md border ${
                    isUploading
                      ? "border-gray-200 bg-gray-50 opacity-60"
                      : uploadedImage
                        ? "border-blue-400 bg-blue-50 cursor-pointer"
                        : "border-dashed border-gray-300 hover:bg-gray-50 cursor-pointer"
                  }`}
                  title="Upload stack photo"
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                  ) : uploadedImage ? (
                    <>
                      <img src={uploadedImage.url} alt="" className="h-full w-full object-cover rounded-md" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onRemoveImage(row.localId, uploadedImage.localId);
                        }}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                      >
                        <X className="h-2 w-2" />
                      </button>
                    </>
                  ) : (
                    <Camera className="h-3.5 w-3.5 text-blue-600" />
                  )}
                  {!isUploading && (
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onImageSelect(row.localId, file);
                        e.target.value = "";
                      }}
                    />
                  )}
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StackRowImageViewDialog({ open, onOpenChange, imageUrls = [], rowLabel = "" }) {
  if (!imageUrls.length) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stack image — {rowLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {imageUrls.map((url, index) => (
            <div key={`${url}-${index}`} className="rounded-lg border bg-gray-50 p-2">
              <img src={url} alt={`${rowLabel} ${index + 1}`} className="w-full max-h-[70vh] object-contain rounded-md mx-auto" />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SavedStackInfoSection({ stackRows = [] }) {
  const [previewRow, setPreviewRow] = useState(null);
  if (!stackRows.length) return null;
  const previewImageUrls = previewRow ? getStackRowImageUrls(previewRow.row) : [];
  return (
    <div className="border-t pt-3 mt-3">
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <Layers className="h-4 w-4 text-blue-600" />
        Stacking Details
      </h4>
      <div className="grid grid-cols-4 gap-2 mb-2">
        {stackRows.map((row) => {
          const imageUrls = getStackRowImageUrls(row);
          return (
            <div key={row.localId} className="rounded-md border bg-white px-2.5 py-2 min-w-0">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-xs font-semibold text-gray-800 whitespace-nowrap">Stack {row.stack_number}</span>
                <span className="text-xs font-medium tabular-nums text-gray-900">{row.bags_count || 0} bags</span>
                {imageUrls.length ? (
                  <Button type="button" size="icon" onClick={() => setPreviewRow({ row })} className="h-7 w-7 shrink-0 bg-black hover:bg-gray-900 text-white">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <StackRowImageViewDialog
        open={Boolean(previewRow)}
        onOpenChange={(open) => { if (!open) setPreviewRow(null); }}
        imageUrls={previewImageUrls}
        rowLabel={previewRow ? `Row ${previewRow.row.stack_number}` : ""}
      />
    </div>
  );
}

function VehicleStackColumnPreview({ stackRows = [] }) {
  const columns = sortStackColumnsForVehicle(stackRows);
  const totalBags = getStackTotalBags(stackRows);
  if (!columns.length) return null;
  const maxBagsInColumn = columns.reduce((max, row) => {
    const bags = parseFloat(row.bags_count);
    return Number.isFinite(bags) && bags > max ? bags : max;
  }, 0);
  return (
    <div className="rounded-lg border bg-gradient-to-b from-slate-50 to-white p-2.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <Truck className="h-4 w-4 text-blue-600" />
          Vehicle preview
        </p>
        <Badge variant="secondary" className="text-xs h-6 tabular-nums px-2">
          {formatStackTotalForWeight(totalBags)} bags
        </Badge>
      </div>
      <div className="relative w-full select-none">
        <img src={vehicleTopView} alt="Vehicle top view" className="w-full h-auto block pointer-events-none" draggable={false} />
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${VEHICLE_CARGO_OVERLAY.left}%`,
            top: `${VEHICLE_CARGO_OVERLAY.top}%`,
            width: `${VEHICLE_CARGO_OVERLAY.width}%`,
            height: `${VEHICLE_CARGO_OVERLAY.height}%`,
          }}
        >
          <div
            className="absolute flex items-stretch justify-stretch overflow-hidden"
            style={{
              top: `${VEHICLE_COLUMN_INSET.top}%`,
              right: `${VEHICLE_COLUMN_INSET.right}%`,
              left: `${VEHICLE_COLUMN_INSET.left}%`,
              bottom: `${VEHICLE_COLUMN_INSET.bottom}%`,
            }}
          >
            {columns.map((row) => {
              const bags = parseFloat(row.bags_count) || 0;
              const heightPct = maxBagsInColumn > 0 ? Math.max(12, (bags / maxBagsInColumn) * 100) : 12;
              return (
                <div key={row.localId} className="flex-1 min-w-0 flex flex-col justify-end items-center px-0.5">
                  <div
                    className="w-full rounded-t bg-blue-500/75 border border-blue-600/40"
                    style={{ height: `${heightPct}%`, minHeight: "8px" }}
                    title={`Row ${row.stack_number}: ${row.bags_count} bags`}
                  />
                  <span className="text-[10px] font-bold text-gray-800 mt-0.5">{row.stack_number}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function OutwardItemImagesSection({ images = [] }) {
  const nonVehicleImages = (images || []).filter((img) => !String(img.type || "").toLowerCase().includes("vehicle"));
  if (!nonVehicleImages.length) return null;
  return (
    <div className="border-t pt-3 mt-3">
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <Image className="h-4 w-4" />
        Loading Images
      </h4>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {nonVehicleImages.map((img) => (
          <a key={img.id} href={img.image_url} target="_blank" rel="noreferrer" className="block rounded border overflow-hidden bg-gray-50 hover:opacity-90">
            <img src={img.image_url} alt={img.type || "Loading image"} className="w-full aspect-square object-cover" />
            <p className="text-[10px] text-center py-1 px-1 truncate text-gray-600">{img.type || "Image"}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

function OutwardEntryImagesSection({ images = [], onPreview }) {
  if (!images.length) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Truck className="h-4 w-4 text-blue-600" />
        Vehicle / Entry Images
      </h4>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {images.map((img) => (
          <button
            key={img.localId || img.id || img.url}
            type="button"
            onClick={() => onPreview?.(img.url || img.image_url, img.type || "Entry image")}
            className="block rounded border overflow-hidden bg-gray-50 hover:opacity-90 text-left"
          >
            <img
              src={img.url || img.image_url}
              alt={img.type || "Entry image"}
              className="w-full aspect-square object-cover"
            />
            <p className="text-[10px] text-center py-1 px-1 truncate text-gray-600">{img.type || "Image"}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function OutwardMediaImageField({
  label,
  imageUrl,
  isEditing,
  isUploading,
  onFileSelect,
  onRemove,
  onPreview,
  emptyText = "No image",
}) {
  return (
    <div className="space-y-1.5 min-w-0">
      <Label className="text-xs font-semibold text-gray-700">{label}</Label>
      {isEditing && (
        <Input
          type="file"
          accept="image/*"
          onChange={onFileSelect}
          className="cursor-pointer text-xs h-8"
        />
      )}
      {isUploading && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Uploading...
        </div>
      )}
      {imageUrl ? (
        <div className="relative h-24 rounded-md border bg-gray-50 overflow-hidden group">
          <button
            type="button"
            onClick={() => onPreview?.(imageUrl, label)}
            className="w-full h-full flex items-center justify-center p-1 hover:bg-gray-100/80 transition-colors"
            title="Click to preview"
          >
            <img
              src={imageUrl}
              alt={`${label} preview`}
              className="max-h-full max-w-full object-contain cursor-zoom-in"
            />
          </button>
          {isEditing && onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="absolute top-1 right-1 rounded-full bg-red-500 text-white p-1 shadow-sm opacity-90 hover:opacity-100"
              title={`Remove ${label}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : (
        !isUploading && <p className="text-xs text-gray-400 italic">{emptyText}</p>
      )}
    </div>
  );
}

function ImagePreviewDialog({ open, onOpenChange, imageUrl, title = "Image preview" }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="rounded-md border overflow-hidden bg-black/5">
          {imageUrl && (
            <img
              src={imageUrl}
              alt={title}
              className="w-full max-h-[75vh] object-contain mx-auto"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function OutwardDetails() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { hasUpdatePermission, hasModuleAccess, isLoading: permissionsLoading } = useUserPermissions();
  const stackwiseLoadingEnabled = isAdminSettingEnabled("stackwise_loading");
  const outwardVoiceRemarksEnabled = isAdminSettingEnabled("outward_voice_remarks");
  const voiceRecorderRefs = useRef({});
  const [detailsData, setDetailsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPdfLanguageDialogOpen, setIsPdfLanguageDialogOpen] = useState(false);
  const [selectedPdfLanguage, setSelectedPdfLanguage] = useState("en");
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [updateFormData, setUpdateFormData] = useState({});
  const [slipImages, setSlipImages] = useState({});
  const [slipImageRemovedByItem, setSlipImageRemovedByItem] = useState({});
  const [slipUploadingByItem, setSlipUploadingByItem] = useState({});
  const [entryStackRows, setEntryStackRows] = useState([]);
  const [draftStackRows, setDraftStackRows] = useState([]);
  const [isStackingPanelOpen, setIsStackingPanelOpen] = useState(false);
  const [entryImages, setEntryImages] = useState([]);
  const [draftEntryImages, setDraftEntryImages] = useState([]);
  const [entryImageUploading, setEntryImageUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState({ open: false, url: "", title: "Image preview" });
  const [routeMapOpen, setRouteMapOpen] = useState(false);
  const [startTimeDialog, setStartTimeDialog] = useState({
    open: false,
    itemId: null,
    godownIndex: null,
    godownName: "",
    value: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const API_BASE_URL = import.meta.env.VITE_BASE_URL;

  const gatePassMapSalesOrders = useMemo(() => {
    return (detailsData?.sales_orders || [])
      .map((so, index) => {
        const soNumber = String(so.so_number || so.order_id || "").trim();
        if (!soNumber) return null;
        const weightFromItems = (so.items || []).reduce((sum, item) => {
          const qty = Number(item.approved_quantity ?? item.quantity ?? item.loaded_quantity ?? 0);
          return sum + (Number.isFinite(qty) ? qty : 0);
        }, 0);
        return {
          so_number: soNumber,
          order_id: soNumber,
          customer_id: so.customer_id ?? null,
          customer_name: so.customer_name || "",
          sequence: so.sequence ?? index + 1,
          lat: so.lat,
          long: so.long ?? so.lng,
          address: so.address || "",
          weight_qtl: so.weight_qtl ?? (weightFromItems || null),
          distance_km: so.distance_km ?? null,
          has_coordinates: Boolean(
            so.has_coordinates ||
            (so.lat != null && so.lat !== "" && (so.long != null || so.lng != null) && so.long !== "" && so.lng !== ""),
          ),
          vehicle_no: detailsData?.vehicle_no || "",
        };
      })
      .filter(Boolean);
  }, [detailsData]);

  const gatePassMapVehicle = useMemo(() => {
    if (!detailsData?.vehicle_no) return null;
    return {
      key: `gp-${detailsData.id || "vehicle"}`,
      vehicle_no: detailsData.vehicle_no,
      capacity_qtl: null,
      mapped_weight_qtl: gatePassMapSalesOrders.reduce(
        (sum, so) => sum + (Number(so.weight_qtl) || 0),
        0,
      ),
      mapped_sales_orders: gatePassMapSalesOrders,
      sales_orders: gatePassMapSalesOrders,
    };
  }, [detailsData, gatePassMapSalesOrders]);

  const gatePassSoCoordById = useMemo(() => {
    const map = {};
    gatePassMapSalesOrders.forEach((so) => {
      map[so.so_number] = {
        lat: so.lat,
        long: so.long,
        customer_name: so.customer_name,
        address: so.address,
        weight_qtl: so.weight_qtl,
        customer_id: so.customer_id,
        has_coordinates: so.has_coordinates,
      };
    });
    return map;
  }, [gatePassMapSalesOrders]);

  const gatePassAssignmentBySo = useMemo(() => {
    const map = {};
    const vehicleNo = String(detailsData?.vehicle_no || "").trim();
    if (!vehicleNo) return map;
    gatePassMapSalesOrders.forEach((so) => {
      map[so.so_number] = vehicleNo;
    });
    return map;
  }, [detailsData?.vehicle_no, gatePassMapSalesOrders]);

  const gatePassMapRoutes = useMemo(() => {
    if (!gatePassMapVehicle) return [];
    return buildSplitVehicleMapRoutes({
      origin: detailsData?.delivery_origin || null,
      vehicles: [gatePassMapVehicle],
      soCoordById: gatePassSoCoordById,
    });
  }, [detailsData?.delivery_origin, gatePassMapVehicle, gatePassSoCoordById]);

  const canOpenAssignedMap =
    Boolean(detailsData?.vehicle_no) && gatePassMapSalesOrders.length > 0;

  const getEntryStackInfoFromDetails = (data) =>
    data?.stack_info || data?.additional_info?.stack_info || [];

  const getEntryImagesFromDetails = (data) =>
    data?.images || data?.additional_info?.images || data?.additional_info?.vehicle_images || [];

  const syncEntryLevelStateFromDetails = (data) => {
    const stackInfo = getEntryStackInfoFromDetails(data);
    const images = getEntryImagesFromDetails(data);
    setEntryStackRows(apiStackInfoToLocalRows(stackInfo));
    setEntryImages(apiEntryImagesToLocal(images));
  };

  const resetDraftEntryLevelState = () => {
    setDraftStackRows([]);
    setDraftEntryImages([]);
    setIsStackingPanelOpen(false);
  };

  const getNextDraftStackNumber = (rows = []) => {
    const savedMax = entryStackRows.reduce((max, row) => {
      const num = parseInt(row.stack_number, 10);
      return Number.isFinite(num) && num > max ? num : max;
    }, 0);
    const draftMax = rows.reduce((max, row) => {
      const num = parseInt(row.stack_number, 10);
      return Number.isFinite(num) && num > max ? num : max;
    }, 0);
    return Math.max(savedMax, draftMax) + 1;
  };

  const findItemById = (itemId) => {
    for (const group of getSourceGroups(detailsData)) {
      const item = (group.items || []).find((entry) => entry.id === itemId);
      if (item) return item;
    }
    return null;
  };

  const getGodownDisplayStartTime = (itemId, godownIndex, apiGodown) => {
    const formGodown = updateFormData[itemId]?.godowns?.[godownIndex];
    return formGodown?.pending_start_time || apiGodown?.start_time || formGodown?.start_time || null;
  };

  const godownNeedsStartTime = (itemId, godownIndex, apiGodown) =>
    !getGodownDisplayStartTime(itemId, godownIndex, apiGodown);

  const openStartTimeDialog = (itemId, godownIndex, godownName) => {
    setStartTimeDialog({
      open: true,
      itemId,
      godownIndex,
      godownName: godownName || `Godown ${godownIndex + 1}`,
      value: formatDateTimeLocalValue(new Date()),
    });
  };

  const closeStartTimeDialog = () => {
    setStartTimeDialog({
      open: false,
      itemId: null,
      godownIndex: null,
      godownName: "",
      value: "",
    });
  };

  const confirmStartTimeDialog = () => {
    const { itemId, godownIndex, value } = startTimeDialog;
    if (!value) {
      toast({
        title: "Start time required",
        description: "Please select a start date and time.",
        variant: "destructive",
      });
      return;
    }

    const apiTime = formatStartTimeForApi(value);
    if (!apiTime) {
      toast({
        title: "Invalid start time",
        description: "Please select a valid date and time.",
        variant: "destructive",
      });
      return;
    }

    const sourceItem = findItemById(itemId);
    setUpdateFormData((prev) => {
      const current = prev[itemId] || {};
      const baseGodowns = current.godowns || sourceItem?.godowns || [];
      const godowns = baseGodowns.map((godown) => ({
        ...godown,
        batches: (godown.batches || []).map((batch) => ({ ...batch })),
      }));

      if (!godowns[godownIndex]) return prev;

      godowns[godownIndex] = {
        ...godowns[godownIndex],
        pending_start_time: apiTime,
      };

      return {
        ...prev,
        [itemId]: {
          ...current,
          godowns,
        },
      };
    });

    toast({
      title: "Start time recorded",
      description: `Loading started at ${apiTime}`,
      variant: "success",
    });
    closeStartTimeDialog();
  };

  const ensureGodownStartTimeBeforeLoad = (itemId, godownIndex, godownName, apiGodown) => {
    if (!godownNeedsStartTime(itemId, godownIndex, apiGodown)) return true;
    openStartTimeDialog(itemId, godownIndex, godownName);
    return false;
  };

  useEffect(() => {
    if (!id) return;

    const fetchDetails = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const url = `${import.meta.env.VITE_BASE_URL}/api/sales/outward-entries/${id}/`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${AuthService.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.message || `HTTP ${response.status}: Failed to fetch Gate Pass details`;
          console.error('API Error:', errorData);
          throw new Error(errorMessage);
        }

        const data = await response.json();

        if (data.status && data.status !== 200) {
          console.error('API returned error status:', data);
          throw new Error(data.message || 'Failed to fetch gate pass details');
        }

        // console.log('Outward entry details loaded:', data.data);
        setDetailsData(data.data);
        syncEntryLevelStateFromDetails(data.data);
      } catch (err) {
        // console.error('Error fetching outward entry details:', err);
        setError(err.message);
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
  }, [id, toast, stackwiseLoadingEnabled]);

  // Initialize update form data when details are loaded
  useEffect(() => {
    const sourceGroups = getSourceGroups(detailsData);
    if (detailsData && sourceGroups.length > 0) {
      const initialFormData = {};

      // Collect items from all source groups (sales order + purchase return)
      sourceGroups.forEach((group) => {
        if (group.items) {
          group.items.forEach((item) => {
              // Check if item has batch-wise structure (godowns with batches)
              // Note: item.godowns is the godowns array (from serializer get_godowns method)
              if (item.godowns && Array.isArray(item.godowns) && item.godowns.length > 0) {
                // New batch-wise structure: item.godowns is array of godowns, each containing batches
                const godowns = item.godowns.map((godownGroup) => ({
                  godown_id: godownGroup.godown_id,
                  godown_name: godownGroup.godown_name,
                  supervisor_id: godownGroup.supervisor_id,
                  supervisor_name: godownGroup.supervisor_name,
                  start_time: godownGroup.start_time,
                  completed_time: godownGroup.completed_time,
                  loading_status: godownGroup.loading_status,
                  batches: (godownGroup.batches || []).map((batch) => ({
                    batch_id: batch.batch_id || batch.id,
                    name: batch.name,
                    number_of_bags: batch.number_of_bags !== undefined && batch.number_of_bags !== null
                      ? Math.round(parseFloat(batch.number_of_bags))
                      : 0,
                    loaded_quantity: batch.loaded_quantity !== null && batch.loaded_quantity !== undefined
                      ? Math.round(parseFloat(batch.loaded_quantity))
                      : 0
                  }))
                }));

                initialFormData[item.id] = {
                  godowns: godowns,
                  sup_remarks: item.sup_remarks || "",
                };
              } else {
                // Legacy structure: single loaded_quantity for the entire item
                let totalQty = 0;
                if (item.total_quantity !== null && item.total_quantity !== undefined) {
                  totalQty = item.total_quantity;
                } else if (item.number_of_bags !== null && item.number_of_bags !== undefined) {
                  totalQty = item.number_of_bags;
                }

                initialFormData[item.id] = {
                  loaded_quantity: totalQty, // Pre-fill with total quantity
                  sup_remarks: item.sup_remarks || "",
                };
              }
          });
        }
      });

      setUpdateFormData(initialFormData);
    }
  }, [detailsData]);

  // Update outward entry item status mutation
  const updateOutwardMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch(`${API_BASE_URL}/api/sales/update-outward/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AuthService.getAccessToken()}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update outward entry");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Success",
        description: data.message || "Outward entry updated successfully",
        variant: "success",
      });
      setIsUpdateMode(false);
      clearAllVoiceRecorders();
      // Refresh details - use response data if available, otherwise fetch
      if (data.data && data.data.outward_entry) {
        setDetailsData(data.data.outward_entry);
        syncEntryLevelStateFromDetails(data.data.outward_entry);
        resetDraftEntryLevelState();
      } else if (id) {
        // Fallback: fetch updated data
        fetch(`${API_BASE_URL}/api/sales/outward-entries/${id}/`, {
          headers: {
            'Authorization': `Bearer ${AuthService.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
        })
          .then(res => res.json())
          .then(responseData => {
            if (responseData.status === 200) {
              setDetailsData(responseData.data);
              syncEntryLevelStateFromDetails(responseData.data);
              resetDraftEntryLevelState();
            }
          })
          .catch(err => console.error('Error refreshing details:', err));
      }
      // Invalidate queries to refresh list
      queryClient.invalidateQueries(['outward-entries']);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update outward entry",
        variant: "destructive",
      });
    },
  });

  // Upload file to media API and return URL
  const uploadMediaFile = async (file) => {
    const token = AuthService.getAccessToken();
    if (!token) throw new Error("No authentication token found");
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE_URL}/api/voucher/upload-media-file/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.status !== 200) {
      throw new Error(result.message || "Failed to upload media");
    }
    return result.data?.url;
  };

  const clearAllVoiceRecorders = () => {
    Object.values(voiceRecorderRefs.current).forEach((ref) => ref?.clearVoiceRemarks?.());
    voiceRecorderRefs.current = {};
  };

  const toggleStackingPanel = () => {
    setIsStackingPanelOpen((prev) => {
      const nextOpen = !prev;
      if (nextOpen && !draftStackRows.length) {
        const nextNumber = getNextDraftStackNumber([]);
        setDraftStackRows([createEmptyStackRow(nextNumber)]);
      }
      return nextOpen;
    });
  };

  const addStackRow = () => {
    setDraftStackRows((prev) => {
      const nextNumber = getNextDraftStackNumber(prev);
      return [...prev, createEmptyStackRow(nextNumber)];
    });
  };

  const removeStackRow = (rowLocalId) => {
    setDraftStackRows((prev) => prev.filter((row) => row.localId !== rowLocalId));
  };

  const updateStackRow = (rowLocalId, patch) => {
    setDraftStackRows((prev) =>
      prev.map((row) => (row.localId === rowLocalId ? { ...row, ...patch } : row))
    );
  };

  const handleStackImageSelect = (rowLocalId, file) => {
    if (!validateImageFile(file, toast)) return;

    const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const previewUrl = URL.createObjectURL(file);

    setDraftStackRows((prev) =>
      prev.map((row) =>
        row.localId === rowLocalId
          ? {
              ...row,
              images: [...row.images, { localId, url: previewUrl, uploading: true }],
            }
          : row
      )
    );

    uploadMediaFile(file)
      .then((url) => {
        setDraftStackRows((prev) =>
          prev.map((row) =>
            row.localId === rowLocalId
              ? {
                  ...row,
                  images: row.images.map((img) =>
                    img.localId === localId ? { ...img, url, uploading: false } : img
                  ),
                }
              : row
          )
        );
        URL.revokeObjectURL(previewUrl);
      })
      .catch((error) => {
        setDraftStackRows((prev) =>
          prev.map((row) =>
            row.localId === rowLocalId
              ? { ...row, images: row.images.filter((img) => img.localId !== localId) }
              : row
          )
        );
        URL.revokeObjectURL(previewUrl);
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      });
  };

  const removeStackImage = (rowLocalId, imageLocalId) => {
    setDraftStackRows((prev) =>
      prev.map((row) =>
        row.localId === rowLocalId
          ? { ...row, images: row.images.filter((img) => img.localId !== imageLocalId) }
          : row
      )
    );
  };

  const buildEntryStackInfoPayload = () => {
    if (!stackwiseLoadingEnabled || !isStackingPanelOpen) return undefined;
    const rows = (draftStackRows || []).filter(
      (row) => String(row.bags_count || "").trim() !== "" && String(row.stack_number || "").trim() !== ""
    );
    if (!rows.length) return undefined;
    return rows.map((row) => {
      const imageUrls = row.images
        .filter((img) => img.url && !img.uploading)
        .map((img) => img.url);
      return {
        stack_number: Number(row.stack_number),
        bags_count: String(row.bags_count),
        ...(imageUrls.length ? { images: imageUrls } : {}),
      };
    });
  };

  const buildEntryImagesPayload = () => {
    const images = (draftEntryImages || [])
      .filter((img) => img.url && !img.uploading)
      .map((img) => ({
        type: img.type || "vehicle_photo",
        image_url: img.url,
        ...(img.remarks ? { remarks: img.remarks } : {}),
      }));
    return images.length ? images : undefined;
  };

  const handleEntryImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file || !validateImageFile(file, toast)) {
      event.target.value = "";
      return;
    }

    const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const previewUrl = URL.createObjectURL(file);
    setDraftEntryImages((prev) => [
      ...prev,
      { localId, type: "vehicle_photo", url: previewUrl, uploading: true },
    ]);
    setEntryImageUploading(true);

    uploadMediaFile(file)
      .then((url) => {
        setDraftEntryImages((prev) =>
          prev.map((img) =>
            img.localId === localId ? { ...img, url, uploading: false } : img
          )
        );
        URL.revokeObjectURL(previewUrl);
      })
      .catch((error) => {
        setDraftEntryImages((prev) => prev.filter((img) => img.localId !== localId));
        URL.revokeObjectURL(previewUrl);
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      })
      .finally(() => {
        setEntryImageUploading(false);
        event.target.value = "";
      });
  };

  const handleRemoveDraftEntryImage = (localId) => {
    setDraftEntryImages((prev) => {
      const target = prev.find((img) => img.localId === localId);
      if (target?.url?.startsWith("blob:")) URL.revokeObjectURL(target.url);
      return prev.filter((img) => img.localId !== localId);
    });
  };

  const handleImageChange = (itemId, event) => {
    const file = event.target.files?.[0];
    if (!file || !validateImageFile(file, toast)) {
      event.target.value = "";
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setSlipImages((prev) => ({ ...prev, [itemId]: previewUrl }));
    setSlipImageRemovedByItem((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    setSlipUploadingByItem((prev) => ({ ...prev, [itemId]: true }));

    uploadMediaFile(file)
      .then((url) => {
        setSlipImages((prev) => ({ ...prev, [itemId]: url }));
        URL.revokeObjectURL(previewUrl);
      })
      .catch((error) => {
        setSlipImages((prev) => {
          const next = { ...prev };
          if (next[itemId] === previewUrl) delete next[itemId];
          return next;
        });
        URL.revokeObjectURL(previewUrl);
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      })
      .finally(() => {
        setSlipUploadingByItem((prev) => ({ ...prev, [itemId]: false }));
        event.target.value = "";
      });
  };

  const getSlipImageUrl = (item) => {
    if (slipImageRemovedByItem[item.id]) return "";
    return slipImages[item.id] || item.slip_image || "";
  };

  const handleRemoveSlipImage = (itemId) => {
    setSlipImages((prev) => {
      const next = { ...prev };
      const url = next[itemId];
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      delete next[itemId];
      return next;
    });
    setSlipImageRemovedByItem((prev) => ({ ...prev, [itemId]: true }));
  };

  const openImagePreview = (url, title) => {
    if (!url) return;
    setImagePreview({ open: true, url, title: title || "Image preview" });
  };

  // Handle form submission
  const handleUpdateSubmit = async () => {
    const sourceGroups = getSourceGroups(detailsData);
    if (!detailsData || sourceGroups.length === 0) {
      return;
    }

    const hasUploadingSlipImages = Object.values(slipUploadingByItem).some(Boolean);
    const hasUploadingStackImages = stackwiseLoadingEnabled && (draftStackRows || []).some((row) =>
      row.images?.some((img) => img.uploading)
    );
    const hasUploadingEntryImages = (draftEntryImages || []).some((img) => img.uploading);
    if (hasUploadingSlipImages || hasUploadingStackImages || hasUploadingEntryImages || entryImageUploading) {
      toast({
        title: "Please wait",
        description: "Images are still uploading.",
        variant: "destructive",
      });
      return;
    }

    if (outwardVoiceRemarksEnabled) {
      for (const group of sourceGroups) {
        for (const item of group.items || []) {
          if (item.status === "completed") continue;
          const recorder = voiceRecorderRefs.current[item.id];
          if (!recorder) continue;
          if (recorder.isRecording?.()) {
            toast({
              title: "Please wait",
              description: "Stop voice recording before saving.",
              variant: "destructive",
            });
            return;
          }
          const voiceReady = await recorder.waitForVoiceUploadIfNeeded();
          if (!voiceReady) {
            toast({
              title: "Please wait",
              description: "Voice note is still uploading.",
              variant: "destructive",
            });
            return;
          }
        }
      }
    }

    const itemsToUpdate = [];
    const entryStackInfo = stackwiseLoadingEnabled ? buildEntryStackInfoPayload() : undefined;
    const entryImagesPayload = buildEntryImagesPayload();
    const draftStackTotal = stackwiseLoadingEnabled ? getStackBagsTotal(draftStackRows) : 0;
    const singleItemEntry = sourceGroups.reduce(
      (count, group) => count + (group.items || []).filter((item) => item.status !== "completed").length,
      0
    ) === 1;

    for (const group of sourceGroups) {
      for (const item of group.items || []) {
        if (item.status === "completed") continue;
        const formData = updateFormData[item.id] || {};
        if (!formData.godowns?.length) continue;

        const apiGodowns = item.godowns || [];
        for (let godownIndex = 0; godownIndex < formData.godowns.length; godownIndex += 1) {
          const godownGroup = formData.godowns[godownIndex];
          const apiGodown = apiGodowns[godownIndex] || {};
          const hasLoadedBatches = (godownGroup.batches || []).some(
            (batch) => (parseFloat(batch.loaded_quantity) || 0) > 0
          );
          const stackWillLoad =
            stackwiseLoadingEnabled && singleItemEntry && draftStackTotal > 0 && !hasLoadedBatches;

          if (
            (hasLoadedBatches || stackWillLoad) &&
            godownNeedsStartTime(item.id, godownIndex, apiGodown) &&
            !godownGroup.pending_start_time
          ) {
            toast({
              title: "Start time required",
              description: `Set start time for ${godownGroup.godown_name || `godown ${godownIndex + 1}`} before loading.`,
              variant: "destructive",
            });
            openStartTimeDialog(item.id, godownIndex, godownGroup.godown_name);
            return;
          }
        }
      }
    }

    // Collect items from all source groups (sales order + purchase return)
    sourceGroups.forEach((group) => {
      if (group.items) {
        group.items.forEach((item) => {
            // Skip completed items - they should not be updated
            if (item.status === 'completed') {
              return;
            }

            const formData = updateFormData[item.id] || {};
            const updateItem = {
              item_id: item.id,
            };

            // Check if using new batch-wise structure (godowns) or legacy structure (loaded_quantity)
            if (formData.godowns && formData.godowns.length > 0) {
              // New batch-wise structure
              updateItem.godowns = formData.godowns.map((godownGroup) => {
                const godownPayload = {
                  godown_id: godownGroup.godown_id,
                  batches: (godownGroup.batches || []).map(batch => {
                  // batch_id from API response is the batch master table id
                  const batchId = batch.batch_id || batch.id;
                  const loadedQty = batch.loaded_quantity !== null && batch.loaded_quantity !== undefined
                    ? Math.round(parseFloat(batch.loaded_quantity))
                    : null;

                  return {
                    batch_id: batchId, // Batch master table id (matches API response)
                    loaded_quantity: loadedQty
                  };
                }).filter(batch => batch.batch_id) // Only include batches with valid batch_id
                };

                if (godownGroup.pending_start_time) {
                  godownPayload.start_time = godownGroup.pending_start_time;
                }

                return godownPayload;
              }).filter((godown) => godown.start_time || (godown.batches && godown.batches.length > 0));
            } else {
              // Legacy structure: single loaded_quantity for the entire item
              updateItem.loaded_quantity = parseFloat(formData.loaded_quantity || formData.loaded_bags) || 0;
            }

            if (formData.sup_remarks && formData.sup_remarks.trim() !== "") {
              updateItem.sup_remarks = formData.sup_remarks.trim();
            }

            if (outwardVoiceRemarksEnabled) {
              const recorder = voiceRecorderRefs.current[item.id];
              if (recorder?.isVoiceCleared?.()) {
                updateItem.voice_sup_remarks = null;
              } else {
                const voiceSupUrl = recorder?.getVoiceUrlForSubmit?.();
                if (voiceSupUrl) {
                  updateItem.voice_sup_remarks = voiceSupUrl;
                }
              }
            }

            if (slipImageRemovedByItem[item.id]) {
              updateItem.slip_image = null;
            } else if (slipImages[item.id]) {
              updateItem.slip_image = slipImages[item.id];
            }

            if (
              stackwiseLoadingEnabled &&
              singleItemEntry &&
              draftStackTotal > 0 &&
              updateItem.godowns?.length
            ) {
              const godownLoadedTotal = updateItem.godowns.reduce(
                (sum, godown) =>
                  sum +
                  (godown.batches || []).reduce(
                    (batchSum, batch) => batchSum + (parseFloat(batch.loaded_quantity) || 0),
                    0
                  ),
                0
              );
              if (godownLoadedTotal <= 0) {
                updateItem.godowns = applyStackTotalToGodowns(updateItem.godowns, draftStackTotal);
              }
            }

          itemsToUpdate.push(updateItem);
        });
      }
    });

    const requestData = {
      outward_entry_id: Number(id),
      items: itemsToUpdate,
    };
    if (entryStackInfo) requestData.stack_info = entryStackInfo;
    if (entryImagesPayload) requestData.images = entryImagesPayload;

    updateOutwardMutation.mutate(requestData);
  };

  // Handle input change
  const handleInputChange = (itemId, field, value) => {
    setUpdateFormData(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
  };


  const handleBackToList = () => {
    setLocation("/outward/outward-list");
  };

  if (!id) return <div className="p-6">Invalid gate pass entry.</div>;

  return (
    <>
    <div className="app-layout bg-gray-50 dark:bg-gray-900">
      {!isMobile && <Sidebar />}
      <MobileSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      <div className="app-main-content">
        {isMobile && (
          <div className="bg-white dark:bg-gray-800 shadow-sm border-b px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Gate Pass Details</h1>
            <div className="w-10" />
          </div>
        )}

        <div className="flex-1 p-4 sm:p-6 overflow-auto space-y-4">
          <Button variant="ghost" size="sm" onClick={handleBackToList} className="-ml-2 h-8 gap-1 px-2 text-slate-600 hover:text-slate-900">
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Gate Pass List</span>
          </Button>

          {isLoading ? (
            <CommonLoader text="Loading Gate Pass details..." />
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600">{error}</p>
            </div>
          ) : detailsData ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-slate-500" />
                Gate Pass GP-{detailsData.outward_entry_no || detailsData.bill_no}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                {canOpenAssignedMap ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRouteMapOpen(true)}
                    className="flex items-center gap-2"
                    disabled={!gatePassMapRoutes.length}
                    title={
                      gatePassMapRoutes.length
                        ? "View assigned vehicle route map"
                        : "Origin or customer locations are missing — map unavailable"
                    }
                  >
                    <MapPin className="h-4 w-4" />
                    View assigned map
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  onClick={() => setIsPdfLanguageDialogOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            </div>

            {/* Vehicle / assignment summary */}
            <Card>
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Vehicle & assignment
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 pt-0 md:grid-cols-3">
                <div>
                  <Label className="text-xs font-medium text-slate-500">Vehicle Number</Label>
                  <p className="text-sm font-semibold text-slate-900">{detailsData.vehicle_no || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500">Sales Orders</Label>
                  <p className="text-sm font-semibold text-slate-900">{gatePassMapSalesOrders.length}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500">Driver</Label>
                  <p className="text-sm text-slate-900">
                    {detailsData.driver_name ||
                      detailsData.driver_assignment?.driver_name ||
                      "—"}
                  </p>
                </div>
                {gatePassMapSalesOrders.length > 0 ? (
                  <div className="md:col-span-3">
                    <Label className="text-xs font-medium text-slate-500">Assigned Stops</Label>
                    <ul className="mt-1 space-y-1">
                      {gatePassMapSalesOrders.map((so) => (
                        <li
                          key={so.so_number}
                          className="flex flex-wrap items-center gap-2 text-sm rounded-md border bg-slate-50 px-2 py-1.5"
                        >
                          <Badge variant="outline" className="text-xs">
                            {so.so_number}
                          </Badge>
                          <span className="text-gray-700">{so.customer_name || "—"}</span>
                          {so.has_coordinates ? (
                            <span className="text-xs text-emerald-700">Has location</span>
                          ) : (
                            <span className="text-xs text-amber-700">No location</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {canOpenAssignedMap && !gatePassMapRoutes.length ? (
                  <p className="md:col-span-3 text-sm text-amber-700">
                    Map needs branch/org START coordinates and at least one customer location.
                  </p>
                ) : null}
              </CardContent>
            </Card>
            {/* Basic Information */}
            <Card>
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-base font-semibold">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 pt-0 md:grid-cols-3">
                <div>
                  <Label className="text-xs font-medium text-slate-500">Bill Number</Label>
                  <p className="text-sm font-semibold text-slate-900">GP-{detailsData.outward_entry_no || detailsData.bill_no}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500">Date</Label>
                  <p className="text-sm text-slate-900">{detailsData.date}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500">Vehicle Number</Label>
                  <p className="text-sm text-slate-900">{detailsData.vehicle_no}</p>
                </div>
                <div>
                  <Label className="block mb-1 text-xs font-medium text-slate-500">Status</Label>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[detailsData.status] || "bg-gray-200 text-gray-800"}`}>
                    {capitalizeFirst(detailsData.status?.replace(/_/g, ' ') || 'pending')}
                  </span>
                </div>
                {detailsData.created_at && (
                  <div>
                    <Label className="text-xs font-medium text-slate-500">Created At</Label>
                    <p className="text-sm text-slate-900">{detailsData.created_at}</p>
                  </div>
                )}
                {detailsData.updated_at && (
                  <div>
                    <Label className="text-xs font-medium text-slate-500">Updated At</Label>
                    <p className="text-sm text-slate-900">{detailsData.updated_at}</p>
                  </div>
                )}
                {detailsData.sales_orders && detailsData.sales_orders.length > 0 && (
                  <div className="md:col-span-2">
                    <Label className="text-xs font-medium text-slate-500">Sales Orders</Label>
                    <div className="mt-1 space-y-1">
                      {detailsData.sales_orders.map((so, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                          <Badge variant="outline" className="text-xs">
                            {so.order_id || so.so_number || 'N/A'}
                          </Badge>
                          {so.customer_name && (
                            <span className="text-sm text-gray-600">- {so.customer_name}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {detailsData.purchase_returns && detailsData.purchase_returns.length > 0 && (
                  <div className="md:col-span-2">
                    <Label className="text-xs font-medium text-slate-500">Purchase Returns</Label>
                    <div className="mt-1 space-y-1">
                      {detailsData.purchase_returns.map((pr, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-amber-50 rounded">
                          <Badge variant="outline" className="text-xs">
                            {pr.order_id || pr.so_number || pr.voucher_number || 'N/A'}
                          </Badge>
                          {pr.customer_name && (
                            <span className="text-sm text-gray-600">- {pr.customer_name}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {detailsData.godown_sequence_details && detailsData.godown_sequence_details.length > 0 && (
                  <div className="md:col-span-3">
                    <Label className="text-xs font-medium text-slate-500">Godown Sequence</Label>
                    <div className="mt-1 space-y-1.5">
                      {detailsData.godown_sequence_details.map((seq, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200">
                          <Badge variant="outline" className="text-xs bg-white">
                            Seq: {seq.sequence}
                          </Badge>
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-blue-600" />
                            <span className="text-sm text-gray-800 font-medium">{seq.godown_name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {(stackwiseLoadingEnabled || entryImages.length > 0 || entryStackRows.length > 0 || isUpdateMode) && (
              <Card>
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Layers className="h-5 w-5 text-blue-600" />
                    Entry Stacking & Vehicle Images
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-4 pt-0">
                  {!isUpdateMode && entryStackRows.length > 0 && (
                    <>
                      <SavedStackInfoSection stackRows={entryStackRows} />
                      <VehicleStackColumnPreview stackRows={entryStackRows} />
                    </>
                  )}

                  {!isUpdateMode && entryImages.length > 0 && (
                    <OutwardEntryImagesSection images={entryImages} onPreview={openImagePreview} />
                  )}

                  {isUpdateMode && stackwiseLoadingEnabled && (
                    <div className="space-y-3">
                      {entryStackRows.length > 0 && (
                        <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 space-y-2">
                          <p className="text-xs font-semibold text-blue-800">Saved stacking (read-only)</p>
                          <SavedStackInfoSection stackRows={entryStackRows} />
                          <VehicleStackColumnPreview stackRows={entryStackRows} />
                        </div>
                      )}

                      <div className="pt-1 border-t border-gray-200 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-800">Add stacking rows for this update</p>
                          <Button
                            type="button"
                            variant={isStackingPanelOpen ? "default" : "outline"}
                            size="sm"
                            onClick={toggleStackingPanel}
                            disabled={updateOutwardMutation.isPending}
                            className="h-8"
                          >
                            <Layers className="h-3.5 w-3.5 mr-1" />
                            Stack wise loading
                          </Button>
                        </div>
                        {isStackingPanelOpen && (
                          <>
                            <StackRowInputGrid
                              stackRows={draftStackRows}
                              isUpdating={updateOutwardMutation.isPending}
                              onUpdateRow={updateStackRow}
                              onRemoveRow={removeStackRow}
                              onAddRow={addStackRow}
                              onImageSelect={handleStackImageSelect}
                              onRemoveImage={removeStackImage}
                            />
                            {draftStackRows.length > 0 && (
                              <VehicleStackColumnPreview stackRows={draftStackRows} />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {isUpdateMode && (
                    <div className="space-y-3 pt-2 border-t border-gray-200">
                      <Label className="text-sm font-semibold text-gray-800">Add vehicle / entry images</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleEntryImageChange}
                        className="cursor-pointer text-xs h-8 max-w-md"
                        disabled={updateOutwardMutation.isPending || entryImageUploading}
                      />
                      {entryImageUploading && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Uploading...
                        </div>
                      )}
                      {entryImages.length > 0 && (
                        <OutwardEntryImagesSection images={entryImages} onPreview={openImagePreview} />
                      )}
                      {draftEntryImages.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-gray-600">New images to save</p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {draftEntryImages.map((img) => (
                              <div key={img.localId} className="relative rounded border overflow-hidden bg-gray-50">
                                <button
                                  type="button"
                                  onClick={() => openImagePreview(img.url, img.type || "Entry image")}
                                  className="block w-full"
                                >
                                  <img src={img.url} alt={img.type || "Entry image"} className="w-full aspect-square object-cover" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDraftEntryImage(img.localId)}
                                  className="absolute top-1 right-1 rounded-full bg-red-500 text-white p-1"
                                  title="Remove"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Items Information */}
            <Card>
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-base font-semibold">
                  Items ({
                    getSourceGroups(detailsData).reduce((total, group) => total + (group.items?.length || 0), 0)
                  })
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {getSourceGroups(detailsData).length > 0 && (
                  <div className="space-y-5">
                    {/* Items grouped by source document */}
                    {getSourceGroups(detailsData).map((sourceGroup, sourceIndex) => (
                      <div key={sourceIndex} className="space-y-3">
                        {/* Source Header */}
                        <div className={`border-b pb-2 ${sourceGroup._source_type === 'purchase_return' ? 'border-amber-200' : 'border-blue-200'}`}>
                          <div className="flex items-center gap-2">
                            <FileText className={`h-5 w-5 ${sourceGroup._source_type === 'purchase_return' ? 'text-amber-600' : 'text-blue-600'}`} />
                            <div>
                              <h3 className="text-base font-semibold text-gray-800">
                                {sourceGroup._source_type === 'purchase_return' ? 'Purchase Return' : 'Sales Order'}: {sourceGroup.order_id || sourceGroup.so_number || sourceGroup.voucher_number || 'N/A'}
                              </h3>
                              {sourceGroup.customer_name && (
                                <p className="text-xs text-gray-600">Party: {sourceGroup.customer_name}</p>
                              )}
                              {sourceGroup.order_date && (
                                <p className="text-xs text-gray-500">Date: {sourceGroup.order_date}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Items for this source */}
                        {sourceGroup.items && sourceGroup.items.length > 0 ? (
                          <div>
                            <div className="w-full space-y-3">
                              {sourceGroup.items.map((item, index) => (
                                <Card key={item.id || index} className={`overflow-hidden ${item.status === 'completed' && isUpdateMode ? 'opacity-75 bg-gray-50' : ''}`}>
                                  <CardContent className="p-3">
                                    {item.status === 'completed' && isUpdateMode && (
                                      <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                                        <span className="font-semibold">✓ Completed:</span> This item has been completed and cannot be updated.
                                      </div>
                                    )}
                                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-4 items-start">
                                      <div className="space-y-3 min-w-0">
                                        <div>
                                          <h4 className="font-semibold text-sm text-gray-900 mb-0.5">{item.item_name}</h4>
                                          <div className="flex items-center gap-2 text-xs text-gray-600">
                                            <span>
                                              {(() => {
                                                const baseQty = parseFloat(item.total_quantity || 0);
                                                const conversion = parseFloat(item.conversion || 1);
                                                const alternateQty = baseQty * conversion;
                                                const baseUnit = (item.item_unit || '').toLowerCase();
                                                const alternateUnit = (item.alternate_unit || '').toLowerCase();

                                                return (
                                                  <>
                                                    Total <span className="font-medium text-gray-900">{Math.round(baseQty)}</span> {baseUnit}
                                                    {item.alternate_unit && item.conversion && (
                                                      <span className="ml-1 text-gray-500">= {Math.round(alternateQty)} {alternateUnit}</span>
                                                    )}
                                                  </>
                                                );
                                              })()}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[item.status] || "bg-gray-200 text-gray-800"}`}>
                                              {capitalizeFirst(item.status?.replace(/_/g, ' ') || 'pending')}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Stock Item & Quantity */}
                                        {item.godowns && item.godowns.length > 0 && (
                                          <div className="space-y-1.5">
                                            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                                              Stock Item & Quantity
                                            </div>
                                            <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                                              {item.godowns.map((godownGroup, godownIndex) => (
                                                <div key={godownIndex} className="border rounded overflow-hidden bg-gray-50">
                                                  {/* Godown Header - All in one row */}
                                                  <div className="bg-blue-50 px-2.5 py-1.5 border-b">
                                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                                      {/* Left: Godown Name */}
                                                      <div className="flex items-center gap-1.5">
                                                        <Building2 className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                                                        <span className="text-sm font-semibold text-blue-900 whitespace-nowrap">
                                                          {godownGroup.godown_name || `Godown ${godownGroup.godown_id}`}
                                                        </span>
                                                      </div>

                                                      {/* Middle: Times and Status */}
                                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        {getGodownDisplayStartTime(item.id, godownIndex, godownGroup) ? (
                                                          <div className="flex items-center gap-1 whitespace-nowrap">
                                                            <Clock className="h-3 w-3 text-gray-500 flex-shrink-0" />
                                                            <span className="text-xs text-gray-700">
                                                              Start: {getGodownDisplayStartTime(item.id, godownIndex, godownGroup)}
                                                            </span>
                                                          </div>
                                                        ) : (
                                                          <span className="text-xs text-gray-500 italic">Not started</span>
                                                        )}

                                                        {isUpdateMode && item.status !== "completed" && godownNeedsStartTime(item.id, godownIndex, godownGroup) && (
                                                          <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 px-2 text-xs"
                                                            onClick={() => openStartTimeDialog(
                                                              item.id,
                                                              godownIndex,
                                                              godownGroup.godown_name || `Godown ${godownGroup.godown_id}`
                                                            )}
                                                          >
                                                            <Clock className="h-3 w-3 mr-1" />
                                                            Set Start Time
                                                          </Button>
                                                        )}

                                                        {godownGroup.completed_time && (
                                                          <div className="flex items-center gap-1 whitespace-nowrap">
                                                            <Clock className="h-3 w-3 text-green-600 flex-shrink-0" />
                                                            <span className="text-xs text-gray-700">Completed: {godownGroup.completed_time}</span>
                                                          </div>
                                                        )}

                                                        {godownGroup.loading_status && (
                                                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap
                                                            ${godownGroup.loading_status === 'loaded' ? 'bg-green-100 text-green-700' :
                                                              godownGroup.loading_status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                                                                'bg-gray-100 text-gray-700'}
                                                          `}>
                                                            {capitalizeFirst(godownGroup.loading_status.replace(/_/g, ' '))}
                                                          </span>
                                                        )}
                                                      </div>

                                                      {/* Right: Supervisor */}
                                                      {godownGroup.supervisor_name && (
                                                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                          <User className="h-3 w-3 text-gray-500 flex-shrink-0" />
                                                          <span className="text-xs text-gray-600">{godownGroup.supervisor_name}</span>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>

                                                  {/* Batches List */}
                                                  {godownGroup.batches && godownGroup.batches.length > 0 && (
                                                    <div className="p-1.5">
                                                      <div className="space-y-0.5">
                                                        {godownGroup.batches.map((batch, batchIndex) => {
                                                          const batchQty = batch.number_of_bags !== undefined && batch.number_of_bags !== null
                                                            ? Math.round(parseFloat(batch.number_of_bags))
                                                            : batch.total_bags !== undefined && batch.total_bags !== null
                                                              ? Math.round(parseFloat(batch.total_bags))
                                                              : 0;

                                                          return (
                                                            <div key={batch.batch_id || batch.id || batchIndex} className="flex items-center justify-between py-1 px-1.5 hover:bg-white rounded">
                                                              <div className="flex items-center gap-1.5">
                                                                <Tag className="h-3 w-3 text-gray-400" />
                                                                <span className="text-xs font-medium text-gray-800">
                                                                  {(() => {
                                                                    // If batch.name is a number, display as integer, otherwise as string
                                                                    const batchName = batch.name || 'N/A';
                                                                    const batchNameNum = parseFloat(batchName);
                                                                    return batchName;
                                                                  })()}
                                                                </span>
                                                              </div>
                                                              {isUpdateMode && item.status !== 'completed' ? (
                                                                <div className="flex items-center gap-2">
                                                                  <Input
                                                                    type="number"
                                                                    min="0"
                                                                    step="1"
                                                                    placeholder="0"
                                                                    value={
                                                                      updateFormData[item.id]?.godowns?.[godownIndex]?.batches?.[batchIndex]?.loaded_quantity !== null &&
                                                                        updateFormData[item.id]?.godowns?.[godownIndex]?.batches?.[batchIndex]?.loaded_quantity !== undefined
                                                                        ? Math.round(updateFormData[item.id].godowns[godownIndex].batches[batchIndex].loaded_quantity)
                                                                        : (batch.loaded_quantity !== null && batch.loaded_quantity !== undefined
                                                                          ? Math.round(parseFloat(batch.loaded_quantity))
                                                                          : '')
                                                                    }
                                                                    onFocus={() => {
                                                                      ensureGodownStartTimeBeforeLoad(
                                                                        item.id,
                                                                        godownIndex,
                                                                        godownGroup.godown_name || `Godown ${godownGroup.godown_id}`,
                                                                        godownGroup
                                                                      );
                                                                    }}
                                                                    onChange={(e) => {
                                                                      if (!ensureGodownStartTimeBeforeLoad(
                                                                        item.id,
                                                                        godownIndex,
                                                                        godownGroup.godown_name || `Godown ${godownGroup.godown_id}`,
                                                                        godownGroup
                                                                      )) {
                                                                        return;
                                                                      }
                                                                      const value = e.target.value;
                                                                      setUpdateFormData(prev => {
                                                                        const current = prev[item.id] || {};
                                                                        const godowns = current.godowns || [...(item.godowns || [])];
                                                                        if (!godowns[godownIndex]) {
                                                                          godowns[godownIndex] = { ...godownGroup, batches: [...(godownGroup.batches || [])] };
                                                                        }
                                                                        if (!godowns[godownIndex].batches) {
                                                                          godowns[godownIndex].batches = [...(godownGroup.batches || [])];
                                                                        }
                                                                        if (!godowns[godownIndex].batches[batchIndex]) {
                                                                          godowns[godownIndex].batches[batchIndex] = { ...batch };
                                                                        }
                                                                        godowns[godownIndex].batches[batchIndex] = {
                                                                          ...godowns[godownIndex].batches[batchIndex],
                                                                          batch_id: batch.batch_id || batch.id,
                                                                          loaded_quantity: value ? Math.round(parseFloat(value)) : null
                                                                        };
                                                                        return {
                                                                          ...prev,
                                                                          [item.id]: {
                                                                            ...current,
                                                                            godowns: godowns
                                                                          }
                                                                        };
                                                                      });
                                                                    }}
                                                                    className="w-16 h-6 text-xs"
                                                                  />
                                                                  <span className="text-xs text-gray-500">/ {batchQty}</span>
                                                                </div>
                                                              ) : (
                                                                <div className="flex items-center gap-1.5">
                                                                  <span className="text-xs font-medium text-gray-700">
                                                                    {batch.loaded_quantity !== null && batch.loaded_quantity !== undefined
                                                                      ? Math.round(parseFloat(batch.loaded_quantity))
                                                                      : 0}
                                                                  </span>
                                                                  <span className="text-xs text-gray-500">/ {batchQty}</span>
                                                                </div>
                                                              )}
                                                            </div>
                                                          );
                                                        })}
                                                      </div>
                                                      {godownGroup.batches.length > 1 && (
                                                        <div className="mt-2 pt-2 border-t flex items-center justify-between px-2">
                                                          <span className="text-xs font-semibold text-gray-700">Total</span>
                                                          <span className="text-sm font-semibold text-gray-900">
                                                            {godownGroup.batches.reduce((sum, batch) => {
                                                              const qty = batch.number_of_bags !== undefined && batch.number_of_bags !== null
                                                                ? Math.round(parseFloat(batch.number_of_bags))
                                                                : batch.total_bags !== undefined && batch.total_bags !== null
                                                                  ? Math.round(parseFloat(batch.total_bags))
                                                                  : 0;
                                                              return sum + qty;
                                                            }, 0)}
                                                          </span>
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      <div className="space-y-3 min-w-0 lg:sticky lg:top-4">
                                        <div className="rounded-lg border bg-white p-3 space-y-3">
                                          <OutwardMediaImageField
                                            label="Slip Image"
                                            imageUrl={getSlipImageUrl(item)}
                                            isEditing={isUpdateMode && item.status !== "completed"}
                                            isUploading={Boolean(slipUploadingByItem[item.id])}
                                            onFileSelect={(e) => handleImageChange(item.id, e)}
                                            onRemove={() => handleRemoveSlipImage(item.id)}
                                            onPreview={openImagePreview}
                                            emptyText="No slip image"
                                          />

                                          {(isUpdateMode || item.status !== 'pending') && (
                                            <div className="pt-2 border-t border-gray-100">
                                              {isUpdateMode && item.status !== 'completed' ? (
                                                outwardVoiceRemarksEnabled ? (
                                                  <OutwardItemVoiceRecorder
                                                    ref={(el) => {
                                                      if (el) voiceRecorderRefs.current[item.id] = el;
                                                      else delete voiceRecorderRefs.current[item.id];
                                                    }}
                                                    showTextarea
                                                    label="Supervisor Remarks"
                                                    placeholder="Enter supervisor remarks (optional)"
                                                    textValue={updateFormData[item.id]?.sup_remarks ?? item.sup_remarks ?? item.remarks ?? ""}
                                                    onTextChange={(text) => handleInputChange(item.id, 'sup_remarks', text)}
                                                    value={item.voice_sup_remarks || ""}
                                                    disabled={updateOutwardMutation.isPending}
                                                  />
                                                ) : (
                                                  <div className="space-y-2">
                                                    <Label className="text-xs font-semibold text-gray-700">Supervisor Remarks</Label>
                                                    <Textarea
                                                      value={updateFormData[item.id]?.sup_remarks || item.sup_remarks || item.remarks || ""}
                                                      onChange={(e) => handleInputChange(item.id, 'sup_remarks', e.target.value)}
                                                      placeholder="Enter supervisor remarks (optional)"
                                                      rows={2}
                                                      className="text-sm flex-1 min-w-0 resize-y"
                                                    />
                                                  </div>
                                                )
                                              ) : (
                                                <div className="space-y-2">
                                                  {item.remarks && (
                                                    <div className="p-2 bg-gray-50 rounded text-sm">
                                                      <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-medium text-gray-600">Remarks:</span>
                                                        {outwardVoiceRemarksEnabled && item.voice_remarks && (
                                                          <VoiceRemarkPlaybackButton
                                                            url={item.voice_remarks}
                                                            title="Play entry voice remark"
                                                            size="icon"
                                                          />
                                                        )}
                                                      </div>
                                                      <p className="text-gray-800 mt-1">{item.remarks}</p>
                                                    </div>
                                                  )}
                                                  {outwardVoiceRemarksEnabled && item.voice_remarks && !item.remarks && (
                                                    <div className="p-2 bg-gray-50 rounded text-sm flex items-center justify-between gap-2">
                                                      <span className="text-xs font-medium text-gray-600">Entry voice remark</span>
                                                      <VoiceRemarkPlaybackButton
                                                        url={item.voice_remarks}
                                                        title="Play entry voice remark"
                                                        size="icon"
                                                      />
                                                    </div>
                                                  )}
                                                  {item.sup_remarks && (
                                                    <div className="p-2 bg-blue-50 rounded text-sm">
                                                      <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-medium text-blue-600">Supervisor Remarks:</span>
                                                        {outwardVoiceRemarksEnabled && item.voice_sup_remarks && (
                                                          <VoiceRemarkPlaybackButton
                                                            url={item.voice_sup_remarks}
                                                            title="Play supervisor voice remark"
                                                            size="icon"
                                                          />
                                                        )}
                                                      </div>
                                                      <p className="text-gray-800 mt-1">{item.sup_remarks}</p>
                                                    </div>
                                                  )}
                                                  {outwardVoiceRemarksEnabled && item.voice_sup_remarks && !item.sup_remarks && (
                                                    <div className="p-2 bg-blue-50 rounded text-sm flex items-center justify-between gap-2">
                                                      <span className="text-xs font-medium text-blue-600">Supervisor voice remark</span>
                                                      <VoiceRemarkPlaybackButton
                                                        url={item.voice_sup_remarks}
                                                        title="Play supervisor voice remark"
                                                        size="icon"
                                                      />
                                                    </div>
                                                  )}
                                                  {!item.remarks && !item.sup_remarks && !item.voice_remarks && !item.voice_sup_remarks && (
                                                    <p className="text-sm text-gray-400 italic">No remarks</p>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>

                                        {!isUpdateMode && item.images?.length > 0 && (
                                          <OutwardItemImagesSection images={item.images} />
                                        )}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-sm text-gray-500">
                            No items found for this source
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Show message if no items at all */}
                {getSourceGroups(detailsData).length === 0 && (
                  <p className="text-gray-500 text-center py-4">No items found</p>
                )}
              </CardContent>
            </Card>
          </div>
          ) : null}

        {/* Footer with Update Status button */}
        {detailsData && (
          <div
            className={
              isUpdateMode
                ? "sticky bottom-0 z-10 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 flex justify-end gap-2 border-t bg-white/95 px-4 py-3 sm:px-6 backdrop-blur"
                : "flex justify-end gap-2 border-t pt-3"
            }
          >
            {!isUpdateMode && (() => {
              // Check if there are any items that are not completed
              // Only show update button if there are items with status other than 'completed'
              const hasNonCompletedItems = getSourceGroups(detailsData).some(group =>
                group.items?.some(item => item.status !== 'completed')
              );
              return hasNonCompletedItems && detailsData.status !== 'completed' && hasUpdatePermission("outward");
            })() && (
              <Button
                size="sm"
                onClick={() => {
                  setIsUpdateMode(true);
                  resetDraftEntryLevelState();
                }}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Update Status
              </Button>
            )}
            {isUpdateMode && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsUpdateMode(false);
                    closeStartTimeDialog();
                    clearAllVoiceRecorders();
                    // Reset form data
                    const sourceGroups = getSourceGroups(detailsData);
                    if (detailsData && sourceGroups.length > 0) {
                      const initialFormData = {};

                      // Collect items from all source groups (sales order + purchase return)
                      sourceGroups.forEach((group) => {
                        if (group.items) {
                          group.items.forEach((item) => {
                              // Check if item has batch-wise structure (godowns with batches)
                              // Note: item.godowns is the godowns array (from serializer get_godowns method)
                              if (item.godowns && Array.isArray(item.godowns) && item.godowns.length > 0) {
                                // New batch-wise structure: item.godowns is array of godowns, each containing batches
                                const godowns = item.godowns.map((godownGroup) => ({
                                  godown_id: godownGroup.godown_id,
                                  godown_name: godownGroup.godown_name,
                                  supervisor_id: godownGroup.supervisor_id,
                                  supervisor_name: godownGroup.supervisor_name,
                                  start_time: godownGroup.start_time,
                                  completed_time: godownGroup.completed_time,
                                  loading_status: godownGroup.loading_status,
                                  batches: (godownGroup.batches || []).map((batch) => ({
                                    batch_id: batch.batch_id || batch.id,
                                    name: batch.name,
                                    number_of_bags: batch.number_of_bags || 0,
                                    loaded_quantity: batch.loaded_quantity !== null && batch.loaded_quantity !== undefined
                                      ? Math.round(parseFloat(batch.loaded_quantity))
                                      : 0
                                  }))
                                }));

                                initialFormData[item.id] = {
                                  godowns: godowns,
                                  sup_remarks: item.sup_remarks || "",
                                };
                              } else {
                                // Legacy structure: single loaded_quantity for the entire item
                                initialFormData[item.id] = {
                                  loaded_quantity: item.loaded_quantity || item.loaded_bags || 0, // Support both for backward compatibility
                                  sup_remarks: item.sup_remarks || "",
                                };
                              }
                          });
                        }
                      });

                      setUpdateFormData(initialFormData);
                      setSlipImages({});
                      setSlipImageRemovedByItem({});
                      setSlipUploadingByItem({});
                      resetDraftEntryLevelState();
                      syncEntryLevelStateFromDetails(detailsData);
                    }
                  }}
                  disabled={updateOutwardMutation.isPending}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpdateSubmit}
                  disabled={updateOutwardMutation.isPending}
                  className="flex items-center gap-2"
                >
                  {updateOutwardMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
    <Dialog open={isPdfLanguageDialogOpen} onOpenChange={setIsPdfLanguageDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select PDF Language</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose a language for Gate Pass PDF. Numbers and codes remain unchanged.
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
                const entryId = id || detailsData?.id;
                setIsPdfLanguageDialogOpen(false);
                setLocation(`/outward/gate-pass-pdf?id=${entryId}&lang=${selectedPdfLanguage || "en"}`);
              }}
            >
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog
      open={startTimeDialog.open}
      onOpenChange={(open) => {
        if (!open) closeStartTimeDialog();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Loading Start Time</DialogTitle>
          <DialogDescription>
            {startTimeDialog.godownName
              ? `Record when loading started for ${startTimeDialog.godownName}.`
              : "Record when loading started for this godown."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="outward-start-time">Start date & time</Label>
          <Input
            id="outward-start-time"
            type="datetime-local"
            value={startTimeDialog.value}
            onChange={(e) =>
              setStartTimeDialog((prev) => ({ ...prev, value: e.target.value }))
            }
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={closeStartTimeDialog}>
            Cancel
          </Button>
          <Button type="button" onClick={confirmStartTimeDialog}>
            Confirm Start Time
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ImagePreviewDialog
      open={imagePreview.open}
      onOpenChange={(open) => setImagePreview((prev) => ({ ...prev, open }))}
      imageUrl={imagePreview.url}
      title={imagePreview.title}
    />
    {routeMapOpen && gatePassMapVehicle ? (
      <SplitLoadingRouteMapModal
        open={routeMapOpen}
        onClose={() => setRouteMapOpen(false)}
        readOnly
        routes={gatePassMapRoutes}
        origin={detailsData?.delivery_origin || null}
        allSalesOrders={gatePassMapSalesOrders}
        soCoordById={gatePassSoCoordById}
        assignmentBySoNumber={gatePassAssignmentBySo}
        vehicles={[gatePassMapVehicle]}
      />
    ) : null}
    </>
  );
}