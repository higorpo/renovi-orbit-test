import { Link } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { usePublicProfileImageUrl } from "../hooks/usePublicProfileImageUrl";
import { getProviderProfilePath } from "../utils/profileUrl";

interface ProviderProfileInlinePreviewProps {
  providerName: string;
  providerSlug: string | null;
  providerProfileImagePath: string | null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PR";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function ProviderProfileInlinePreview({
  providerName,
  providerSlug,
  providerProfileImagePath,
}: ProviderProfileInlinePreviewProps) {
  const { url } = usePublicProfileImageUrl(providerProfileImagePath);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar className="h-9 w-9">
          <AvatarImage src={url} alt={providerName} />
          <AvatarFallback>{getInitials(providerName)}</AvatarFallback>
        </Avatar>
        <p className="truncate text-sm font-medium">{providerName}</p>
      </div>
      {providerSlug ? (
        <Button asChild size="sm" variant="outline" className="h-8 min-h-8 shrink-0">
          <Link to={getProviderProfilePath(providerSlug)}>Ver perfil</Link>
        </Button>
      ) : null}
    </div>
  );
}
