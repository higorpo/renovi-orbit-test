import { cn } from "@/lib/utils";

export interface ChatReadReceiptLabelProps {
  className?: string;
}

export function ChatReadReceiptLabel({ className }: ChatReadReceiptLabelProps) {
  return (
    <p
      className={cn("mt-1 pr-1 text-right text-xs text-muted-foreground", className)}
      aria-label="Visualizado"
    >
      Visualizado
    </p>
  );
}
