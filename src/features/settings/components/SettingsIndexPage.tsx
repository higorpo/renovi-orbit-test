import { Navigate } from "react-router";
import { useAuth } from "@/features/auth";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { useAccountProfile } from "../hooks/useAccountProfile";
import { useProviderProfile } from "../hooks/useProviderProfile";
import { useUploadProfilePhoto, useRemoveProfilePhoto } from "../hooks/useProfilePhotoMutation";
import { getSettingsNavItems } from "../constants/settingsNav";
import { ROUTE_SETTINGS_PERSONAL_INFO } from "../constants/routes";
import { SettingsNavList } from "./SettingsNavList";
import { AccountSummaryCard, AccountSummaryCardSkeleton } from "./AccountSummaryCard";
import { toast } from "sonner";

/**
 * Mobile: account hub index (summary + section list).
 * Desktop: redirect to personal-info (sidebar lives in SettingsLayout).
 */
export function SettingsIndexPage() {
  const isDesktop = useBreakpointMd();
  const { user, profile: authProfile } = useAuth();
  const role = authProfile?.role ?? "client";
  const items = getSettingsNavItems(role);

  if (isDesktop) {
    return <Navigate to={ROUTE_SETTINGS_PERSONAL_INFO} replace />;
  }

  return (
    <div className="container max-w-lg px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground">Configurações</h1>
      <div className="mb-6">
        <MobileAccountSummary role={role} email={user?.email ?? ""} />
      </div>
      <SettingsNavList items={items} variant="list" />
    </div>
  );
}

function MobileAccountSummary({
  role,
  email,
}: {
  role: "client" | "provider";
  email: string;
}) {
  if (role === "provider") {
    return <ProviderMobileSummary email={email} />;
  }
  return <ClientMobileSummary email={email} />;
}

function ClientMobileSummary({ email }: { email: string }) {
  const { profile, isLoading } = useAccountProfile();
  const { uploadPhotoAsync, isUploading } = useUploadProfilePhoto();
  const { removePhotoAsync, isRemoving } = useRemoveProfilePhoto();

  if (isLoading) return <AccountSummaryCardSkeleton />;
  if (!profile) return null;

  return (
    <AccountSummaryCard
      fullName={profile.full_name}
      email={email}
      createdAt={profile.created_at}
      profileImagePath={profile.profile_image_path}
      onPhotoSelect={(file) => {
        void uploadPhotoAsync(file);
      }}
      onPhotoRemove={() => {
        if (!profile.profile_image_path) return;
        void removePhotoAsync(profile.profile_image_path);
      }}
      isUploading={isUploading}
      isRemoving={isRemoving}
    />
  );
}

function ProviderMobileSummary({ email }: { email: string }) {
  const { profile, isLoading, publicData } = useProviderProfile();
  const { uploadPhotoAsync, isUploading } = useUploadProfilePhoto();
  const { removePhotoAsync, isRemoving } = useRemoveProfilePhoto();

  if (isLoading) return <AccountSummaryCardSkeleton />;
  if (!profile) return null;

  const profileUrl =
    typeof window !== "undefined" && publicData?.slug
      ? `${window.location.origin}/perfil/${publicData.slug}`
      : null;

  return (
    <AccountSummaryCard
      fullName={profile.full_name}
      email={email}
      createdAt={profile.created_at}
      profileImagePath={profile.profile_image_path}
      onPhotoSelect={(file) => {
        void uploadPhotoAsync(file);
      }}
      onPhotoRemove={() => {
        if (!profile.profile_image_path) return;
        void removePhotoAsync(profile.profile_image_path);
      }}
      isUploading={isUploading}
      isRemoving={isRemoving}
      sinceLabel="No ar desde"
      profileLink={profileUrl}
      onCopyProfileLink={
        profileUrl
          ? () => {
              void navigator.clipboard.writeText(profileUrl).then(
                () => toast.success("Link copiado."),
                () => toast.error("Não foi possível copiar."),
              );
            }
          : undefined
      }
    />
  );
}
