import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveChatAudioSignedUrl } from "../api/chatMedia.api";
import type { ChatMessageListItem } from "../types/chats.types";
import { CHAT_AUDIO_PLAYBACK_SPEEDS } from "../utils/chatAudioConstants";
import {
  buildChatAudioDisplayCacheKey,
  getCachedChatAudioDisplayUrl,
  setCachedChatAudioDisplayUrl,
} from "../utils/chatAudioSignedUrlCache";
import {
  claimChatAudioPlayback,
  registerChatAudioPlaybackOwner,
  releaseChatAudioPlayback,
} from "../utils/chatAudioPlaybackCoordinator";
import { getChatAudioDurationMs, getChatAudioPathFromPayload } from "../utils/chatMessageAudioPaths";

export function useChatAudioPlayback(message: ChatMessageListItem) {
  const ownerId = message.id;
  const path = useMemo(() => getChatAudioPathFromPayload(message.payload), [message.payload]);
  const totalDurationMs = useMemo(
    () => getChatAudioDurationMs(message.payload),
    [message.payload],
  );
  const cacheKey = useMemo(
    () => (path ? buildChatAudioDisplayCacheKey(message.id, path) : ""),
    [message.id, path],
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(() =>
    cacheKey ? getCachedChatAudioDisplayUrl(cacheKey) : null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(0);

  const playbackRate = CHAT_AUDIO_PLAYBACK_SPEEDS[speedIndex] ?? 1;

  const ensureAudioElement = useCallback((url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(url);
    audio.preload = "none";
    audio.playbackRate = playbackRate;
    audio.addEventListener("timeupdate", () => {
      setCurrentTimeMs(Math.round(audio.currentTime * 1000));
    });
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setCurrentTimeMs(totalDurationMs);
      releaseChatAudioPlayback(ownerId);
    });
    audioRef.current = audio;
    return audio;
  }, [ownerId, playbackRate, totalDurationMs]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    const stop = () => {
      audioRef.current?.pause();
      setIsPlaying(false);
    };

    return registerChatAudioPlaybackOwner(ownerId, stop);
  }, [ownerId]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const loadAudioUrl = useCallback(async (): Promise<string | null> => {
    if (!path) return null;

    const cached = getCachedChatAudioDisplayUrl(cacheKey);
    if (cached) {
      setAudioUrl(cached);
      return cached;
    }

    setIsLoading(true);
    setHasError(false);

    try {
      const result = await resolveChatAudioSignedUrl({
        messageId: message.id.startsWith("optimistic:") ? undefined : message.id,
        path,
      });

      if (result.error || !result.url) {
        setHasError(true);
        return null;
      }

      setCachedChatAudioDisplayUrl(cacheKey, result.url);
      setAudioUrl(result.url);
      return result.url;
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, message.id, path]);

  const togglePlay = useCallback(async () => {
    let url = audioUrl;
    if (!url) {
      url = await loadAudioUrl();
      if (!url) return;
    }

    let audio = audioRef.current;
    if (!audio || audio.src !== url) {
      audio = ensureAudioElement(url);
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      releaseChatAudioPlayback(ownerId);
      return;
    }

    try {
      claimChatAudioPlayback(ownerId);
      await audio.play();
      setIsPlaying(true);
    } catch {
      releaseChatAudioPlayback(ownerId);
      setHasError(true);
      setIsPlaying(false);
    }
  }, [audioUrl, ensureAudioElement, isPlaying, loadAudioUrl, ownerId]);

  const seekToMs = useCallback(
    (nextMs: number) => {
      const clamped = Math.max(0, Math.min(nextMs, totalDurationMs || nextMs));
      setCurrentTimeMs(clamped);
      if (audioRef.current) {
        audioRef.current.currentTime = clamped / 1000;
      }
    },
    [totalDurationMs],
  );

  const cycleSpeed = useCallback(() => {
    setSpeedIndex((index) => (index + 1) % CHAT_AUDIO_PLAYBACK_SPEEDS.length);
  }, []);

  return {
    totalDurationMs,
    currentTimeMs,
    isLoading,
    isPlaying,
    hasError,
    playbackRate,
    amplitudeReady: Boolean(path),
    togglePlay,
    seekToMs,
    cycleSpeed,
  };
}
