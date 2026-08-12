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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onPhotoSelect) return;
    const err = validateProfileImageFile(file);
    if (err) return;
    onPhotoSelect(file);
    e.target.value = "";
  };

  const isStack = layout === "stack";

  const showActions =
    Boolean(profileLink && onCopyProfileLink) ||
    Boolean(onPhotoRemove && (url || profileImagePath));

  return (
    <section
      className={cn(
        isStack
          ? "px-1 py-2"
          : "overflow-hidden rounded-2xl border border-border bg-canvas p-5 shadow-sm sm:p-6",
      )}
    >
      <div
        className={cn(
          "flex gap-4 sm:gap-5",
          isStack
            ? "flex-col items-center text-center"
            : "flex-col items-center text-center sm:flex-row sm:items-center sm:text-left",
        )}
      >
        <div className="relative shrink-0">
          <Avatar className="h-20 w-20 overflow-hidden bg-primary-soft ring-1 ring-border sm:h-24 sm:w-24">
            {url ? <AvatarImage src={url} alt="" className="object-cover" /> : null}
            <AvatarFallback className="bg-primary-soft font-display text-xl font-semibold text-primary sm:text-2xl">
              {isLoading && !url ? (
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-hidden />
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
                className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-canvas text-ink shadow-sm transition-colors duration-150 hover:bg-canvas-soft disabled:opacity-50"
              >
                {isUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Camera className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            </>
          ) : null}
        </div>

        <div
          className={cn(
            "min-w-0 flex-1",
            showActions ? "space-y-3" : "space-y-0",
            !isStack && "sm:py-0.5",
          )}
        >
          <div className="space-y-0.5">
            <h2 className="truncate font-display text-lg font-semibold tracking-tight text-ink sm:text-xl">
              {fullName || "—"}
            </h2>
            {sinceFormatted ? (
              <p className="text-caption text-muted-foreground">
                {sinceLabel} {sinceFormatted}
              </p>
            ) : null}
          </div>

          {showActions ? (
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
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function AccountSummaryCardSkeleton({ layout = "band" }: { layout?: "band" | "stack" }) {
  const isStack = layout === "stack";
  return (
    <section
      className={cn(
        isStack
          ? "px-1 py-2"
          : "overflow-hidden rounded-2xl border border-border bg-canvas p-5 shadow-sm sm:p-6",
      )}
    >
      <div
        className={cn(
          "flex gap-4 sm:gap-5",
          isStack ? "flex-col items-center" : "flex-col items-center sm:flex-row sm:items-center",
        )}
      >
        <Skeleton className="h-20 w-20 shrink-0 rounded-full sm:h-24 sm:w-24" />
        <div className="flex w-full flex-col items-center space-y-2 sm:items-start">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      </div>
    </section>
  );
}
