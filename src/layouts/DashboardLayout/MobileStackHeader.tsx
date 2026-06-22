import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMobileBackNavigation } from "./useMobileBackNavigation";

interface MobileStackHeaderProps {
  title?: string;
  backFallback?: string;
  isOffline?: boolean;
}

export function MobileStackHeader({
  title,
  backFallback,
  isOffline = false,
}: MobileStackHeaderProps) {
  const handleBack = useMobileBackNavigation({ backFallback });

  return (
    <header
      className={cn(
        "sticky z-40 relative flex h-14 w-full shrink-0 items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden",
        isOffline ? "top-11" : "top-0",
      )}
      data-testid="mobile-stack-header"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute left-0 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full hover:bg-transparent hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={handleBack}
        aria-label="Voltar"
      >
        <ArrowLeft className="!h-6 !w-6" aria-hidden />
      </Button>

      {title ? (
        <h1 className="w-full min-w-0 truncate px-11 text-center text-base font-semibold">
          {title}
        </h1>
      ) : null}
    </header>
  );
}
