import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Inline microphone control (sales order branch field pattern).
 */
export default function VoiceRemarkMicButton({
  isRecordingVoice,
  isUploadingVoice,
  hasVoiceRemarks,
  disabled,
  onMicClick,
  className = "",
}) {
  return (
    <Button
      type="button"
      variant={isRecordingVoice ? "destructive" : hasVoiceRemarks ? "default" : "outline"}
      size="icon"
      className={`h-10 w-10 shrink-0 ${className}`}
      disabled={disabled || isUploadingVoice}
      onClick={onMicClick}
      title={
        isUploadingVoice
          ? "Uploading voice note..."
          : isRecordingVoice
            ? "Stop recording"
            : hasVoiceRemarks
              ? "Voice note ready — tap to re-record"
              : "Record voice remark"
      }
      aria-label={isRecordingVoice ? "Stop voice recording" : "Start voice recording"}
    >
      {isUploadingVoice ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecordingVoice ? (
        <Square className="h-4 w-4 fill-current" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
