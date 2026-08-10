/**
 * Confirm sheet/dialog to open a service dispute with optional reason.
 */

import { useEffect, useState } from "react";
import {
  Loader2,
  MessageCircle,
  MessageCircleWarning,
  Scale,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ShellDialogContent } from "@/components/ui/shell-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useMobileDialogViewport } from "@/hooks/useMobileDialogViewport";
import { cn } from "@/lib/utils";
import { useOpenDispute } from "../hooks/useOpenDispute";

const REASON_MAX_LENGTH = 2000;

const WHAT_HAPPENS_NEXT = [
  {
    icon: Scale,
    text: "A plataforma analisa o caso e pode pedir correção ou reembolso.",
  },
  {
    icon: MessageCircle,
    text: "O chat com o prestador permanece aberto durante a análise.",
  },
  {
    icon: Wallet,
    text: "O pagamento ao prestador fica em retenção até a resolução.",
  },
] as const;

export type OpenDisputeConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceRequestId: string;
  contractedServiceId: string;
  /** Called after a successful open (parent closes evaluate wizard). */
  onOpened?: () => void;
};

export function OpenDisputeConfirmDialog({
  open,
  onOpenChange,
  serviceRequestId,
  contractedServiceId,
  onOpened,
}: OpenDisputeConfirmDialogProps) {
  const { contentRef, scheduleSync } = useMobileDialogViewport(open);
  const [reason, setReason] = useState("");
  const openDisputeMutation = useOpenDispute({
    serviceRequestId,
    contractedServiceId,
    onOpened: () => {
      onOpenChange(false);
      onOpened?.();
    },
  });

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const handleConfirm = () => {
    void openDisputeMutation.mutateAsync({
      reason: reason.trim() || null,
    });
  };

  const pending = openDisputeMutation.isPending;
  const reasonLen = reason.length;
  const reasonNearLimit = reasonLen >= REASON_MAX_LENGTH * 0.9;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        onOpenChange(next);
      }}
    >
      <ShellDialogContent
        ref={contentRef}
        size="md"
        data-testid="open-dispute-confirm-dialog"
      >
        <DialogHeader
          className={cn(
            "shrink-0 space-y-0 border-b border-border/70 px-4 py-3 text-left",
            // Full-bleed soft warning wash (edge-to-edge under desktop sm:p-6)
            "bg-[radial-gradient(120%_90%_at_0%_0%,hsl(var(--warning)/0.14),transparent_58%),radial-gradient(90%_80%_at_100%_0%,hsl(var(--destructive)/0.06),transparent_52%)]",
            "sm:-mx-6 sm:-mt-6 sm:rounded-t-lg sm:border-b sm:border-border/60 sm:px-6 sm:pb-4 sm:pt-6",
          )}
        >
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-warning/25 bg-warning/10 text-warning"
              aria-hidden
            >
              <MessageCircleWarning className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <DialogTitle className="text-lg font-semibold tracking-tight sm:text-xl">
                  Abrir disputa?
                </DialogTitle>
                <DialogClose asChild>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    aria-label="Fechar"
                    disabled={pending}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </DialogClose>
              </div>
              <DialogDescription className="pr-2 text-sm leading-relaxed text-muted-foreground">
                Use se a execução não ficou correta. Nossa equipe analisa o caso
                e entra em contato se precisar de mais detalhes.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Desktop gutter so focus rings are not clipped by overflow / dialog edges */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 touch-pan-y overscroll-y-contain [-webkit-overflow-scrolling:touch] sm:mt-5 sm:-mx-1 sm:space-y-6 sm:px-1 sm:py-1">
          <section
            aria-label="O que acontece a seguir"
            className="overflow-hidden rounded-2xl border border-border/80 bg-muted/25"
          >
            <div className="border-b border-border/60 px-3.5 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                O que acontece a seguir
              </p>
            </div>
            <ul className="divide-y divide-border/60">
              {WHAT_HAPPENS_NEXT.map(({ icon: Icon, text }) => (
                <li
                  key={text}
                  className="flex items-start gap-3 px-3.5 py-3"
                >
                  <span
                    className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-background text-foreground/80 ring-1 ring-border/70"
                    aria-hidden
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </span>
                  <p className="pt-1 text-sm leading-snug text-foreground/90">
                    {text}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <div className="space-y-2.5">
            <div className="flex items-end justify-between gap-3">
              <Label
                htmlFor="open-dispute-reason"
                className="text-sm font-medium"
              >
                Motivo{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </Label>
              <span
                className={cn(
                  "tabular-nums text-[11px] text-muted-foreground transition-colors",
                  reasonNearLimit && "text-warning",
                  reasonLen >= REASON_MAX_LENGTH && "text-destructive",
                )}
                aria-live="polite"
              >
                {reasonLen}/{REASON_MAX_LENGTH}
              </span>
            </div>
            <Textarea
              id="open-dispute-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onFocus={scheduleSync}
              maxLength={REASON_MAX_LENGTH}
              placeholder="Ex.: o checklist não foi cumprido, faltou material, o horário não bateu…"
              rows={4}
              disabled={pending}
              className="min-h-28 resize-y rounded-xl border-border/80 bg-background shadow-sm placeholder:text-muted-foreground/70 max-sm:resize-none focus-visible:ring-warning/30"
              data-testid="open-dispute-reason"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Quanto mais específico, mais rápido conseguimos analisar.
            </p>
          </div>
        </div>

        <DialogFooter className="relative z-10 shrink-0 flex-row items-stretch gap-2 border-t border-border/70 bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:mt-5 sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-0 sm:shadow-none sm:backdrop-blur-none sm:supports-[backdrop-filter]:bg-transparent [&>button]:h-auto [&>button]:min-h-11 [&>button]:flex-1 sm:[&>button]:h-10 sm:[&>button]:flex-none">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={pending}
            data-testid="open-dispute-confirm"
            className="rounded-xl whitespace-normal px-2.5 text-center leading-snug sm:whitespace-nowrap sm:px-4"
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Abrindo…
              </>
            ) : (
              "Abrir disputa"
            )}
          </Button>
        </DialogFooter>
      </ShellDialogContent>
    </Dialog>
  );
}
