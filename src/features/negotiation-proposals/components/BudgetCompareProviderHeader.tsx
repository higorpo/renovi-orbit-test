import { Link } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { usePublicProfileImageUrl } from "@/features/provider-profile/hooks/usePublicProfileImageUrl";
import { getProviderProfilePath, ProviderRatingStars } from "@/features/provider-profile";
import { initialsFromName } from "@/lib/utils/initialsFromName";
import { cn } from "@/lib/utils";

interface BudgetCompareProviderHeaderProps {
  providerName: string;
  providerSlug: string | null;
  providerProfileImagePath: string | null;
  ratingAvg: number | null;
  ratingCount: number;
  completedServicesCount: number;
  className?: string;
}

export function BudgetCompareProviderHeader({
  providerName,
  providerSlug,
  providerProfileImagePath,
  ratingAvg,
  ratingCount,
  completedServicesCount,
  className,
}: BudgetCompareProviderHeaderProps) {
  const { url } = usePublicProfileImageUrl(providerProfileImagePath);
  const hasRatings = ratingCount > 0 && ratingAvg != null;

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
            {hasRatings ? (
              <>
                <ProviderRatingStars rating={ratingAvg} />
                <span className="text-sm font-semibold text-foreground">
                  {ratingAvg.toFixed(1)}
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Sem avaliações</span>
            )}
            <span className="text-sm text-muted-foreground">
              · {completedServicesCount} serviços
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
