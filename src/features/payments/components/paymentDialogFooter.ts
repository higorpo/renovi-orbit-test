import { cn } from "@/lib/utils";

/** Sticky mobile footer chrome shared by payment / proposal shell dialogs. */
const PAYMENT_DIALOG_FOOTER_CHROME =
  "relative z-10 shrink-0 gap-2 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-0 sm:shadow-none sm:backdrop-blur-none sm:supports-[backdrop-filter]:bg-transparent";

/** Row footer (Cancelar | Continuar) — AcceptProposalDialog. */
export const PAYMENT_DIALOG_FOOTER_ROW_CLASS = cn(
  PAYMENT_DIALOG_FOOTER_CHROME,
  "flex-row items-stretch [&>button]:h-auto [&>button]:min-h-10 [&>button]:flex-1 sm:[&>button]:h-10 sm:[&>button]:flex-none",
);

/** Stacked footer — ManualPaymentDialog. */
export const PAYMENT_DIALOG_FOOTER_STACK_CLASS = cn(
  PAYMENT_DIALOG_FOOTER_CHROME,
  "flex-col sm:flex-col",
);
