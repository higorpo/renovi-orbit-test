import { useEffect, useMemo, useState } from "react";
import { getPortfolioImageSignedUrl } from "../api/profileImagePublic.api";
import type { ProviderPortfolioItemPublic } from "../types/providerProfilePublic.types";

export type PortfolioImageMap = Record<string, string[]>;

/**
 * Loads signed URLs for all images across all portfolio items.
 * Returns a map of itemId -> signedUrl[].
 */
export function usePortfolioImages(items: ProviderPortfolioItemPublic[]): {
  imageMap: PortfolioImageMap;
  isLoading: boolean;
} {
  const [imageMap, setImageMap] = useState<PortfolioImageMap>({});
  const [isLoading, setIsLoading] = useState(false);

  const stableKey = useMemo(
    () => items.map((i) => `${i.id}:${i.image_paths.join(",")}`).join("|"),
    [items],
  );

  useEffect(() => {
    if (items.length === 0) {
      setImageMap({});
      setIsLoading(false);
      return;
    }

    const allPaths: { itemId: string; path: string }[] = [];
    for (const item of items) {
      for (const path of item.image_paths) {
        if (path) allPaths.push({ itemId: item.id, path });
      }
    }

    if (allPaths.length === 0) {
      setImageMap({});
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    Promise.all(allPaths.map(({ path }) => getPortfolioImageSignedUrl(path))).then(
      (urls) => {
        if (cancelled) return;
        const map: PortfolioImageMap = {};
        for (let i = 0; i < allPaths.length; i++) {
          const { itemId } = allPaths[i];
          if (!map[itemId]) map[itemId] = [];
          if (urls[i]) map[itemId].push(urls[i]);
        }
        setImageMap(map);
        setIsLoading(false);
      },
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableKey]);

  return { imageMap, isLoading };
}
