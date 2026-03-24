import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export interface LoadMoreButtonProps {
  onLoadMore: () => void;
  isLoading: boolean;
  className?: string;
}

export function LoadMoreButton({
  onLoadMore,
  isLoading,
  className,
}: LoadMoreButtonProps) {
  return (
    <div className={className ?? "mt-6 flex justify-center"}>
      <Button
        type="button"
        variant="outline"
        onClick={onLoadMore}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Carregando…
          </>
        ) : (
          "Carregar mais"
        )}
      </Button>
    </div>
  );
}
