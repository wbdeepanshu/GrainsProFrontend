import { useState } from "react";
import Tesseract from "tesseract.js";

import WebcamCapture from "./WebcamCapture";
import UploadImage from "./UploadImage";
import { cropPlateRegion, preprocessPlateForOcr } from "@/utils/imageUtils";
import { extractIndianVehicleNumber } from "@/utils/regexUtils";
import "./plate-reader.css";

export default function PlateReader() {
  const [imageSrc, setImageSrc] = useState("");
  const [croppedPlateSrc, setCroppedPlateSrc] = useState("");
  const [detectedVehicleNumber, setDetectedVehicleNumber] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const runPlateOcr = async (dataUrl) => {
    try {
      setErrorMessage("");
      setDetectedVehicleNumber("");
      setImageSrc(dataUrl);
      setOcrLoading(true);
      setOcrProgress(0);

      // 1) Detect and crop plate region first (no full-image OCR).
      const { croppedDataUrl } = await cropPlateRegion(dataUrl);
      setCroppedPlateSrc(croppedDataUrl);

      // 2) Preprocess cropped plate before OCR.
      const preprocessed = await preprocessPlateForOcr(croppedDataUrl);

      // 3) OCR only on cropped & preprocessed plate.
      const result = await Tesseract.recognize(preprocessed, "eng", {
        logger: (m) => {
          if (m?.status === "recognizing text" && Number.isFinite(m.progress)) {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      // 4) Extract only valid Indian plate text.
      const vehicleNumber = extractIndianVehicleNumber(result?.data?.text || "");
      setDetectedVehicleNumber(vehicleNumber);

      console.log("Detected Vehicle Number:", vehicleNumber || "NOT_FOUND");

      if (!vehicleNumber) {
        setErrorMessage("No valid Indian vehicle number plate detected.");
      }
    } catch (error) {
      console.error("Plate OCR error:", error);
      setErrorMessage("Failed to process image. Please retry.");
    } finally {
      setOcrLoading(false);
    }
  };

  return (
    <div className="plate-reader-root">
      <h2 className="plate-title">Indian Vehicle Plate Reader</h2>
      <p className="plate-subtitle">
        Upload or capture image. OCR runs only on detected plate region.
      </p>

      <div className="plate-grid">
        <div className="plate-card">
          <h3 className="plate-card-title">Input</h3>
          <UploadImage onImageSelected={runPlateOcr} disabled={ocrLoading} />
          <WebcamCapture onCapture={runPlateOcr} disabled={ocrLoading} />
          {ocrLoading ? (
            <div className="plate-progress-wrap">
              <div className="plate-progress-text">Processing OCR... {ocrProgress}%</div>
              <div className="plate-progress-bar">
                <div className="plate-progress-fill" style={{ width: `${ocrProgress}%` }} />
              </div>
            </div>
          ) : null}
          {errorMessage ? <div className="plate-error">{errorMessage}</div> : null}
        </div>

        <div className="plate-card">
          <h3 className="plate-card-title">Preview</h3>
          <div className="plate-preview-grid">
            <div>
              <div className="plate-preview-label">Captured / Uploaded Image</div>
              {imageSrc ? (
                <img src={imageSrc} alt="input" className="plate-preview-image" />
              ) : (
                <div className="plate-preview-empty">No image selected</div>
              )}
            </div>
            <div>
              <div className="plate-preview-label">Detected Plate Region</div>
              {croppedPlateSrc ? (
                <img src={croppedPlateSrc} alt="plate crop" className="plate-preview-image" />
              ) : (
                <div className="plate-preview-empty">No crop available</div>
              )}
            </div>
          </div>
          <div className="plate-result-wrap">
            <div className="plate-preview-label">Detected Vehicle Number</div>
            <div className="plate-result">{detectedVehicleNumber || "NOT_FOUND"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
