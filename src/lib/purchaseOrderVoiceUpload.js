import { AuthService } from "./auth";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

/**
 * Upload recorded audio via vouchersApp → Cloudinary.
 * @param {Blob} audioBlob
 * @param {string} [folder] Cloudinary folder path
 * @returns {Promise<string>} Cloudinary secure URL
 */
export async function uploadAudioRecording(audioBlob, folder = "CPxGrowth/audio_recordings") {
  if (!audioBlob || !(audioBlob instanceof Blob)) {
    throw new Error("No audio recording to upload");
  }

  const formData = new FormData();
  const ext = audioBlob.type?.includes("ogg")
    ? "ogg"
    : audioBlob.type?.includes("mp4")
      ? "m4a"
      : "webm";
  formData.append("audio", audioBlob, `voice-remarks.${ext}`);

  const headers = { ...AuthService.getAuthHeaders() };
  delete headers["Content-Type"];

  const res = await fetch(
    `${API_BASE_URL}/api/voucher/upload-audio-recording/?folder=${encodeURIComponent(folder)}`,
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
    throw new Error(json.message || "Failed to upload voice note");
  }

  const url = json.data?.url;
  if (!url) {
    throw new Error("Upload succeeded but no URL was returned");
  }
  return url;
}

/** @param {Blob} audioBlob */
export function uploadPurchaseOrderVoice(audioBlob) {
  return uploadAudioRecording(audioBlob, "CPxGrowth/purchase_order_voice");
}

/** @param {Blob} audioBlob */
export function uploadSalesOrderVoice(audioBlob) {
  return uploadAudioRecording(audioBlob, "CPxGrowth/sales_order_voice");
}

/** @param {Blob} audioBlob */
export function uploadInwardVoice(audioBlob) {
  return uploadAudioRecording(audioBlob, "CPxGrowth/inward_voice");
}

/** @param {Blob} audioBlob */
export function uploadOutwardVoice(audioBlob) {
  return uploadAudioRecording(audioBlob, "CPxGrowth/outward_voice");
}
