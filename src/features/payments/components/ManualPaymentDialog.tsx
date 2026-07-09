import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShellDialogContent } from "@/components/ui/shell-dialog";
import { formatCurrency } from "@/lib/formatCurrency";
import { useMobileDialogViewport } from "@/hooks/useMobileDialogViewport";
import { useManualPaymentDialog } from "../hooks/useManualPaymentDialog";
import type { PaymentScheduleSummary } from "../types/paymentSchedule.types";
import {
  formatCardExpiry,
  formatMaskedCardLabel,
  getCardBrandLabel,
} from "../utils/cardPresentation";
import { CardStep } from "./CheckoutStepper/CardStep";
import { SavedCardSelector } from "./CheckoutStepper/SavedCardSelector";
import { InstallmentSelector } from "./InstallmentSelector";

const SUPPORT_URL = `${(import.meta.env.VITE_MAIN_SITE_URL ?? "").replace(/\/$/, "")}/suporte`;

export type ManualPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: PaymentScheduleSummary;
  acceptedProposalId: string;
  serviceRequestId: string;
  onCompleted?: () => void;
};

const DIALOG_FOOTER_CLASS =
  "relative z-10 shrink-0 flex-col gap-2 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:flex-col sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-0 sm:shadow-none sm:backdrop-blur-none sm:supports-[backdrop-filter]:bg-transparent";

function dialogTitle(view: string): string {
  switch (view) {
    case "installments":
      return "Parcelamento";
    case "confirm":
      return "Confirmar pagamento";
    case "terminal-error":
      return "Pagamento não concluído";
    case "service-cancelled":
      return "Serviço cancelado";
    default:
      return "Efetuar pagamento";
  }
}

function dialogDescription(view: string): string {
  switch (view) {
    case "installments":
      return "Escolha em quantas vezes deseja pagar. Os valores já incluem taxas.";
    case "confirm":
      return "Revise o cartão e o parcelamento antes de confirmar a cobrança.";
    case "terminal-error":
      return "Não foi possível concluir o pagamento com este cartão.";
    case "service-cancelled":
      return "Este serviço foi cancelado automaticamente por falta de pagamento.";
    default:
      return "Selecione ou cadastre um cartão de crédito para tentar o pagamento novamente.";
  }
}

export function ManualPaymentDialog({
  open,
  onOpenChange,
  schedule,
  acceptedProposalId,
  serviceRequestId,
  onCompleted,
}: ManualPaymentDialogProps) {
  const { contentRef, scheduleSync } = useMobileDialogViewport(open);
  const {
    view,
    setView,
    selection,
    clearsaleSessionId,
    setClearsaleSessionId,
    terminalErrorMessage,
    savedCpf,
    savedPhone,
    isSubmitting,
    handleCardSelected,
    handleInstallmentSelected,
    handleConfirmPayment,
  } = useManualPaymentDialog({
    open,
    schedule,
    onOpenChange,
    onCompleted,
  });

  const [canContinue, setCanContinue] = useState(false);
  const cardContinueRef = useRef<(() => void) | null>(null);
  const installmentContinueRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!open) {
      setCanContinue(false);
    }
  }, [open]);

  useEffect(() => {
    setCanContinue(false);
  }, [view]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ShellDialogContent ref={contentRef} size="md">
        <DialogHeader className="shrink-0 space-y-0 border-b px-4 py-3 pr-0 text-left sm:border-b-0 sm:px-0 sm:py-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base sm:text-lg">{dialogTitle(view)}</DialogTitle>
            <DialogClose asChild>
              <button
                type="button"
                aria-label="Fechar"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </DialogClose>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {dialogDescription(view)}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 touch-pan-y overscroll-y-contain sm:px-0">
          {open ? <CardStep onSessionIdGenerated={setClearsaleSessionId} /> : null}

          {view === "service-cancelled" ? (
            <p className="text-sm text-muted-foreground">
              Entre em contato com o suporte se precisar de ajuda.
            </p>
          ) : null}

          {view === "terminal-error" ? (
            <p className="text-sm text-muted-foreground">{terminalErrorMessage}</p>
          ) : null}

          {view === "card" ? (
            <SavedCardSelector
              providerServiceId={acceptedProposalId}
              savedCpf={savedCpf}
              phone={savedPhone}
              onSelect={handleCardSelected}
              onCanContinueChange={setCanContinue}
              continueRef={cardContinueRef}
            />
          ) : null}

          {view === "installments" && selection ? (
            <InstallmentSelector
              proposalId={acceptedProposalId}
              serviceId={serviceRequestId}
              cardBrand={selection.cardBrand}
              paymentTokenId={selection.paymentTokenId}
              onSelect={handleInstallmentSelected}
              onCanContinueChange={setCanContinue}
              continueRef={installmentContinueRef}
            />
          ) : null}

          {view === "confirm" && selection?.installment ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-xl border border-border p-4 space-y-1">
                <p className="text-muted-foreground">Cartão</p>
                <p className="font-medium">
                  {getCardBrandLabel(selection.cardBrand)}
                  {selection.cardNumberMasked
                    ? ` · ${formatMaskedCardLabel(selection.cardNumberMasked)}`
                    : null}
                </p>
                {selection.expiryMonth != null && selection.expiryYear != null ? (
                  <p className="text-muted-foreground">
                    Validade {formatCardExpiry(selection.expiryMonth, selection.expiryYear)}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-sm"
                  onClick={() => setView("card")}
                  onFocus={scheduleSync}
                >
                  Trocar cartão
                </Button>
              </div>

              <div className="rounded-xl border border-border p-4 space-y-1">
                <p className="text-muted-foreground">Parcelamento</p>
                <p className="font-medium">
                  {selection.installment.installmentNumber}x de{" "}
                  {formatCurrency(selection.installment.installmentAmount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Total com taxas: {formatCurrency(selection.installment.totalWithFees)}
                </p>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-sm"
                  onClick={() => setView("installments")}
                  onFocus={scheduleSync}
                >
                  Alterar parcelas
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {view === "service-cancelled" ? (
          <DialogFooter className={DIALOG_FOOTER_CLASS}>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        ) : null}

        {view === "terminal-error" ? (
          <DialogFooter className={DIALOG_FOOTER_CLASS}>
            <Button type="button" onClick={() => setView("card")}>
              Tentar com outro cartão
            </Button>
            <Button type="button" variant="outline" asChild>
              <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
                Falar com suporte
              </a>
            </Button>
          </DialogFooter>
        ) : null}

        {view === "card" ? (
          <DialogFooter className={DIALOG_FOOTER_CLASS}>
            <Button
              type="button"
              disabled={!canContinue}
              onClick={() => cardContinueRef.current?.()}
            >
              Continuar
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Voltar
            </Button>
          </DialogFooter>
        ) : null}

        {view === "installments" ? (
          <DialogFooter className={DIALOG_FOOTER_CLASS}>
            <Button
              type="button"
              disabled={!canContinue}
              onClick={() => installmentContinueRef.current?.()}
            >
              Continuar
            </Button>
            <Button type="button" variant="outline" onClick={() => setView("card")}>
              Voltar
            </Button>
          </DialogFooter>
        ) : null}

        {view === "confirm" ? (
          <DialogFooter className={DIALOG_FOOTER_CLASS}>
            <Button
              type="button"
              disabled={isSubmitting || !clearsaleSessionId || !selection?.installment}
              onClick={() => void handleConfirmPayment()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Processando…
                </>
              ) : (
                "Confirmar pagamento"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setView("installments")}
            >
              Voltar
            </Button>
          </DialogFooter>
        ) : null}
      </ShellDialogContent>
    </Dialog>
  );
}

/** @deprecated Use ManualPaymentDialog */
export const ManualPaymentModal = ManualPaymentDialog;
export type ManualPaymentModalProps = ManualPaymentDialogProps;
