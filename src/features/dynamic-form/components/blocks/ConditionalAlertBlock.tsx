import { cn } from "@/lib/utils";
import type { FormBlockV2 } from "../../types";
import { Info, CheckCircle, AlertTriangle } from "lucide-react";

interface ConditionalAlertBlockProps {
  block: FormBlockV2;
}

export function ConditionalAlertBlock({ block }: ConditionalAlertBlockProps) {
  const alertType = (block.config?.alertType as string) ?? "info";

  const styles: Record<
    string,
    { container: string; icon: typeof Info }
  > = {
    info: {
      container:
        "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300",
      icon: Info,
    },
    warning: {
      container:
        "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
      icon: AlertTriangle,
    },
    success: {
      container:
        "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300",
      icon: CheckCircle,
    },
  };

  const config = styles[alertType] ?? styles.info;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex gap-3 p-4 rounded-lg border",
        config.container
      )}
    >
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="space-y-1">
        {block.config?.alertTitle != null && block.config.alertTitle !== "" && (
          <p className="font-medium text-sm">
            {String(block.config.alertTitle)}
          </p>
        )}
        <p className="text-sm opacity-90">{block.label}</p>
        {block.helpText && (
          <p className="text-xs opacity-75">{block.helpText}</p>
        )}
      </div>
    </div>
  );
}
