import { useEffect, useState } from "react";
import { getProfileImageSignedUrlForPublic } from "../api/profileImagePublic.api";

export function usePublicProfileImageUrl(path: string | null | undefined): {
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
    getProfileImageSignedUrlForPublic(path).then((signedUrl) => {
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
