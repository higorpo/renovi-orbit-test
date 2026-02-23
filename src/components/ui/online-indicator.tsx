import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OnlineIndicatorProps {
  isOnline: boolean;
  lastSeen?: string | null;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
};

export const OnlineIndicator = ({
  isOnline,
  lastSeen,
  size = "md",
  showTooltip = true,
  className,
}: OnlineIndicatorProps) => {
  const indicator = (
    <span className={cn("relative flex", className)}>
      <span
        className={cn(
          "rounded-full",
          sizeClasses[size],
          isOnline
            ? "bg-green-500"
            : "bg-muted-foreground/50"
        )}
      />
      {isOnline && (
        <span
          className={cn(
            "absolute inline-flex rounded-full opacity-75 animate-ping",
            sizeClasses[size],
            "bg-green-400"
          )}
        />
      )}
    </span>
  );

  if (!showTooltip) return indicator;

  const tooltipContent = isOnline
    ? "Online agora"
    : lastSeen
    ? `Visto ${formatDistanceToNow(new Date(lastSeen), { addSuffix: true, locale: ptBR })}`
    : "Offline";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{indicator}</TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Connection status indicator for the app
interface ConnectionStatusProps {
  status: "connecting" | "connected" | "disconnected";
  className?: string;
}

export const ConnectionStatus = ({ status, className }: ConnectionStatusProps) => {
  const statusConfig = {
    connecting: {
      color: "bg-yellow-500",
      text: "Conectando...",
      pulse: true,
    },
    connected: {
      color: "bg-green-500",
      text: "Conectado",
      pulse: false,
    },
    disconnected: {
      color: "bg-red-500",
      text: "Desconectado",
      pulse: false,
    },
  };

  const config = statusConfig[status];

  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            "rounded-full h-2 w-2",
            config.color
          )}
        />
        {config.pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
              config.color
            )}
          />
        )}
      </span>
      <span>{config.text}</span>
    </div>
  );
};
