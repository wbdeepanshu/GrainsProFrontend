import { useRef, useState } from "react";
import Webcam from "react-webcam";

const videoConstraints = {
  facingMode: "environment",
  width: { ideal: 1280 },
  height: { ideal: 720 },
};

export default function WebcamCapture({ onCapture, disabled = false }) {
  const webcamRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");

  return (
    <div className="plate-webcam-wrap">
      <div className="plate-reader-actions">
        <button
          type="button"
          className="plate-btn"
          disabled={disabled}
          onClick={() => {
            setCameraError("");
            setCameraOpen((prev) => !prev);
          }}
        >
          {cameraOpen ? "Close Camera" : "Open Camera"}
        </button>

        {cameraOpen && (
          <button
            type="button"
            className="plate-btn plate-btn-primary"
            disabled={disabled}
            onClick={() => {
              const screenshot = webcamRef.current?.getScreenshot();
              if (!screenshot) {
                setCameraError("Unable to capture image from webcam.");
                return;
              }
              onCapture?.(screenshot);
            }}
          >
            Capture
          </button>
        )}
      </div>

      {cameraError ? <p className="plate-error">{cameraError}</p> : null}

      {cameraOpen ? (
        <div className="plate-webcam-frame">
          <Webcam
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            screenshotQuality={1}
            videoConstraints={videoConstraints}
            onUserMediaError={(err) => {
              console.error("Camera permission or device error:", err);
              setCameraError("Camera access denied or unavailable.");
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
