import { Mic, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ChatComposerPrimaryActionMode = "send" | "audio";

export interface ChatComposerPrimaryActionButtonProps {
  mode: ChatComposerPrimaryActionMode;
  disabled: boolean;
  onSend: () => void;
  onRecordAudio: () => void;
}

export function ChatComposerPrimaryActionButton({
  mode,
  disabled,
  onSend,
  onRecordAudio,
}: ChatComposerPrimaryActionButtonProps) {
  const isSendMode = mode === "send";

  return (
    <Button
      type="button"
      size="icon"
      className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full"
      disabled={disabled}
      aria-label={isSendMode ? "Enviar mensagem" : "Gravar áudio"}
      onMouseDown={(event) => {
        if (isSendMode) {
          event.preventDefault();
        }
      }}
      onClick={() => {
        if (isSendMode) {
          onSend();
          return;
        }
        onRecordAudio();
      }}
    >
      <SendHorizontal
        aria-hidden
        className={cn(
          "absolute h-5 w-5 transition-all duration-200 ease-out",
          isSendMode ? "scale-100 opacity-100" : "scale-75 opacity-0",
        )}
      />
      <Mic
        aria-hidden
        className={cn(
          "absolute h-5 w-5 transition-all duration-200 ease-out",
          isSendMode ? "scale-75 opacity-0" : "scale-100 opacity-100",
        )}
      />
    </Button>
  );
}
