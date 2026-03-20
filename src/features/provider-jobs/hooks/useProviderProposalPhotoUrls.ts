import { useEffect, useState } from "react";
import { getProviderProposalPhotoDisplayUrl } from "../api/providerProposals.api";

export function useProviderProposalPhotoUrls(
  photos: string[] | null,
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
        photos.map((item) => getProviderProposalPhotoDisplayUrl(item)),
      );

      if (!cancelled) {
        setUrls(resolved.filter(Boolean));
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [photos]);

  return { urls, isLoading };
}
