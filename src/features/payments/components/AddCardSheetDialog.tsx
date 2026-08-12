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
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import type { TokenizeCardSuccess } from "../api/cards.api";
import { CardForm } from "./CheckoutStepper/CardForm";

export const ADD_CARD_FORM_ID = "add-card-sheet-form";

export type AddCardDesktopPresentation = "dialog" | "sheet";

export type AddCardSheetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerServiceId?: string;
  tokenizeContext?: "checkout" | "profile";
  savedCpf?: string | null;
  phone?: string;
  /**
   * Desktop only. Default `dialog` keeps checkout unchanged.
   * Settings passes `sheet` for a right-side panel.
   */
  desktopPresentation?: AddCardDesktopPresentation;
  onSuccess: (result: TokenizeCardSuccess) => void;
};

export function AddCardSheetDialog({
  open,
  onOpenChange,
  providerServiceId,
  tokenizeContext = "checkout",
  savedCpf,
  phone,
  desktopPresentation = "dialog",
  onSuccess,
}: AddCardSheetDialogProps) {
  const isDesktop = useBreakpointMd();
  const { profile } = useAuth();
  const [isPending, setIsPending] = useState(false);

  const handleClose = () => {
    if (isPending) {
      return;
    }
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      handleClose();
      return;
    }
    onOpenChange(next);
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
      accountFullName={profile?.full_name}
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

  if (isDesktop && desktopPresentation === "sheet") {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 border-l p-0 sm:max-w-lg md:max-w-xl"
        >
          <SheetHeader className="shrink-0 space-y-1.5 border-b px-6 py-4 pr-14 text-left">
            <SheetTitle className="font-display text-lg font-semibold tracking-tight text-ink">
              Adicionar cartão
            </SheetTitle>
            <SheetDescription>
              Seus dados de cartão são enviados de forma segura e não ficam salvos neste dispositivo.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 py-5">
            {formContent}
          </div>
          <SheetFooter className="shrink-0 flex-row justify-end gap-2 space-x-0 border-t bg-canvas px-6 py-4">
            {footerContent}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
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
    <Drawer
      open={open}
      onOpenChange={handleOpenChange}
      shouldScaleBackground={false}
      handleOnly
      dismissible={!isPending}
    >
      <DrawerContent className="flex max-h-[90vh] flex-col gap-0 rounded-t-2xl p-0">
        <DrawerHeader className="shrink-0 space-y-1.5 border-b px-4 pb-3 pt-1 text-left">
          <div className="flex items-center justify-between gap-3">
            <DrawerTitle className="text-base font-semibold sm:text-lg">
              Adicionar cartão
            </DrawerTitle>
            <DrawerClose asChild>
              <button
                type="button"
                aria-label="Fechar"
                disabled={isPending}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground opacity-80 transition-all hover:bg-muted hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </DrawerClose>
          </div>
          <DrawerDescription>
            Seus dados de cartão são enviados de forma segura e não ficam salvos neste dispositivo.
          </DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 touch-pan-y overscroll-y-contain">
          {formContent}
        </div>
        <DrawerFooter className="shrink-0 w-full flex-row gap-2 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md">
          <div className="flex w-full gap-2 [&>button]:flex-1">{footerContent}</div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
