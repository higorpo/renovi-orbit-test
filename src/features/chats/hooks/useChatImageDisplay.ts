import { useEffect, useMemo, useState } from "react";
import { resolveChatImageDisplayUrls } from "../api/chatMedia.api";
import type { ChatMessageListItem } from "../types/chats.types";
import {
  buildChatImageDisplayCacheKey,
  getCachedChatImageDisplayUrls,
  setCachedChatImageDisplayUrls,
} from "../utils/chatImageSignedUrlCache";
import {
  getChatImageCaption,
  getChatImagePathsFromPayload,
  getLocalPreviewUrlsFromPayload,
} from "../utils/chatMessageImagePaths";

export function useChatImageDisplay(message: ChatMessageListItem) {
  const localPreviewUrls = useMemo(
    () => getLocalPreviewUrlsFromPayload(message.payload),
    [message.payload],
  );
  const paths = useMemo(
    () => getChatImagePathsFromPayload(message.payload),
    [message.payload],
  );
  const pathsKey = useMemo(() => paths.join("\0"), [paths]);
  const caption = useMemo(() => getChatImageCaption(message.payload), [message.payload]);
  const cacheKey = useMemo(
    () => buildChatImageDisplayCacheKey(message.id, paths),
    [message.id, pathsKey],
  );

  const cachedUrls = useMemo(() => getCachedChatImageDisplayUrls(cacheKey), [cacheKey]);

  const [urls, setUrls] = useState<string[]>(() => localPreviewUrls);
  const [isLoading, setIsLoading] = useState(
    () => localPreviewUrls.length === 0 && paths.length > 0 && !cachedUrls,
  );
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (localPreviewUrls.length > 0) {
      setUrls(localPreviewUrls);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    if (paths.length === 0) {
      setUrls([]);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    const cached = getCachedChatImageDisplayUrls(cacheKey);
    if (cached) {
      setUrls(cached);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    let cancelled = false;
    setUrls([]);
    setIsLoading(true);
    setHasError(false);

    void resolveChatImageDisplayUrls({
      messageId: message.id,
      paths,
    }).then((result) => {
      if (cancelled) return;
      if (result.error || result.urls.length === 0) {
        setHasError(true);
        setUrls([]);
      } else {
        setCachedChatImageDisplayUrls(cacheKey, result.urls);
        setUrls(result.urls);
      }
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, localPreviewUrls, message.id, paths, pathsKey]);

  const pathCount = localPreviewUrls.length > 0 ? localPreviewUrls.length : paths.length;

  return { urls, caption, isLoading, hasError, pathCount };
}
