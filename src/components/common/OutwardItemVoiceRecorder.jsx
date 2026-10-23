import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { useVoiceRemarks } from "@/hooks/useVoiceRemarks";
import { uploadOutwardVoice } from "@/lib/purchaseOrderVoiceUpload";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import VoiceRemarkMicButton from "./VoiceRemarkMicButton";
import VoiceRemarkStatus from "./VoiceRemarkStatus";
import VoiceRemarkPlaybackButton from "./VoiceRemarkPlaybackButton";

const OutwardItemVoiceRecorder = forwardRef(function OutwardItemVoiceRecorder(
  {
    value = "",
    onUrlChange,
    disabled,
    className = "",
    textValue = "",
    onTextChange,
    label = "Supervisor Remarks",
    placeholder = "Enter supervisor remarks (optional)",
    showTextarea = false,
  },
  ref,
) {
  const upload = useCallback((blob) => uploadOutwardVoice(blob), []);
  const voiceRemarks = useVoiceRemarks(upload);
  const [clearedInitial, setClearedInitial] = useState(false);

  useEffect(() => {
    setClearedInitial(false);
  }, [value]);

  useEffect(() => {
    if (voiceRemarks.voiceRemarksUrl) {
      setClearedInitial(false);
    }
    onUrlChange?.(voiceRemarks.voiceRemarksUrl || "");
  }, [voiceRemarks.voiceRemarksUrl, onUrlChange]);

  const playbackUrl = clearedInitial
    ? (voiceRemarks.voiceRemarksUrl || "").trim()
    : (voiceRemarks.voiceRemarksUrl || value || "").trim();

  const handleClearVoice = () => {
    voiceRemarks.clearVoiceRemarks();
    setClearedInitial(true);
    onUrlChange?.("");
  };

  useImperativeHandle(
    ref,
    () => ({
      waitForVoiceUploadIfNeeded: voiceRemarks.waitForVoiceUploadIfNeeded,
      getVoiceUrlForSubmit: () => {
        if (clearedInitial && !voiceRemarks.voiceRemarksUrl) return "";
        if (voiceRemarks.voiceRemarksUrl) return voiceRemarks.getVoiceUrlForSubmit();
        return (value || "").trim();
      },
      isVoiceCleared: () => clearedInitial && !voiceRemarks.voiceRemarksUrl,
      clearVoiceRemarks: handleClearVoice,
      isRecording: () => voiceRemarks.isRecordingVoice,
      isUploading: () => voiceRemarks.isUploadingVoice,
    }),
    [
      voiceRemarks.waitForVoiceUploadIfNeeded,
      voiceRemarks.getVoiceUrlForSubmit,
      voiceRemarks.voiceRemarksUrl,
      voiceRemarks.isRecordingVoice,
      voiceRemarks.isUploadingVoice,
      clearedInitial,
      value,
    ],
  );

  const hasRemarks =
    Boolean(playbackUrl) ||
    voiceRemarks.isRecordingVoice ||
    voiceRemarks.isUploadingVoice;

  const canPreview =
    Boolean(playbackUrl) &&
    !voiceRemarks.isRecordingVoice &&
    !voiceRemarks.isUploadingVoice;

  const voiceControls = (
    <div className="flex items-start gap-2 shrink-0">
      <VoiceRemarkMicButton
        isRecordingVoice={voiceRemarks.isRecordingVoice}
        isUploadingVoice={voiceRemarks.isUploadingVoice}
        hasVoiceRemarks={hasRemarks}
        disabled={disabled}
        onMicClick={voiceRemarks.handleVoiceMicClick}
      />
      {canPreview && (
        <VoiceRemarkPlaybackButton
          url={playbackUrl}
          title="Preview voice note"
          size="icon"
        />
      )}
    </div>
  );

  const voiceStatus = (
    <VoiceRemarkStatus
      isRecordingVoice={voiceRemarks.isRecordingVoice}
      isUploadingVoice={voiceRemarks.isUploadingVoice}
      hasVoiceRemarks={hasRemarks}
      onClear={handleClearVoice}
    />
  );

  if (showTextarea) {
    return (
      <div className={className}>
        <Label className="text-xs font-semibold text-gray-700 mb-1 block">{label}</Label>
        <div className="flex items-start gap-2">
          <Textarea
            value={textValue}
            onChange={(e) => onTextChange?.(e.target.value)}
            placeholder={placeholder}
            rows={2}
            disabled={disabled}
            className="flex-1 min-w-0 text-sm resize-y"
          />
          {voiceControls}
        </div>
        {voiceStatus}
      </div>
    );
  }

  return (
    <div className={className}>
      {voiceControls}
      {voiceStatus}
    </div>
  );
});

export default OutwardItemVoiceRecorder;
