import { MessageSquare } from "lucide-react";
import VoiceRemarkPlaybackButton from "./VoiceRemarkPlaybackButton";

const REMARK_PAIRS = [
  { label: "Lab Tech", textKey: "lab_tech_remarks", voiceKey: "voice_lab_tech_remarks" },
  { label: "Admin", textKey: "remarks", voiceKey: "voice_admin_remarks" },
  { label: "Assignment", textKey: "assignment_remarks", voiceKey: "voice_assignment_remarks" },
  { label: "Supervisor", textKey: "supervisor_remarks", voiceKey: "voice_supervisor_remarks" },
  { label: "Final", textKey: "final_remarks", voiceKey: "voice_final_remarks" },
];

function hasContent(value) {
  return Boolean(String(value ?? "").trim());
}

/**
 * Compact remarks strip: one horizontal row, column header + text + voice per type.
 */
export default function InwardItemRemarksSection({ item, className = "" }) {
  if (!item) return null;

  const columns = REMARK_PAIRS.filter(
    ({ textKey, voiceKey }) => hasContent(item[textKey]) || hasContent(item[voiceKey])
  );

  if (columns.length === 0) return null;

  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <MessageSquare className="h-3.5 w-3.5 text-gray-500 shrink-0" />
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Remarks</span>
      </div>
      <div className="rounded-md border border-gray-200 bg-gray-50/90 overflow-hidden">
        <div
          className="flex flex-nowrap divide-x divide-gray-200 overflow-x-auto"
          style={{ scrollbarWidth: "thin" }}
        >
          {columns.map(({ label, textKey, voiceKey }) => {
            const text = String(item[textKey] ?? "").trim();
            const voiceUrl = String(item[voiceKey] ?? "").trim();
            return (
              <div
                key={textKey}
                className="flex-1 min-w-[7.5rem] max-w-[14rem] px-2.5 py-2 shrink-0"
              >
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 truncate">
                    {label}
                  </span>
                  {voiceUrl ? (
                    <VoiceRemarkPlaybackButton
                      url={voiceUrl}
                      title={`Listen to ${label} remark`}
                      size="icon"
                    />
                  ) : null}
                </div>
                <p
                  className={`text-xs leading-snug text-gray-900 line-clamp-2 ${
                    textKey === "final_remarks" ? "font-medium" : ""
                  }`}
                  title={text || (voiceUrl ? "Voice remark" : "")}
                >
                  {text || (voiceUrl ? "Voice only" : "—")}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
