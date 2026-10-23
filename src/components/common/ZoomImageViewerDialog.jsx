import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ImageIcon, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogPortal,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Lightbox-style image viewer with zoom, pan, and wheel zoom (inward-details pattern).
 */
export default function ZoomImageViewerDialog({
  open,
  onOpenChange,
  imageUrl = "",
  title = "Image preview",
  remarks = "",
  className = "",
}) {
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!open) {
      setImageZoom(1);
      setImagePosition({ x: 0, y: 0 });
      setIsDragging(false);
    }
  }, [open, imageUrl]);

  const handleOpenChange = (nextOpen) => {
    onOpenChange?.(nextOpen);
    if (!nextOpen) {
      setImageZoom(1);
      setImagePosition({ x: 0, y: 0 });
      setIsDragging(false);
    }
  };

  if (!imageUrl) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="z-[60]" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-[60] translate-x-[-50%] translate-y-[-50%]",
            "max-w-5xl w-[95vw] max-h-[92vh] p-0 gap-0 overflow-hidden flex flex-col",
            "border-0 bg-background shadow-2xl duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "sm:rounded-lg",
            className
          )}
        >
          <DialogHeader className="shrink-0 bg-black text-white px-6 py-4 pr-14 space-y-1 rounded-t-lg border-0 text-left">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-white">
              <ImageIcon className="h-5 w-5 shrink-0" />
              <span className="truncate">{title}</span>
            </DialogTitle>
            {remarks ? (
              <p className="text-sm text-white/80 leading-snug">{remarks}</p>
            ) : null}
          </DialogHeader>

          <div
            className="relative flex-1 min-h-[50vh] max-h-[65vh] bg-neutral-950 flex items-center justify-center overflow-hidden cursor-move"
            onMouseDown={(e) => {
              if (e.button === 0) {
                setIsDragging(true);
                setDragStart({
                  x: e.clientX - imagePosition.x,
                  y: e.clientY - imagePosition.y,
                });
              }
            }}
            onMouseMove={(e) => {
              if (!isDragging) return;
              setImagePosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
              });
            }}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
            onWheel={(e) => {
              e.preventDefault();
              const delta = e.deltaY > 0 ? -0.1 : 0.1;
              setImageZoom((prev) => Math.max(0.5, Math.min(3, prev + delta)));
            }}
          >
            <div
              className="relative inline-block"
              style={{
                transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageZoom})`,
                transformOrigin: "center center",
                transition: isDragging ? "none" : "transform 0.1s ease-out",
                cursor: isDragging ? "grabbing" : "grab",
              }}
            >
              <img
                src={imageUrl}
                alt={title}
                className="max-w-[min(90vw,48rem)] max-h-[min(60vh,36rem)] w-auto h-auto object-contain select-none"
                draggable={false}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          </div>

          <div className="shrink-0 px-4 sm:px-6 py-3 border-t bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-b-lg">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setImageZoom((prev) => Math.max(0.5, prev - 0.25))}
                disabled={imageZoom <= 0.5}
              >
                <Minus className="h-4 w-4 mr-1" />
                Zoom Out
              </Button>
              <span className="text-sm font-medium text-gray-700 tabular-nums min-w-[3rem] text-center">
                {Math.round(imageZoom * 100)}%
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setImageZoom((prev) => Math.min(3, prev + 0.25))}
                disabled={imageZoom >= 3}
              >
                <Plus className="h-4 w-4 mr-1" />
                Zoom In
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setImageZoom(1);
                  setImagePosition({ x: 0, y: 0 });
                }}
              >
                Reset
              </Button>
              <span className="hidden md:inline text-xs text-muted-foreground ml-1">
                Scroll to zoom · Drag to pan
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => window.open(imageUrl, "_blank", "noopener,noreferrer")}
            >
              Open in New Tab
            </Button>
          </div>

          <DialogPrimitive.Close className="absolute right-4 top-4 z-20 rounded-sm p-1 text-white opacity-100 transition-opacity hover:bg-white/20 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/50">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
