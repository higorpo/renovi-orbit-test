import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatComposerAttachmentPreviewProps {
  previewUrls: string[];
  onRemove: (index: number) => void;
  className?: string;
}

export function ChatComposerAttachmentPreview({
  previewUrls,
  onRemove,
  className,
}: ChatComposerAttachmentPreviewProps) {
  if (previewUrls.length === 0) return null;

  return (
    <div
      className={cn(
        "mb-2 flex gap-2 overflow-x-auto pb-1 touch-pan-x overscroll-x-contain",
        className,
      )}
    >
      {previewUrls.map((previewUrl, index) => (
        <div
          key={previewUrl}
          className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border/80 bg-muted"
        >
          <img
            src={previewUrl}
            alt={`Anexo ${index + 1}`}
            className="h-full w-full object-cover"
          />
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/95 text-foreground shadow-sm transition-colors hover:bg-muted"
            aria-label={`Remover imagem ${index + 1}`}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
