import { forwardRef, useCallback, useEffect, useImperativeHandle } from "react";
import { useVoiceRemarks } from "@/hooks/useVoiceRemarks";
import { uploadInwardVoice } from "@/lib/purchaseOrderVoiceUpload";
import VoiceRemarkMicButton from "./VoiceRemarkMicButton";

/**
 * Per-item voice recorder for the Inward Entry page. Each instance owns its
 * own MediaRecorder/upload lifecycle so that pressing the mic for item N does
 * not affect the recording UI of any other item.
 *
 * Imperative API (via ref):
 *   - waitForVoiceUploadIfNeeded(): Promise<boolean>
 *   - getVoiceUrlForSubmit(): string
 *   - clearVoiceRemarks(): void
 *
 * Props:
 *   - value: optional initial URL (e.g. when re-opening a saved item)
 *   - onUrlChange(url): called when the per-item URL changes
 *   - disabled: passthrough to the mic button
 *   - className: passthrough
 */
const InwardItemVoiceRecorder = forwardRef(function InwardItemVoiceRecorder(
  { value = "", onUrlChange, disabled, className = "" },
  ref,
) {
  const upload = useCallback((blob) => uploadInwardVoice(blob), []);
  const voiceRemarks = useVoiceRemarks(upload);

  useEffect(() => {
    onUrlChange?.(voiceRemarks.voiceRemarksUrl || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceRemarks.voiceRemarksUrl]);

  useImperativeHandle(
    ref,
    () => ({
      waitForVoiceUploadIfNeeded: voiceRemarks.waitForVoiceUploadIfNeeded,
      getVoiceUrlForSubmit: voiceRemarks.getVoiceUrlForSubmit,
      clearVoiceRemarks: voiceRemarks.clearVoiceRemarks,
      isRecording: () => voiceRemarks.isRecordingVoice,
      isUploading: () => voiceRemarks.isUploadingVoice,
    }),
    [
      voiceRemarks.waitForVoiceUploadIfNeeded,
      voiceRemarks.getVoiceUrlForSubmit,
      voiceRemarks.clearVoiceRemarks,
      voiceRemarks.isRecordingVoice,
      voiceRemarks.isUploadingVoice,
    ],
  );

  const hasRemarks = voiceRemarks.hasVoiceRemarks || Boolean(String(value || "").trim());

  return (
    <VoiceRemarkMicButton
      isRecordingVoice={voiceRemarks.isRecordingVoice}
      isUploadingVoice={voiceRemarks.isUploadingVoice}
      hasVoiceRemarks={hasRemarks}
      disabled={disabled}
      onMicClick={voiceRemarks.handleVoiceMicClick}
      className={className}
    />
  );
});

export default InwardItemVoiceRecorder;
