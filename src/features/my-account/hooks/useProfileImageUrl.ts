import { useEffect, useState } from "react";
import { getProfileImageSignedUrl } from "../api/profileImageStorage.api";

/**
 * Resolves profile_image_path to a signed URL for display.
 * Returns empty string while loading or on error.
 */
export function useProfileImageUrl(path: string | null | undefined): {
  url: string;
  isLoading: boolean;
} {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(!!path);

  useEffect(() => {
    if (!path) {
      setUrl("");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getProfileImageSignedUrl(path).then((signedUrl) => {
      if (!cancelled) {
        setUrl(signedUrl);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return { url, isLoading };
}
