import { Link } from "react-router";
import { Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { usePublicProfileImageUrl } from "@/features/provider-profile/hooks/usePublicProfileImageUrl";
import { getProviderProfilePath } from "@/features/provider-profile";
import { initialsFromName } from "@/lib/utils/initialsFromName";
import { cn } from "@/lib/utils";
import {
  mockProviderCompletedServices,
  mockProviderRating,
} from "../utils/mockProviderRating";

interface BudgetCompareProviderHeaderProps {
  providerId: string;
  providerName: string;
  providerSlug: string | null;
  providerProfileImagePath: string | null;
  className?: string;
}

function ProviderRatingStars({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;

  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: 5 }, (_, index) => {
        const filled = index < fullStars || (index === fullStars && hasHalf);
        return (
          <Star
            key={index}
            className={cn(
              "h-3.5 w-3.5",
              filled ? "fill-amber-400 text-amber-500" : "text-muted-foreground/35",
            )}
            strokeWidth={1.5}
          />
        );
      })}
    </span>
  );
}

export function BudgetCompareProviderHeader({
  providerId,
  providerName,
  providerSlug,
  providerProfileImagePath,
  className,
}: BudgetCompareProviderHeaderProps) {
  const { url } = usePublicProfileImageUrl(providerProfileImagePath);
  const ratingValue = Number(mockProviderRating(providerId));
  const completedServices = mockProviderCompletedServices(providerId);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/70 bg-background px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-11 w-11 shrink-0 ring-2 ring-background">
          {url ? <AvatarImage src={url} alt="" /> : null}
          <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
            {initialsFromName(providerName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-1">
          <p className="truncate text-base font-semibold text-foreground">{providerName}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ProviderRatingStars rating={ratingValue} />
            <span className="text-sm font-semibold text-foreground">
              {ratingValue.toFixed(1)}
            </span>
            <span className="text-sm text-muted-foreground">
              · {completedServices} serviços
            </span>
          </div>
        </div>
      </div>
      {providerSlug ? (
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-10 min-h-10 w-full shrink-0 rounded-full px-4 sm:h-9 sm:min-h-9 sm:w-auto"
        >
          <Link to={getProviderProfilePath(providerSlug)}>Ver perfil</Link>
        </Button>
      ) : null}
    </div>
  );
}
