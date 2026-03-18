import { useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileImageUrl } from "../hooks/useProfileImageUrl";
import { formatClientSince } from "../utils/formatClientSince";
import { initialsFromName } from "../utils/initialsFromName";
import { validateProfileImageFile } from "../api/profileImageStorage.api";

export interface AccountSummaryCardProps {
  fullName: string;
  email: string;
  createdAt?: string | null;
  profileImagePath?: string | null;
  onPhotoSelect?: (file: File) => void;
  onPhotoRemove?: () => void;
  isUploading?: boolean;
  isRemoving?: boolean;
  /** Label for "since" date, e.g. "Cliente desde" or "No ar desde". Default: "Cliente desde". */
  sinceLabel?: string;
  /** Profile URL for provider; when set, shows "View profile" and "Copy link" actions. */
  profileLink?: string | null;
  onCopyProfileLink?: () => void;
}

export function AccountSummaryCard({
  fullName,
  email,
  createdAt,
  profileImagePath,
  onPhotoSelect,
  onPhotoRemove,
  isUploading,
  isRemoving,
  sinceLabel = "Cliente desde",
  profileLink,
  onCopyProfileLink,
}: AccountSummaryCardProps) {
  const { url, isLoading } = useProfileImageUrl(profileImagePath);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sinceFormatted = formatClientSince(createdAt);
  const initials = initialsFromName(fullName);
  const busy = isUploading || isRemoving;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onPhotoSelect) return;
    const err = validateProfileImageFile(file);
    if (err) return;
    onPhotoSelect(file);
    e.target.value = "";
  };

  return (
    <Card>
      <CardContent className="pt-6 pb-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="relative shrink-0">
              <Avatar className="h-24 w-24 sm:h-28 sm:w-28 ring-2 ring-border overflow-hidden bg-muted">
                {url ? (
                  <AvatarImage src={url} alt="" className="object-cover" />
                ) : null}
                <AvatarFallback className="text-2xl bg-muted">
                  {isLoading && !url ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
                  ) : (
                    initials
                  )}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="min-w-0 w-full space-y-0.5">
              <h2 className="text-lg font-semibold truncate px-1">{fullName || "—"}</h2>
              <p className="text-sm text-muted-foreground truncate px-1">{email || "—"}</p>
              {sinceFormatted ? (
                <p className="text-sm text-muted-foreground">
                  {sinceLabel} {sinceFormatted}
                </p>
              ) : null}
            </div>
            {profileLink && onCopyProfileLink && (
              <div className="flex flex-wrap gap-2 justify-center pt-1">
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href={profileLink} target="_blank" rel="noopener noreferrer">
                    Visualizar perfil
                  </a>
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onCopyProfileLink}>
                  Copiar link do perfil
                </Button>
              </div>
            )}
          </div>
          {(onPhotoSelect || (onPhotoRemove && (url || profileImagePath))) ? (
            <div className="flex flex-wrap gap-2 justify-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Selecionar foto"
                onChange={handleFileChange}
                disabled={busy}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                aria-label="Alterar foto"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Camera className="h-4 w-4" aria-hidden />
                )}
              </Button>
              {onPhotoRemove && (url || profileImagePath) ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onPhotoRemove}
                  disabled={busy}
                  aria-label="Remover foto"
                >
                  Remover
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function AccountSummaryCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6 pb-6">
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-24 w-24 sm:h-28 sm:w-28 rounded-full shrink-0" />
            <div className="space-y-2 w-full flex flex-col items-center">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
