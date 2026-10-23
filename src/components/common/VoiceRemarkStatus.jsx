import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Recording / upload / attached feedback (add-purchase-order pattern).
 */
export default function VoiceRemarkStatus({
  isRecordingVoice,
  isUploadingVoice,
  hasVoiceRemarks,
  onClear,
  className = "",
}) {
  const showRecording = isRecordingVoice;
  const showUploading = isUploadingVoice && !isRecordingVoice;
  const showAttached = hasVoiceRemarks && !isRecordingVoice && !isUploadingVoice;

  if (!showRecording && !showUploading && !showAttached) {
    return null;
  }

  return (
    <div className={className}>
      {showRecording && (
        <p className="text-xs text-red-600 mt-1 flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-red-600 animate-pulse" />
          Recording… tap stop to upload in background
        </p>
      )}
      {showUploading && (
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          Uploading voice note… you can continue filling the form
        </p>
      )}
      {showAttached && (
        <div className="mt-1 flex items-center gap-2 text-xs text-green-700">
          <span className="truncate">Voice note attached</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onClear}
          >
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
