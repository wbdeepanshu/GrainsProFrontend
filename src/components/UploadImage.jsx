import { useRef } from "react";

export default function UploadImage({ onImageSelected, disabled = false }) {
  const inputRef = useRef(null);

  return (
    <div className="plate-reader-actions">
      <button
        type="button"
        className="plate-btn"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        Upload Image
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="plate-hidden-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = String(ev.target?.result || "");
            if (dataUrl) onImageSelected?.(dataUrl);
          };
          reader.readAsDataURL(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
