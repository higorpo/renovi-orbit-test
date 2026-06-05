import { Loader2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatAudioPlayback } from "../../hooks/useChatAudioPlayback";
import type { ChatMessageListItem } from "../../types/chats.types";
import type { ChatMessageGroupPosition } from "../../utils/groupChatTimeline";
import {
  getChatAudioErrorClassName,
  getChatAudioPlayButtonClassName,
  getChatAudioRangeClassName,
  getChatAudioRangeProgressStyle,
  getChatAudioSpeedButtonClassName,
  getChatAudioTimeClassName,
} from "../../utils/chatAudioMessageStyles";
import { getChatMessageBubbleClassName } from "../../utils/chatMessageBubbleStyles";
import { formatAudioDuration } from "../../utils/formatAudioDuration";

export interface ChatAudioMessageProps {
  message: ChatMessageListItem;
  isOutgoing: boolean;
  groupPosition?: ChatMessageGroupPosition;
  className?: string;
}

export function ChatAudioMessage({
  message,
  isOutgoing,
  groupPosition = "single",
  className,
}: ChatAudioMessageProps) {
  const isPending = message.delivery_status === "PENDING";
  const playback = useChatAudioPlayback(message);
  const rangeProgressPercent =
    playback.totalDurationMs > 0
      ? (playback.currentTimeMs / playback.totalDurationMs) * 100
      : 0;

  return (
    <div
      className={cn(
        getChatMessageBubbleClassName({ isOutgoing, isPending, groupPosition }),
        "min-w-[min(100%,16rem)] max-w-[min(100%,20rem)] px-3 py-3",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={getChatAudioPlayButtonClassName(isOutgoing)}
          disabled={playback.isLoading || !playback.amplitudeReady}
          aria-label={playback.isPlaying ? "Pausar áudio" : "Reproduzir áudio"}
          onClick={() => void playback.togglePlay()}
        >
          {playback.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : playback.isPlaying ? (
            <Pause className="h-4 w-4" aria-hidden />
          ) : (
            <Play className="h-4 w-4" aria-hidden />
          )}
        </Button>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="overflow-hidden py-1">
            <input
              type="range"
              min={0}
              max={playback.totalDurationMs || 1}
              value={playback.currentTimeMs}
              disabled={!playback.amplitudeReady || playback.isLoading}
              style={getChatAudioRangeProgressStyle(rangeProgressPercent)}
              className={getChatAudioRangeClassName(isOutgoing)}
              aria-label="Posição do áudio"
              aria-valuemin={0}
              aria-valuemax={playback.totalDurationMs || 1}
              aria-valuenow={playback.currentTimeMs}
              aria-valuetext={`${formatAudioDuration(playback.currentTimeMs)} de ${formatAudioDuration(playback.totalDurationMs)}`}
              onChange={(event) => playback.seekToMs(Number(event.target.value))}
            />
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            <span className={getChatAudioTimeClassName(isOutgoing)}>
              {formatAudioDuration(playback.currentTimeMs)} /{" "}
              {formatAudioDuration(playback.totalDurationMs)}
            </span>
            <button
              type="button"
              className={getChatAudioSpeedButtonClassName(isOutgoing)}
              onClick={playback.cycleSpeed}
            >
              {playback.playbackRate}x
            </button>
          </div>
        </div>
      </div>

      {playback.hasError ? (
        <p className={getChatAudioErrorClassName(isOutgoing)}>
          Não foi possível carregar o áudio.
        </p>
      ) : null}
    </div>
  );
}
