import { createPortal } from "react-dom";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Fixed bottom-right microphone FAB — portaled to body so overflow-hidden layouts do not clip it.
 */
export default function VoiceRemarkFab({
  isRecordingVoice,
  isUploadingVoice,
  hasVoiceRemarks,
  disabled,
  onMicClick,
}) {
  const fab = (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2 pointer-events-none">
      <div className="pointer-events-auto flex flex-col items-end gap-2">
      {hasVoiceRemarks && !isRecordingVoice && (
        <span className="rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white shadow-md">
          Voice note ready
        </span>
      )}
      <Button
        type="button"
        size="icon"
        disabled={disabled || isUploadingVoice}
        onClick={onMicClick}
        title={
          isUploadingVoice
            ? "Uploading voice note..."
            : isRecordingVoice
              ? "Stop recording"
              : "Record voice remark"
        }
        aria-label={isRecordingVoice ? "Stop voice recording" : "Start voice recording"}
        className={`h-14 w-14 rounded-full shadow-lg border-2 transition-colors ${
          isRecordingVoice
            ? "bg-red-600 hover:bg-red-700 text-white border-red-700 ring-4 ring-red-200 animate-pulse"
            : hasVoiceRemarks
              ? "bg-green-600 hover:bg-green-700 text-white border-green-700 ring-4 ring-green-200"
              : "bg-gray-900 hover:bg-gray-800 text-white border-gray-700 ring-4 ring-gray-300"
        }`}
      >
        {isUploadingVoice ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : isRecordingVoice ? (
          <Square className="h-6 w-6 fill-current" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </Button>
      </div>
    </div>
  );

  if (typeof document === "undefined") return fab;
  return createPortal(fab, document.body);
}
