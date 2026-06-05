import { Loader2, Mic, SendHorizontal, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ShellDialogContent } from "@/components/ui/shell-dialog";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";
import {
  useChatAudioRecorder,
  type ChatAudioRecordingResult,
} from "../../hooks/useChatAudioRecorder";
import { MAX_AUDIO_DURATION_MS, MIN_AUDIO_DURATION_MS } from "../../utils/chatAudioConstants";
import { formatAudioDuration } from "../../utils/formatAudioDuration";
import { chatAudioWaveformBarHeight } from "../../utils/normalizeChatAudioAmplitude";

export interface ChatAudioRecordingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (result: ChatAudioRecordingResult) => void | Promise<void>;
}

const WAVEFORM_BAR_COUNT = 20;

interface ChatAudioRecordingPanelProps {
  recorder: ReturnType<typeof useChatAudioRecorder>;
  canSend: boolean;
  onClose: () => void;
  onSend: () => void;
}

function ChatAudioRecordingWaveform({
  recorder,
}: Pick<ChatAudioRecordingPanelProps, "recorder">) {
  return (
    <div className="flex flex-col items-center gap-4 px-4 pb-2 sm:px-0">
      <div
        className="flex h-20 w-full items-end justify-center gap-1 rounded-2xl bg-muted/60 px-3 py-3"
        aria-hidden
      >
        {Array.from({ length: WAVEFORM_BAR_COUNT }).map((_, index) => {
          const level = chatAudioWaveformBarHeight(recorder.amplitude, index, WAVEFORM_BAR_COUNT);
          return (
            <div
              key={index}
              className="w-1 rounded-full bg-primary transition-[height] duration-75 ease-out"
              style={{ height: `${Math.round(level * 100)}%` }}
            />
          );
        })}
      </div>

      <div className="text-center">
        <p className="text-2xl font-semibold tabular-nums tracking-tight">
          {formatAudioDuration(recorder.elapsedMs)}
        </p>
        {!recorder.hasPendingRecording ? (
          <p className="mt-0.5 text-sm text-muted-foreground">
            Restam {formatAudioDuration(recorder.remainingMs)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ChatAudioRecordingActions({
  recorder,
  canSend,
  onClose,
  onSend,
}: ChatAudioRecordingPanelProps) {
  return (
    <>
      <Button type="button" variant="outline" disabled={recorder.isBusy} onClick={onClose}>
        <Trash2 className="mr-2 h-4 w-4" aria-hidden />
        Cancelar
      </Button>
      <Button
        type="button"
        disabled={!canSend}
        className={cn(!canSend && "opacity-70")}
        onClick={onSend}
      >
        {recorder.isBusy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Enviando…
          </>
        ) : (
          <>
            <SendHorizontal className="mr-2 h-4 w-4" aria-hidden />
            Enviar
          </>
        )}
      </Button>
    </>
  );
}

function ChatAudioRecordingTitle({
  recorder,
}: Pick<ChatAudioRecordingPanelProps, "recorder">) {
  return (
    <>
      <Mic
        className={cn("h-5 w-5 text-primary", recorder.isRecording && "animate-pulse")}
        aria-hidden
      />
      {recorder.hasPendingRecording ? "Áudio pronto" : "Gravar áudio"}
    </>
  );
}

function getChatAudioRecordingDescription(
  recorder: ReturnType<typeof useChatAudioRecorder>,
): string {
  return recorder.hitMaxDuration
    ? `Limite de ${formatAudioDuration(MAX_AUDIO_DURATION_MS)} atingido. Envie ou descarte.`
    : `Máximo de ${formatAudioDuration(MAX_AUDIO_DURATION_MS)} por mensagem.`;
}

export function ChatAudioRecordingSheet({
  open,
  onOpenChange,
  onSend,
}: ChatAudioRecordingSheetProps) {
  const isDesktop = useBreakpointMd();
  const recorder = useChatAudioRecorder();

  useEffect(() => {
    if (!open) return;
    void recorder.startRecording();
  }, [open, recorder.startRecording]);

  useEffect(() => {
    if (open) return;
    void recorder.cancelRecording();
  }, [open, recorder.cancelRecording]);

  const canSend =
    (recorder.isRecording || recorder.hasPendingRecording) &&
    !recorder.isBusy &&
    recorder.elapsedMs >= MIN_AUDIO_DURATION_MS;

  const handleClose = () => {
    void recorder.cancelRecording();
    onOpenChange(false);
  };

  const handleSend = async () => {
    const result = await recorder.stopRecording();
    if (!result) return;
    onOpenChange(false);
    await onSend(result);
  };

  const panelProps: ChatAudioRecordingPanelProps = {
    recorder,
    canSend,
    onClose: handleClose,
    onSend: () => void handleSend(),
  };

  const description = getChatAudioRecordingDescription(recorder);

  if (isDesktop) {
    return (
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) handleClose();
        }}
      >
        <ShellDialogContent size="sm" className="gap-4 sm:p-6">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ChatAudioRecordingTitle recorder={recorder} />
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <ChatAudioRecordingWaveform recorder={recorder} />
          <DialogFooter className="gap-2 sm:justify-end">
            <ChatAudioRecordingActions {...panelProps} />
          </DialogFooter>
        </ShellDialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DrawerContent className="pb-[max(1rem,env(safe-area-inset-bottom))]">
        <DrawerHeader className="gap-1 px-4 pb-2 pt-1 text-left">
          <DrawerTitle className="flex items-center gap-2 text-base">
            <ChatAudioRecordingTitle recorder={recorder} />
          </DrawerTitle>
          <DrawerDescription className="text-sm">{description}</DrawerDescription>
        </DrawerHeader>
        <ChatAudioRecordingWaveform recorder={recorder} />
        <DrawerFooter className="flex-row gap-2 px-4 pb-2 pt-0 [&>button]:min-h-11 [&>button]:flex-1">
          <ChatAudioRecordingActions {...panelProps} />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
