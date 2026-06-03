import { useEffect, useState } from "react";
import { getProposalPhotoDisplayUrl } from "../api/proposalComposerSupport.api";

export function useProposalPhotoUrls(
  photos: string[] | null | undefined,
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

    void (async () => {
      const resolved = await Promise.all(photos.map((item) => getProposalPhotoDisplayUrl(item)));

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
