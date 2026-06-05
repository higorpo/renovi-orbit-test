import { ImageIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useVirtualKeyboardVisible } from "@/hooks/useVirtualKeyboardVisible";
import { cn } from "@/lib/utils";
import { useChatComposerAttachments } from "../../hooks/useChatComposerAttachments";
import { useChatComposerTextareaAutoResize } from "../../hooks/useChatComposerTextareaAutoResize";
import { useChatAudioPermission } from "../../hooks/useChatAudioPermission";
import type { ChatAudioRecordingResult } from "../../hooks/useChatAudioRecorder";
import { CHAT_IMAGE_ACCEPT } from "../../utils/chatImageValidation";
import type { ChatComposerState } from "../../utils/composerState";
import {
  ChatAudioPermissionBlockedDialog,
  ChatAudioPermissionDialog,
} from "./ChatAudioPermissionDialog";
import { ChatAudioRecordingSheet } from "./ChatAudioRecordingSheet";
import { ChatComposerAttachmentPreview } from "./ChatComposerAttachmentPreview";
import { ChatComposerAttachmentSourceSheet } from "./ChatComposerAttachmentSourceSheet";
import { ChatComposerPrimaryActionButton } from "./ChatComposerPrimaryActionButton";
import { useChatMobileViewportSchedule } from "./ChatMobileViewportContext";
import { useChatTimelineScrollContext } from "./ChatTimelineScrollContext";

export interface ChatComposerSendPayload {
  text: string;
  files: File[];
}

export interface ChatComposerBarProps {
  composer: ChatComposerState;
  onSend: (payload: ChatComposerSendPayload) => void | Promise<void>;
  onSendAudio?: (result: ChatAudioRecordingResult) => void | Promise<void>;
  /** Fired on every draft change (keystroke, paste, delete, etc.). */
  onComposerChange?: () => void;
  /** Fired when the message is sent — stops typing immediately. */
  onTypingStopNow?: () => void;
  /** Shown when send is blocked by content moderation. */
  sendBlockMessage?: string | null;
  className?: string;
}

export function ChatComposerBar({
  composer,
  onSend,
  onSendAudio,
  onComposerChange,
  onTypingStopNow,
  sendBlockMessage = null,
  className,
}: ChatComposerBarProps) {
  const [draft, setDraft] = useState("");
  const [attachmentSourceOpen, setAttachmentSourceOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachments = useChatComposerAttachments();
  const audioPermission = useChatAudioPermission();
  const isKeyboardVisible = useVirtualKeyboardVisible();
  const scheduleViewportSync = useChatMobileViewportSchedule();
  const timelineScroll = useChatTimelineScrollContext();
  useChatComposerTextareaAutoResize(textareaRef, draft);

  const isUploadBusy = attachments.isPreparingImages;
  const canAttach = composer.isAttachmentEnabled && !isUploadBusy;
  const canRecordAudio = composer.isAttachmentEnabled && !isUploadBusy && Boolean(onSendAudio);
  const hasDraftText = draft.trim().length > 0;
  const canSend =
    composer.isSendEnabled && !isUploadBusy && (hasDraftText || attachments.hasImages);
  const primaryActionMode =
    hasDraftText || attachments.hasImages || !canRecordAudio ? "send" : "audio";
  const isPrimaryActionDisabled =
    primaryActionMode === "send" ? !canSend : !canRecordAudio;

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

  const handleSendAudio = (result: ChatAudioRecordingResult) => {
    onTypingStopNow?.();
    void onSendAudio?.(result);
    focusComposer();
  };

  return (
    <>
      <ChatAudioPermissionDialog
        open={audioPermission.preDialogOpen}
        onOpenChange={audioPermission.setPreDialogOpen}
        onAccept={() => void audioPermission.acceptAndRequestPermission()}
        onDismiss={audioPermission.dismissPreDialog}
        requesting={audioPermission.requesting}
      />

      <ChatAudioPermissionBlockedDialog
        open={audioPermission.blockedDialogOpen}
        onOpenChange={audioPermission.setBlockedDialogOpen}
        onDismiss={audioPermission.dismissBlockedDialog}
        onOpenSettings={() => void audioPermission.openSettings()}
        showOpenSettings={Capacitor.isNativePlatform()}
      />

      <ChatAudioRecordingSheet
        open={audioPermission.recordingSheetOpen}
        onOpenChange={(open) => {
          if (!open) audioPermission.closeRecordingSheet();
        }}
        onSend={handleSendAudio}
      />

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

        {sendBlockMessage ? (
          <p className="mb-2 px-1 text-xs text-destructive" role="alert" aria-live="polite">
            {sendBlockMessage}
          </p>
        ) : null}

        {attachments.isPreparingImages ? (
          <p className="mb-2 px-1 text-xs text-muted-foreground" aria-live="polite">
            Preparando imagens…
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

        <div className="flex min-w-0 items-end gap-2">
          <div className="flex min-h-11 min-w-0 flex-1 items-center overflow-hidden rounded-[1.375rem] bg-muted">
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
              className="min-h-11 min-w-0 flex-1 resize-none overflow-x-hidden border-0 bg-transparent py-3 pl-4 pr-1 text-[15px] leading-snug shadow-none placeholder:truncate outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 max-sm:resize-none"
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
              variant="ghost"
              size="icon"
              className="mr-1.5 h-8 w-8 shrink-0 text-muted-foreground hover:!bg-transparent hover:!text-foreground active:!bg-transparent [&_svg]:!size-5"
              disabled={!canAttach}
              aria-label="Anexar foto"
              onClick={openFilePicker}
            >
              <ImageIcon aria-hidden />
            </Button>
          </div>

          <ChatComposerPrimaryActionButton
            mode={primaryActionMode}
            disabled={isPrimaryActionDisabled}
            onSend={handleSend}
            onRecordAudio={() => void audioPermission.onMicButtonPress()}
          />
        </div>
      </footer>
    </>
  );
}
