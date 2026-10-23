import { AuthService } from "@/lib/auth";
import { apiUrl, parseJsonResponse } from "@/lib/api";

export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

async function uploadMultipart(endpoint, fieldName, file, folder) {
  if (!file || !(file instanceof Blob)) {
    throw new Error("No file to upload");
  }

  const formData = new FormData();
  const fileName =
    file instanceof File && file.name ? file.name : `upload-${Date.now()}.jpg`;
  formData.append(fieldName, file, fileName);

  const headers = { ...AuthService.getAuthHeaders() };
  delete headers["Content-Type"];

  const res = await fetch(`${apiUrl(endpoint)}?folder=${encodeURIComponent(folder)}`, {
    method: "POST",
    headers,
    body: formData,
    credentials: "include",
  });

  if (res.status === 401) {
    AuthService.clearAuthData();
    throw new Error("Session expired. Please sign in again.");
  }

  const data = await parseJsonResponse(res);
  const url =
    data.data?.url ||
    data.data?.secure_url ||
    data.data?.image_url ||
    data.url;
  if (!url) {
    throw new Error("Upload succeeded but no URL was returned");
  }
  return url;
}

export async function uploadMediaFile(file, folder = "promotional_whatsapp") {
  if (file?.size > MAX_MEDIA_BYTES) {
    throw new Error("File is too large (max 10 MB).");
  }
  // GrainPro vouchersApp media upload
  return uploadMultipart("/api/voucher/upload-media-file/", "file", file, folder);
}

export async function uploadAudioRecording(audioBlob, folder = "audio_recordings") {
  if (!audioBlob || !(audioBlob instanceof Blob)) {
    throw new Error("No audio recording to upload");
  }
  const ext = audioBlob.type?.includes("ogg")
    ? "ogg"
    : audioBlob.type?.includes("mp4")
      ? "m4a"
      : "webm";
  const namedBlob =
    audioBlob instanceof File
      ? audioBlob
      : new File([audioBlob], `voice-remarks.${ext}`, {
          type: audioBlob.type || "audio/webm",
        });
  return uploadMultipart("/api/voucher/upload-media-file/", "file", namedBlob, folder);
}

export function uploadBannerImage(file) {
  return uploadMediaFile(file, "banners");
}
