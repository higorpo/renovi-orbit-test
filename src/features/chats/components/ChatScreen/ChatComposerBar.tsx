import { ImageIcon, SendHorizontal } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useVirtualKeyboardVisible } from "@/hooks/useVirtualKeyboardVisible";
import { cn } from "@/lib/utils";
import { useChatComposerAttachments } from "../../hooks/useChatComposerAttachments";
import { CHAT_IMAGE_ACCEPT } from "../../utils/chatImageValidation";
import type { ChatComposerState } from "../../utils/composerState";
import { ChatComposerAttachmentPreview } from "./ChatComposerAttachmentPreview";
import { ChatComposerAttachmentSourceSheet } from "./ChatComposerAttachmentSourceSheet";
import { useChatMobileViewportSchedule } from "./ChatMobileViewportContext";
import { useChatTimelineScrollContext } from "./ChatTimelineScrollContext";

export interface ChatComposerSendPayload {
  text: string;
  files: File[];
}

export interface ChatComposerBarProps {
  composer: ChatComposerState;
  isUploadingMedia?: boolean;
  onSend: (payload: ChatComposerSendPayload) => void | Promise<void>;
  /** Fired on every draft change (keystroke, paste, delete, etc.). */
  onComposerChange?: () => void;
  /** Fired when the message is sent — stops typing immediately. */
  onTypingStopNow?: () => void;
  className?: string;
}

export function ChatComposerBar({
  composer,
  isUploadingMedia = false,
  onSend,
  onComposerChange,
  onTypingStopNow,
  className,
}: ChatComposerBarProps) {
  const [draft, setDraft] = useState("");
  const [attachmentSourceOpen, setAttachmentSourceOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachments = useChatComposerAttachments();
  const isKeyboardVisible = useVirtualKeyboardVisible();
  const scheduleViewportSync = useChatMobileViewportSchedule();
  const timelineScroll = useChatTimelineScrollContext();

  const isUploadBusy = isUploadingMedia || attachments.isPreparingImages;
  const canAttach = composer.isAttachmentEnabled && !isUploadBusy;
  const hasDraftText = draft.trim().length > 0;
  const canSend =
    composer.isSendEnabled && !isUploadBusy && (hasDraftText || attachments.hasImages);

  const focusComposer = useCallback(() => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, []);

  const handleSend = () => {
    if (!canSend) return;

    const text = draft.trim();
    const files = [...attachments.pendingImages];
    setDraft("");
    attachments.clearImages();
    onTypingStopNow?.();
    void onSend({ text, files });
    focusComposer();
  };

  const openFilePicker = () => {
    if (!canAttach) return;
    if (attachments.isNativePickerAvailable) {
      setAttachmentSourceOpen(true);
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <footer
      aria-busy={isUploadBusy}
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

      {attachments.isPreparingImages ? (
        <p className="mb-2 px-1 text-xs text-muted-foreground" aria-live="polite">
          Preparando imagens…
        </p>
      ) : null}

      {isUploadingMedia ? (
        <p className="mb-2 px-1 text-xs text-muted-foreground" aria-live="polite">
          Enviando…
        </p>
      ) : null}

      <ChatComposerAttachmentPreview
        previewUrls={attachments.previewUrls}
        onRemove={attachments.removeImage}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept={CHAT_IMAGE_ACCEPT}
        multiple
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          void attachments.onSelectImages(event.target.files);
          event.currentTarget.value = "";
        }}
      />

      {attachments.isNativePickerAvailable ? (
        <ChatComposerAttachmentSourceSheet
          open={attachmentSourceOpen}
          onOpenChange={setAttachmentSourceOpen}
          onPickCamera={() => {
            void attachments.pickFromNativeCamera();
          }}
          onPickGallery={() => {
            void attachments.pickFromNativeGallery();
          }}
        />
      ) : null}

      <div className="flex items-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full"
          disabled={!canAttach}
          aria-label="Anexar foto"
          onClick={openFilePicker}
        >
          <ImageIcon className="h-5 w-5" aria-hidden />
        </Button>

        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            onComposerChange?.();
          }}
          placeholder={composer.placeholder}
          disabled={!composer.isInputEnabled || isUploadBusy}
          rows={1}
          className="min-h-11 max-h-32 flex-1 resize-none rounded-full border-0 bg-muted px-4 py-3 text-[15px] leading-snug shadow-none focus-visible:ring-1 max-sm:resize-none"
          onFocus={() => {
            timelineScroll?.onComposerFocus();
            scheduleViewportSync();
          }}
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
          disabled={!canSend}
          onMouseDown={(event) => event.preventDefault()}
          onClick={handleSend}
          aria-label="Enviar mensagem"
        >
          <SendHorizontal className="h-5 w-5" aria-hidden />
        </Button>
      </div>
    </footer>
  );
}
