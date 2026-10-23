import { useEffect, useRef, useState } from "react";
import { useToast } from "./use-toast";

/**
 * Record voice, upload via vouchersApp, expose URL for API `voice_remarks`.
 * @param {(blob: Blob) => Promise<string>} uploadFn
 */
export function useVoiceRemarks(uploadFn) {
  const { toast } = useToast();
  const [voiceRemarksUrl, setVoiceRemarksUrl] = useState("");
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);

  const mediaRecorderRef = useRef(null);
  const voiceChunksRef = useRef([]);
  const voiceStreamRef = useRef(null);
  const voiceRemarksUrlRef = useRef("");
  const voiceUploadPromiseRef = useRef(null);

  const setVoiceRemarks = (url) => {
    const value = url || "";
    voiceRemarksUrlRef.current = value;
    setVoiceRemarksUrl(value);
  };

  const clearVoiceRemarks = () => {
    setVoiceRemarks("");
    voiceUploadPromiseRef.current = null;
  };

  const stopVoiceStream = () => {
    if (voiceStreamRef.current) {
      voiceStreamRef.current.getTracks().forEach((track) => track.stop());
      voiceStreamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      stopVoiceStream();
    };
  }, []);

  const getVoiceUrlForSubmit = () => (voiceRemarksUrlRef.current || voiceRemarksUrl || "").trim();

  const startBackgroundVoiceUpload = (blob) => {
    setIsUploadingVoice(true);
    const uploadPromise = uploadFn(blob)
      .then((url) => {
        setVoiceRemarks(url);
        toast({
          title: "Voice note saved",
          description: "It will be sent when you save.",
        });
        return url;
      })
      .catch((err) => {
        setVoiceRemarks("");
        toast({
          title: "Upload failed",
          description: err?.message || "Could not upload voice note.",
          variant: "destructive",
        });
        throw err;
      })
      .finally(() => {
        setIsUploadingVoice(false);
        if (voiceUploadPromiseRef.current === uploadPromise) {
          voiceUploadPromiseRef.current = null;
        }
      });

    voiceUploadPromiseRef.current = uploadPromise;
    return uploadPromise;
  };

  const waitForVoiceUploadIfNeeded = async () => {
    if (isRecordingVoice) {
      toast({
        title: "Recording in progress",
        description: "Stop the recording before saving.",
        variant: "destructive",
      });
      return false;
    }
    if (voiceUploadPromiseRef.current) {
      try {
        await voiceUploadPromiseRef.current;
      } catch {
        return false;
      }
    }
    return true;
  };

  const handleVoiceMicClick = async () => {
    if (isUploadingVoice) return;

    if (isRecordingVoice) {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === "recording") {
        recorder.stop();
      }
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: "Microphone unavailable",
        description: "Your browser does not support voice recording.",
        variant: "destructive",
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      voiceChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          voiceChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        setIsRecordingVoice(false);
        stopVoiceStream();
        const blobType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(voiceChunksRef.current, { type: blobType });
        voiceChunksRef.current = [];
        mediaRecorderRef.current = null;

        if (!blob.size) {
          toast({
            title: "No recording",
            description: "Record again and speak before stopping.",
            variant: "destructive",
          });
          return;
        }

        startBackgroundVoiceUpload(blob);
      };

      recorder.onerror = () => {
        setIsRecordingVoice(false);
        stopVoiceStream();
        toast({
          title: "Recording error",
          description: "Could not complete voice recording.",
          variant: "destructive",
        });
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingVoice(true);
    } catch (err) {
      stopVoiceStream();
      toast({
        title: "Microphone access denied",
        description: err?.message || "Allow microphone access to record a voice note.",
        variant: "destructive",
      });
    }
  };

  return {
    voiceRemarksUrl,
    isRecordingVoice,
    isUploadingVoice,
    hasVoiceRemarks: Boolean(getVoiceUrlForSubmit()),
    handleVoiceMicClick,
    waitForVoiceUploadIfNeeded,
    getVoiceUrlForSubmit,
    clearVoiceRemarks,
  };
}
