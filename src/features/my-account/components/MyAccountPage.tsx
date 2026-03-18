import { useAuth } from "@/features/auth";
import { MyAccountClientPage } from "./MyAccountClientPage";
import { MyAccountProviderPage } from "./MyAccountProviderPage";

/**
 * Wrapper that renders client or provider account page based on profile role.
 * Same route /dashboard/conta for both; role is determined by useAuth().profile?.role.
 */
export function MyAccountPage() {
  const { profile, loading } = useAuth();

  if (loading || !profile) {
    return (
      <div className="container max-w-4xl px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-4 w-72 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (profile.role === "provider") {
    return <MyAccountProviderPage />;
  }

  return <MyAccountClientPage />;
}
