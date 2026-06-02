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
} from "../utils/chatMessageImagePaths";

export function useChatImageDisplay(message: ChatMessageListItem) {
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

  const [urls, setUrls] = useState<string[]>(() => cachedUrls ?? []);
  const [isLoading, setIsLoading] = useState(() => paths.length > 0 && !cachedUrls);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
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
  }, [cacheKey, message.id, paths, pathsKey]);

  return { urls, caption, isLoading, hasError, pathCount: paths.length };
}
