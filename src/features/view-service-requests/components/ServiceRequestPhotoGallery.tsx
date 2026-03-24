import { useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useServiceRequestPhotoUrls } from "@/features/request-quote";

interface ServiceRequestPhotoGalleryProps {
  photos: string[];
}

export function ServiceRequestPhotoGallery({
  photos,
}: ServiceRequestPhotoGalleryProps) {
  const { urls, isLoading } = useServiceRequestPhotoUrls(photos);
  const [expandedPhotoUrl, setExpandedPhotoUrl] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.slice(0, 6).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (urls.length === 0) return null;

  return (
    <>
      <div
        className="grid grid-cols-3 gap-2 sm:grid-cols-4"
        role="list"
        aria-label="Fotos do pedido"
      >
        {urls.map((url, i) => (
          <div
            key={i}
            className="aspect-square overflow-hidden rounded-lg border bg-muted"
            role="listitem"
          >
            {url ? (
              <button
                type="button"
                onClick={() => setExpandedPhotoUrl(url)}
                className="h-full w-full cursor-zoom-in transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Ampliar foto ${i + 1}`}
              >
                <img
                  src={url}
                  alt={`Foto ${i + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </button>
            ) : (
              <div className="h-full w-full bg-muted" />
            )}
          </div>
        ))}
      </div>

      <Dialog
        open={Boolean(expandedPhotoUrl)}
        onOpenChange={(open) => {
          if (!open) setExpandedPhotoUrl(null);
        }}
      >
        <DialogContent className="h-screen w-screen max-w-none rounded-none border-0 bg-black p-2 text-white sm:h-auto sm:w-auto sm:max-w-5xl sm:rounded-lg sm:border sm:p-3 [&>button]:hidden">
          <DialogTitle className="sr-only">Imagem ampliada</DialogTitle>
          <div className="relative flex h-full items-center justify-center">
            <DialogClose asChild>
              <button
                type="button"
                className="absolute right-1 top-1 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Fechar imagem ampliada"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </DialogClose>
            {expandedPhotoUrl ? (
              <img
                src={expandedPhotoUrl}
                alt="Imagem ampliada do pedido"
                className="max-h-[92dvh] w-auto max-w-full rounded-md object-contain sm:max-h-[85vh]"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
