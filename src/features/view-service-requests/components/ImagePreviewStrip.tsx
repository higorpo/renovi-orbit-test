import { useServiceRequestPhotoUrls } from "@/features/request-quote";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 3;
const THUMB_SIZE = "h-12 w-12 sm:h-14 sm:w-14";

export interface ImagePreviewStripProps {
  photoPaths: string[];
  className?: string;
}

export function ImagePreviewStrip({ photoPaths, className }: ImagePreviewStripProps) {
  const { urls, isLoading } = useServiceRequestPhotoUrls(photoPaths);

  if (!photoPaths.length) return null;

  const visible = urls.slice(0, MAX_VISIBLE);
  const extra = urls.length - MAX_VISIBLE;

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role="list"
      aria-label={`${urls.length} foto(s) anexada(s)`}
    >
      {isLoading ? (
        <div className={cn("rounded-md bg-muted animate-pulse", THUMB_SIZE)} />
      ) : (
        <>
          {visible.map((url, i) => (
            <div
              key={i}
              className={cn(
                "flex-shrink-0 overflow-hidden rounded-md border border-border bg-muted object-cover",
                THUMB_SIZE
              )}
              role="listitem"
            >
              {url ? (
                <img
                  src={url}
                  alt=""
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
          {extra > 0 && (
            <span
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs font-medium text-muted-foreground sm:h-14 sm:w-14"
              aria-label={`Mais ${extra} foto(s)`}
            >
              +{extra}
            </span>
          )}
        </>
      )}
    </div>
  );
}
