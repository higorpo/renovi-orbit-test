import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CnsMessageType } from "../../types/chats.types";

export function UnknownDynamicMessage({
  messageType,
  previewText,
  className,
}: {
  messageType: CnsMessageType | string;
  previewText?: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[88%] rounded-2xl border border-dashed border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground",
        className,
      )}
      role="status"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="font-medium text-foreground">Mensagem não suportada</p>
          <p className="mt-1">
            {previewText?.trim() ||
              "Este tipo de mensagem ainda não pode ser exibido nesta versão do app."}
          </p>
          <p className="mt-1 text-xs opacity-80">Tipo: {messageType}</p>
        </div>
      </div>
    </div>
  );
}
