import { useEffect, useRef, useState } from "react";
import { Volume2, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Play / pause a single voice-remarks URL (sales order list pattern).
 */
export default function VoiceRemarkPlaybackButton({ url, title = "Listen to voice recording", size = "default" }) {
  const trimmed = (url || "").trim();
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(false);
  }, [trimmed]);

  if (!trimmed) return null;

  const togglePlayback = () => {
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(trimmed);
      audio.onended = () => setPlaying(false);
      audio.onerror = () => setPlaying(false);
      audioRef.current = audio;
    } else if (audio.src !== trimmed) {
      audio.src = trimmed;
    }

    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  };

  const isIconOnly = size === "icon";

  return (
    <Button
      type="button"
      size={isIconOnly ? "icon" : "sm"}
      variant="outline"
      className={
        isIconOnly
          ? `h-9 w-9 shrink-0 rounded-full border-2 ${
              playing
                ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600"
                : "bg-blue-600 hover:bg-blue-700 text-white border-blue-700"
            }`
          : "gap-1.5"
      }
      onClick={togglePlayback}
      title={playing ? "Pause voice recording" : title}
      aria-label={playing ? "Pause voice recording" : title}
    >
      {playing ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      {!isIconOnly && <span>{playing ? "Pause" : "Listen"}</span>}
    </Button>
  );
}
