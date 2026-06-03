import { Archive } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHAT_INTERACTIVE_FOCUS, CHAT_MIN_TOUCH_TARGET } from "../../utils/conversationVisualState";

export interface CloseConversationConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}

export function CloseConversationConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: CloseConversationConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Encerrar conversa?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação é definitiva. Você não poderá reabrir esta conversa, mas o histórico
            permanecerá disponível enquanto a negociação estiver registrada.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {isPending ? "Encerrando…" : "Encerrar conversa"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export interface ChatDetailsActionsProps {
  canArchive: boolean;
  isArchiving?: boolean;
  onArchive: () => void;
  className?: string;
}

export function ChatDetailsActions({
  canArchive,
  isArchiving = false,
  onArchive,
  className,
}: ChatDetailsActionsProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <h2 className="text-sm font-semibold text-foreground">Ações da conversa</h2>
      <Button
        type="button"
        variant="outline"
        className={cn(
          "w-full justify-start gap-2",
          CHAT_MIN_TOUCH_TARGET,
          CHAT_INTERACTIVE_FOCUS,
        )}
        disabled={!canArchive || isArchiving}
        onClick={onArchive}
      >
        <Archive className="h-4 w-4 shrink-0" aria-hidden />
        {isArchiving ? "Encerrando conversa…" : "Encerrar conversa"}
      </Button>
      {!canArchive ? (
        <p className="text-xs text-muted-foreground">Esta conversa já foi encerrada.</p>
      ) : null}
    </section>
  );
}
