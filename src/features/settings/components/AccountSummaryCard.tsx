import { useRef } from "react";
import { Camera, Loader2, Link2, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileImageUrl } from "../hooks/useProfileImageUrl";
import { formatClientSince } from "../utils/formatClientSince";
import { initialsFromName } from "@/lib/utils/initialsFromName";
import { validateProfileImageFile } from "../api/profileImageStorage.api";
import { cn } from "@/lib/utils";

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
  /** Compact vertical layout (mobile hub index). Default: responsive identity band. */
  layout?: "band" | "stack";
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
  layout = "band",
}: AccountSummaryCardProps) {
  const { url, isLoading } = useProfileImageUrl(profileImagePath);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sinceFormatted = formatClientSince(createdAt);
  const initials = initialsFromName(fullName);
  const busy = isUploading || isRemoving;
  const canEditPhoto = Boolean(onPhotoSelect || (onPhotoRemove && (url || profileImagePath)));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onPhotoSelect) return;
    const err = validateProfileImageFile(file);
    if (err) return;
    onPhotoSelect(file);
    e.target.value = "";
  };

  const isStack = layout === "stack";

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-canvas shadow-sm",
        isStack ? "p-5" : "p-5 sm:p-6",
      )}
    >
      <div
        className={cn(
          "flex gap-4 sm:gap-5",
          isStack ? "flex-col items-center text-center" : "flex-col items-center text-center sm:flex-row sm:items-start sm:text-left",
        )}
      >
        <div className="relative shrink-0">
          <Avatar className="h-24 w-24 overflow-hidden bg-primary-soft ring-1 ring-border sm:h-28 sm:w-28">
            {url ? <AvatarImage src={url} alt="" className="object-cover" /> : null}
            <AvatarFallback className="bg-primary-soft font-display text-2xl font-semibold text-primary">
              {isLoading && !url ? (
                <Loader2 className="h-8 w-8 animate-spin text-mute" aria-hidden />
              ) : (
                initials
              )}
            </AvatarFallback>
          </Avatar>
          {onPhotoSelect ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="sr-only"
                aria-label="Selecionar foto"
                onChange={handleFileChange}
                disabled={busy}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                aria-label="Alterar foto"
                className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-canvas text-ink shadow-sm transition-colors duration-150 hover:bg-canvas-soft disabled:opacity-50"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Camera className="h-4 w-4" aria-hidden />
                )}
              </button>
            </>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <h2 className="truncate font-display text-xl font-semibold tracking-tight text-ink sm:text-title">
              {fullName || "—"}
            </h2>
            <p className="truncate text-sm text-body">{email || "—"}</p>
            {sinceFormatted ? (
              <p className="text-caption text-mute">
                {sinceLabel} {sinceFormatted}
              </p>
            ) : null}
          </div>

          {(canEditPhoto || (profileLink && onCopyProfileLink)) && (
            <div
              className={cn(
                "flex flex-wrap gap-2",
                isStack ? "justify-center" : "justify-center sm:justify-start",
              )}
            >
              {profileLink && onCopyProfileLink ? (
                <>
                  <Button type="button" variant="outline" size="sm" className="rounded-full" asChild>
                    <a href={profileLink} target="_blank" rel="noopener noreferrer">
                      Visualizar perfil
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-full"
                    onClick={onCopyProfileLink}
                    aria-label="Copiar link do perfil"
                  >
                    <Link2 className="h-3.5 w-3.5" aria-hidden />
                    Copiar link
                  </Button>
                </>
              ) : null}
              {onPhotoRemove && (url || profileImagePath) ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-full text-body"
                  onClick={onPhotoRemove}
                  disabled={busy}
                  aria-label="Remover foto"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Remover foto
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function AccountSummaryCardSkeleton({ layout = "band" }: { layout?: "band" | "stack" }) {
  const isStack = layout === "stack";
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-canvas p-5 shadow-sm sm:p-6">
      <div
        className={cn(
          "flex gap-4 sm:gap-5",
          isStack ? "flex-col items-center" : "flex-col items-center sm:flex-row sm:items-start",
        )}
      >
        <Skeleton className="h-24 w-24 shrink-0 rounded-full sm:h-28 sm:w-28" />
        <div className="flex w-full flex-col items-center space-y-2 sm:items-start">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      </div>
    </section>
  );
}
