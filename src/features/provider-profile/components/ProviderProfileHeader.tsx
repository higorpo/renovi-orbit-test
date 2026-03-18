import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Share2, CalendarDays, MapPin } from "lucide-react";
import { usePublicProfileImageUrl } from "../hooks/usePublicProfileImageUrl";
import { useShareProfile } from "../hooks/useShareProfile";
import { initialsFromName } from "../utils/initials";
import { formatProviderSince } from "../utils/formatProviderSince";
import type { ProviderPublicProfile } from "../types/providerProfilePublic.types";

export interface ProviderProfileHeaderProps {
  profile: ProviderPublicProfile;
}

export function ProviderProfileHeader({
  profile,
}: ProviderProfileHeaderProps) {
  const displayName =
    profile.display_name?.trim() || profile.full_name?.trim() || "Profissional";
  const { url, isLoading } = usePublicProfileImageUrl(
    profile.profile_image_path,
  );
  const initials = initialsFromName(
    profile.full_name ?? profile.display_name ?? "",
  );
  const since = formatProviderSince(profile.created_at);
  const { share } = useShareProfile(profile);

  return (
    <header className="flex flex-col sm:flex-row gap-5 sm:gap-6 items-center sm:items-start">
      <Avatar className="h-28 w-28 sm:h-32 sm:w-32 ring-4 ring-background shadow-lg shrink-0">
        {url ? (
          <AvatarImage src={url} alt={displayName} className="object-cover" />
        ) : null}
        <AvatarFallback className="text-3xl font-semibold bg-primary/10 text-primary">
          {isLoading && !url ? (
            <span className="text-muted-foreground">...</span>
          ) : (
            initials
          )}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 space-y-3 text-center sm:text-left">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {displayName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {since && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                {since}
              </span>
            )}
            {profile.service_area_cities && profile.service_area_cities.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {profile.service_area_cities.join(", ")}
              </span>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={share}
          aria-label="Compartilhar perfil"
        >
          <Share2 className="h-4 w-4" aria-hidden />
          Compartilhar
        </Button>
      </div>
    </header>
  );
}
