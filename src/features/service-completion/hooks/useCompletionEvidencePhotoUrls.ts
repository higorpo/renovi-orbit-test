import { useEffect, useState } from "react";
import { getCompletionEvidenceDisplayUrl } from "../api/evidencePhotoStorage.api";

/**
 * Resolves completion-evidence storage paths to signed display URLs.
 * Preserves path order; failed paths become empty strings (filtered by consumers).
 */
export function useCompletionEvidencePhotoUrls(
  paths: string[] | null | undefined,
): { urls: string[]; isLoading: boolean } {
  const [urls, setUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(paths?.length));

  const pathsKey = paths?.join("\0") ?? "";

  useEffect(() => {
    if (!paths || paths.length === 0) {
      setUrls([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      const resolved = await Promise.all(
        paths.map(async (path) => {
          if (cancelled) return "";
          return getCompletionEvidenceDisplayUrl(path);
        }),
      );
      if (!cancelled) {
        setUrls(resolved);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathsKey]);

  return { urls, isLoading };
}
