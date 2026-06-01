import { ImageIcon, SendHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useVirtualKeyboardVisible } from "@/hooks/useVirtualKeyboardVisible";
import { cn } from "@/lib/utils";
import type { ChatComposerState } from "../../utils/composerState";
import { useChatMobileViewportSchedule } from "./ChatMobileViewportContext";

export interface ChatComposerBarProps {
  composer: ChatComposerState;
  isSending: boolean;
  onSend: (text: string) => void | Promise<void>;
  onDraftChange?: (hasDraftText: boolean) => void;
  className?: string;
}

export function ChatComposerBar({
  composer,
  isSending,
  onSend,
  onDraftChange,
  className,
}: ChatComposerBarProps) {
  const [draft, setDraft] = useState("");
  const isKeyboardVisible = useVirtualKeyboardVisible();
  const scheduleViewportSync = useChatMobileViewportSchedule();

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !composer.isSendEnabled || isSending) return;
    setDraft("");
    await onSend(text);
  };

  return (
    <footer
      className={cn(
        "shrink-0 border-t border-border/60 bg-background/95 px-3 pt-3 backdrop-blur-md",
        isKeyboardVisible
          ? "pb-3"
          : "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {composer.helperText ? (
        <p className="mb-2 px-1 text-xs text-muted-foreground">{composer.helperText}</p>
      ) : null}

      <div className="flex items-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full"
          disabled={!composer.isAttachmentEnabled}
          aria-label="Anexar foto"
        >
          <ImageIcon className="h-5 w-5" aria-hidden />
        </Button>

        <Textarea
          value={draft}
          onChange={(event) => {
            const value = event.target.value;
            setDraft(value);
            onDraftChange?.(value.trim().length > 0);
          }}
          placeholder={composer.placeholder}
          disabled={!composer.isInputEnabled || isSending}
          rows={1}
          className="min-h-11 max-h-32 flex-1 resize-none rounded-full border-0 bg-muted px-4 py-3 text-[15px] leading-snug shadow-none focus-visible:ring-1 max-sm:resize-none"
          onFocus={() => scheduleViewportSync()}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSend();
            }
          }}
        />

        <Button
          type="button"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full"
          disabled={!composer.isSendEnabled || !draft.trim() || isSending}
          onClick={() => void handleSend()}
          aria-label="Enviar mensagem"
        >
          <SendHorizontal className="h-5 w-5" aria-hidden />
        </Button>
      </div>
    </footer>
  );
}
