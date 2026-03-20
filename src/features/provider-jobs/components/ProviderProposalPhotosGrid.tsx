import { Image as ImageIcon } from "lucide-react";

interface ProviderProposalPhotosGridProps {
  isLoading: boolean;
  urls: string[];
  fallbackPhotos: string[] | null | undefined;
}

export function ProviderProposalPhotosGrid({
  isLoading,
  urls,
  fallbackPhotos,
}: ProviderProposalPhotosGridProps) {
  if (!isLoading && urls.length === 0) return null;

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <ImageIcon className="h-3.5 w-3.5" aria-hidden />
        Fotos da proposta
      </p>
      {isLoading ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {(fallbackPhotos ?? []).slice(0, 4).map((_, index) => (
            <div key={index} className="aspect-square animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {urls.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="aspect-square overflow-hidden rounded-lg border bg-muted"
            >
              <img
                src={url}
                alt={`Foto da proposta ${index + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
