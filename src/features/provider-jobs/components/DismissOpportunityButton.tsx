import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DismissOpportunityButtonProps {
  serviceRequestId: string;
  onDismiss: (serviceRequestId: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function DismissOpportunityButton({
  serviceRequestId,
  onDismiss,
  isLoading = false,
  disabled = false,
}: DismissOpportunityButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-9 min-h-9 text-muted-foreground hover:text-foreground"
      disabled={disabled || isLoading}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDismiss(serviceRequestId);
      }}
    >
      {isLoading ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <X className="mr-1.5 h-3.5 w-3.5" aria-hidden />
      )}
      Não tenho interesse
    </Button>
  );
}
