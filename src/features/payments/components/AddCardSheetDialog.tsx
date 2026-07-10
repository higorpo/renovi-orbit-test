import { useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShellDialogContent } from "@/components/ui/shell-dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import type { TokenizeCardSuccess } from "../api/cards.api";
import { CardForm } from "./CheckoutStepper/CardForm";

export const ADD_CARD_FORM_ID = "add-card-sheet-form";

export type AddCardSheetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerServiceId?: string;
  tokenizeContext?: "checkout" | "profile";
  savedCpf?: string | null;
  phone?: string;
  onSuccess: (result: TokenizeCardSuccess) => void;
};

export function AddCardSheetDialog({
  open,
  onOpenChange,
  providerServiceId,
  tokenizeContext = "checkout",
  savedCpf,
  phone,
  onSuccess,
}: AddCardSheetDialogProps) {
  const isDesktop = useBreakpointMd();
  const [isPending, setIsPending] = useState(false);

  const handleClose = () => {
    if (isPending) {
      return;
    }
    onOpenChange(false);
  };

  const handleSuccess = (result: TokenizeCardSuccess) => {
    onSuccess(result);
    onOpenChange(false);
  };

  const formContent = open ? (
    <CardForm
      providerServiceId={providerServiceId}
      tokenizeContext={tokenizeContext}
      savedCpf={savedCpf}
      phone={phone}
      onSuccess={handleSuccess}
      hideActions
      formId={ADD_CARD_FORM_ID}
      onPendingChange={setIsPending}
    />
  ) : null;

  const footerContent = (
    <>
      <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
        Cancelar
      </Button>
      <Button type="submit" form={ADD_CARD_FORM_ID} disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Salvando…
          </>
        ) : (
          "Salvar cartão"
        )}
      </Button>
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
        <ShellDialogContent size="sm" className="gap-0 overflow-hidden sm:p-0">
          <DialogHeader className="shrink-0 space-y-1.5 px-6 pt-6 pb-4">
            <DialogTitle>Adicionar cartão</DialogTitle>
            <DialogDescription>
              Seus dados de cartão são enviados de forma segura e não ficam salvos neste dispositivo.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">
            {formContent}
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4 sm:justify-end">
            {footerContent}
          </DialogFooter>
        </ShellDialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && handleClose()}>
      <SheetContent
        side="bottom"
        hideCloseButton
        className="flex max-h-[90vh] flex-col gap-0 rounded-t-2xl p-0"
      >
        <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted" aria-hidden />
        <SheetHeader className="shrink-0 space-y-1.5 border-b px-4 pb-3 pt-2 text-left">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-base font-semibold sm:text-lg">Adicionar cartão</SheetTitle>
            <SheetClose asChild>
              <button
                type="button"
                aria-label="Fechar"
                disabled={isPending}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground opacity-80 transition-all hover:bg-muted hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </SheetClose>
          </div>
          <SheetDescription>
            Seus dados de cartão são enviados de forma segura e não ficam salvos neste dispositivo.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 touch-pan-y overscroll-y-contain">
          {formContent}
        </div>
        <SheetFooter className="shrink-0 w-full flex-row gap-2 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md">
          <div className="flex w-full gap-2 [&>button]:flex-1">{footerContent}</div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
