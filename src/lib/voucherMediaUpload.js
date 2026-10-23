import { AuthService } from "./auth";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

export const MAX_VOUCHER_MEDIA_BYTES = 50 * 1024 * 1024;

export const canvasToBlob = (canvas, type = "image/jpeg", quality = 0.9) =>
  new Promise((resolve) => {
    if (!canvas) {
      resolve(null);
      return;
    }
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });

export const dataUrlToBlob = async (dataUrl) => {
  const response = await fetch(dataUrl);
  return response.blob();
};

export const captureCanvasImage = async (canvas) => {
  const preview = canvas.toDataURL("image/jpeg", 0.9);
  let blob = await canvasToBlob(canvas, "image/jpeg", 0.9);
  if (!blob || blob.size === 0) {
    blob = await dataUrlToBlob(preview);
  }
  return { preview, blob };
};

/**
 * Upload image/media via vouchersApp → Cloudinary.
 * @param {File|Blob} file
 * @param {string} [folder] Cloudinary folder path
 * @returns {Promise<string>} Cloudinary secure URL
 */
export async function uploadVoucherMediaFile(file, folder = "CPxGrowth/vehicle_info") {
  if (!file || !(file instanceof Blob)) {
    throw new Error("No file to upload");
  }

  const formData = new FormData();
  const fileName =
    file instanceof File && file.name
      ? file.name
      : `media-${Date.now()}.jpg`;
  formData.append("file", file, fileName);

  const headers = { ...AuthService.getAuthHeaders() };
  delete headers["Content-Type"];

  const res = await fetch(
    `${API_BASE_URL}/api/voucher/upload-media-file/?folder=${encodeURIComponent(folder)}`,
    {
      method: "POST",
      headers,
      body: formData,
      credentials: "include",
    }
  );

  if (res.status === 401) {
    AuthService.clearAuthData();
    throw new Error("Session expired. Please sign in again.");
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json.status && Number(json.status) >= 400)) {
    throw new Error(json.message || "Failed to upload image");
  }

  const url =
    json.data?.url ||
    json.data?.secure_url ||
    json.data?.image_url ||
    json.data?.image ||
    json.url;
  if (!url) {
    throw new Error("Upload succeeded but no URL was returned");
  }
  return url;
}
