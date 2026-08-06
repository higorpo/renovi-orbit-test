import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProviderRatingStarsProps {
  rating: number;
  className?: string;
  starClassName?: string;
}

/** Five-star display for provider overall scores (supports half-star threshold at 0.5). */
export function ProviderRatingStars({
  rating,
  className,
  starClassName = "h-3.5 w-3.5",
}: ProviderRatingStarsProps) {
  const safeRating = Number.isFinite(rating) ? Math.min(Math.max(rating, 0), 5) : 0;
  const fullStars = Math.floor(safeRating);
  const hasHalf = safeRating - fullStars >= 0.5;

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-hidden>
      {Array.from({ length: 5 }, (_, index) => {
        const filled = index < fullStars || (index === fullStars && hasHalf);
        return (
          <Star
            key={index}
            className={cn(
              starClassName,
              filled ? "fill-amber-400 text-amber-500" : "text-muted-foreground/35",
            )}
            strokeWidth={1.5}
          />
        );
      })}
    </span>
  );
}
