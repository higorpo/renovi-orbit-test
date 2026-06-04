import { useEffect, useMemo, useState } from "react";
import { resolveChatImageDisplayUrls } from "../api/chatMedia.api";
import type { ChatMessageListItem } from "../types/chats.types";
import {
  clearImagePreviewHoldover,
  getImagePreviewHoldover,
} from "../utils/chatImagePreviewHoldover";
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
import { preloadImageUrls } from "../utils/preloadImageUrls";

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
  const previewHoldover = useMemo(
    () => getImagePreviewHoldover(message.idempotency_key),
    [message.idempotency_key],
  );

  const cachedUrls = useMemo(() => getCachedChatImageDisplayUrls(cacheKey), [cacheKey]);

  const initialDisplayUrls =
    localPreviewUrls.length > 0
      ? localPreviewUrls
      : cachedUrls ?? previewHoldover ?? [];

  const [urls, setUrls] = useState<string[]>(() => initialDisplayUrls);
  const [isLoading, setIsLoading] = useState(
    () => initialDisplayUrls.length === 0 && paths.length > 0,
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
      clearImagePreviewHoldover(message.idempotency_key);
      return;
    }

    const holdover = getImagePreviewHoldover(message.idempotency_key);
    if (holdover) {
      setUrls(holdover);
      setIsLoading(false);
      setHasError(false);
    } else {
      setUrls([]);
      setIsLoading(true);
      setHasError(false);
    }

    let cancelled = false;

    void resolveChatImageDisplayUrls({
      messageId: message.id,
      paths,
    }).then(async (result) => {
      if (cancelled) return;

      if (result.error || result.urls.length === 0) {
        if (!holdover) {
          setHasError(true);
          setUrls([]);
        }
        setIsLoading(false);
        return;
      }

      await preloadImageUrls(result.urls);
      if (cancelled) return;

      setCachedChatImageDisplayUrls(cacheKey, result.urls);
      setUrls(result.urls);
      setHasError(false);
      setIsLoading(false);
      clearImagePreviewHoldover(message.idempotency_key);
    });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, localPreviewUrls, message.id, message.idempotency_key, paths, pathsKey]);

  const pathCount =
    localPreviewUrls.length > 0
      ? localPreviewUrls.length
      : paths.length > 0
        ? paths.length
        : urls.length;

  return { urls, caption, isLoading, hasError, pathCount };
}
