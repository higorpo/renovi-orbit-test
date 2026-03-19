import { useServiceRequestPhotoUrls } from "@/features/request-quote";

export function JobDetailPhotoGallery({ photos }: { photos: string[] }) {
  const { urls, isLoading } = useServiceRequestPhotoUrls(photos);

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.slice(0, 6).map((_, i) => (
          <div
            key={i}
            className="aspect-square animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    );
  }

  if (urls.length === 0) return null;

  return (
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
            <img
              src={url}
              alt={`Foto ${i + 1}`}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="h-full w-full bg-muted" />
          )}
        </div>
      ))}
    </div>
  );
}
