/**
 * Thumbnail grid + fullscreen lightbox for completion evidence photos.
 * Mirrors ServicePhotoGallery / ChatImageMessage lightbox chrome.
 *
 * Uses elevated z-index so the lightbox stacks above the host sheet/dialog
 * (nested Radix dialogs both default to z-50 and otherwise paint black-on-black).
 */

import { useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogClose, DialogTitle } from "@/components/ui/dialog";
import { ShellDialogContent } from "@/components/ui/shell-dialog";
import {
  mediaLightboxOverlayClassName,
  mediaLightboxShellDialogClassName,
} from "@/components/ui/shell-dialog-classes";
import { cn } from "@/lib/utils";
import { useCompletionEvidencePhotoUrls } from "../hooks/useCompletionEvidencePhotoUrls";

export type CompletionEvidenceGalleryProps = {
  paths: string[];
  readOnly?: boolean;
  onRemovePath?: (path: string) => void;
  className?: string;
};

export function CompletionEvidenceGallery({
  paths,
  readOnly = false,
  onRemovePath,
  className,
}: CompletionEvidenceGalleryProps) {
  const { urls, isLoading } = useCompletionEvidencePhotoUrls(paths);
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);

  if (paths.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">Nenhuma foto anexada.</p>
    );
  }

  if (isLoading) {
    return (
      <div
        className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4", className)}
        aria-busy="true"
        aria-label="Carregando evidências"
      >
        {paths.map((path) => (
          <div
            key={path}
            className="aspect-square animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <ul
        className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4", className)}
        aria-label="Evidências fotográficas"
      >
        {paths.map((path, index) => {
          const url = urls[index] ?? "";
          return (
            <li
              key={path}
              className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
            >
              {url ? (
                <button
                  type="button"
                  onClick={() => setExpandedUrl(url)}
                  className="h-full w-full cursor-zoom-in transition-opacity duration-150 ease-out hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]"
                  aria-label={`Ampliar evidência ${index + 1}`}
                >
                  <img
                    src={url}
                    alt={`Evidência ${index + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </button>
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] text-muted-foreground"
                  title={path}
                >
                  Indisponível
                </div>
              )}
              {!readOnly && onRemovePath ? (
                <button
                  type="button"
                  aria-label={`Remover evidência ${index + 1}`}
                  className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors duration-150 ease-out hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemovePath(path);
                  }}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <Dialog
        open={Boolean(expandedUrl)}
        onOpenChange={(open) => {
          if (!open) setExpandedUrl(null);
        }}
      >
        <ShellDialogContent
          size="xl"
          overlayClassName={mediaLightboxOverlayClassName}
          className={cn(
            mediaLightboxShellDialogClassName,
            // Fill the viewport reliably when nested under another dialog/sheet.
            "flex items-center justify-center",
          )}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogTitle className="sr-only">Evidência ampliada</DialogTitle>
          <div className="relative flex max-h-full max-w-full items-center justify-center">
            <DialogClose asChild>
              <button
                type="button"
                className="absolute -right-1 -top-1 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors duration-150 ease-out hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] sm:right-0 sm:top-0"
                aria-label="Fechar imagem ampliada"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </DialogClose>
            {expandedUrl ? (
              <img
                src={expandedUrl}
                alt="Evidência ampliada"
                className="max-h-[min(92dvh,100%)] w-auto max-w-full rounded-md object-contain sm:max-h-[85vh]"
              />
            ) : null}
          </div>
        </ShellDialogContent>
      </Dialog>
    </>
  );
}
