import { memo, useState } from "react";
import { areChatMessageListItemsEqual } from "../../utils/chatMessageEquality";
import { X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ChatMessageListItem } from "../../types/chats.types";
import { useChatImageDisplay } from "../../hooks/useChatImageDisplay";
import { getChatMessageBubbleClassName } from "../../utils/chatMessageBubbleStyles";

export interface ChatImageMessageProps {
  message: ChatMessageListItem;
  isOutgoing: boolean;
  className?: string;
}

function chatImageMessagePropsAreEqual(
  prev: ChatImageMessageProps,
  next: ChatImageMessageProps,
): boolean {
  return (
    prev.isOutgoing === next.isOutgoing &&
    prev.className === next.className &&
    areChatMessageListItemsEqual(prev.message, next.message)
  );
}

export const ChatImageMessage = memo(function ChatImageMessage({
  message,
  isOutgoing,
  className,
}: ChatImageMessageProps) {
  const { urls, caption, isLoading, hasError, pathCount } = useChatImageDisplay(message);
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const isPending = message.delivery_status === "PENDING";

  const bubbleClass = getChatMessageBubbleClassName({ isOutgoing, isPending });

  if (pathCount === 0) {
    return (
      <div
        className={cn(bubbleClass, "px-4 py-3 text-sm", className)}
      >
        Imagem indisponível
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className={cn(bubbleClass, "overflow-hidden", className)}
        aria-busy="true"
        aria-label="Carregando imagem"
      >
        <div className="h-48 w-56 max-w-full animate-pulse bg-black/10 sm:h-56 sm:w-64" />
      </div>
    );
  }

  if (hasError || urls.length === 0) {
    return (
      <div
        className={cn(
          bubbleClass,
          "px-4 py-3 text-sm",
          !isOutgoing && "text-muted-foreground",
          className,
        )}
      >
        Não foi possível carregar a imagem
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          bubbleClass,
          "flex flex-col gap-1 overflow-hidden p-1",
          className,
        )}
      >
        <div
          className={cn(
            "grid gap-1",
            urls.length > 1 ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          {urls.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => setExpandedUrl(url)}
              className="block overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-zoom-in"
              aria-label={
                caption
                  ? `Ampliar imagem: ${caption}`
                  : `Ampliar imagem ${index + 1} de ${urls.length}`
              }
            >
              <img
                src={url}
                alt={caption ?? "Imagem enviada no chat"}
                className="max-h-64 w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </button>
          ))}
        </div>
        {caption ? (
          <p className="px-3 pb-2 text-[15px] leading-snug">{caption}</p>
        ) : null}
      </div>

      <Dialog
        open={Boolean(expandedUrl)}
        onOpenChange={(open) => {
          if (!open) setExpandedUrl(null);
        }}
      >
        <DialogContent className="h-screen w-screen max-w-none rounded-none border-0 bg-black p-2 text-white sm:h-auto sm:w-auto sm:max-w-5xl sm:rounded-lg sm:border sm:p-3 [&>button]:hidden">
          <DialogTitle className="sr-only">Imagem ampliada</DialogTitle>
          <div className="relative flex h-full items-center justify-center">
            <DialogClose asChild>
              <button
                type="button"
                className="absolute right-1 top-1 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Fechar imagem ampliada"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </DialogClose>
            {expandedUrl ? (
              <img
                src={expandedUrl}
                alt={caption ?? "Imagem ampliada do chat"}
                className="max-h-[92dvh] w-auto max-w-full rounded-md object-contain sm:max-h-[85vh]"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}, chatImageMessagePropsAreEqual);
