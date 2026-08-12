import { useAuth } from "@/features/auth";
import { ClientPersonalInfoPage } from "./ClientPersonalInfoPage";
import { ProviderPersonalInfoPage } from "./ProviderPersonalInfoPage";

/** Role-aware personal info section for the account hub. */
export function PersonalInfoPage() {
  const { profile, loading } = useAuth();

  if (loading || !profile) {
    return (
      <div className="animate-pulse space-y-4 px-4 py-6 md:px-0 md:py-0">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-64 rounded bg-muted" />
      </div>
    );
  }

  if (profile.role === "provider") {
    return <ProviderPersonalInfoPage />;
  }

  return <ClientPersonalInfoPage />;
}
