import { useEffect, useState } from "react";
import { getServiceRequestPhotoDisplayUrl } from "../api/serviceRequestPhotoStorage.api";
import { isStoragePath } from "../utils/serviceRequestPhotos";

/**
 * Resolves service_requests.photos (paths or legacy URLs) to display URLs.
 * Paths are fetched as signed URLs from the private bucket; legacy full URLs are returned as-is.
 */
export function useServiceRequestPhotoUrls(
  photos: string[] | null
): { urls: string[]; isLoading: boolean } {
  const [urls, setUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!photos || photos.length === 0) {
      setUrls([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      const resolved = await Promise.all(
        photos.map(async (item) => {
          if (cancelled) return "";
          if (!isStoragePath(item)) return item;
          return getServiceRequestPhotoDisplayUrl(item);
        })
      );
      if (!cancelled) {
        setUrls(resolved.filter(Boolean));
      }
      if (!cancelled) {
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [photos?.join(",") ?? ""]);

  return { urls, isLoading };
}
