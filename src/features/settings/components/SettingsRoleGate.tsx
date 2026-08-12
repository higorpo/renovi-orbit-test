import { Navigate } from "react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/features/auth";
import type { ProfileRole } from "@/features/auth";
import { ROUTE_SETTINGS_PERSONAL_INFO } from "../constants/routes";

interface SettingsRoleGateProps {
  allow: ProfileRole[];
  children: ReactNode;
}

/** Redirects to personal-info when the signed-in role cannot open this section. */
export function SettingsRoleGate({ allow, children }: SettingsRoleGateProps) {
  const { profile, loading } = useAuth();

  if (loading || !profile) {
    return (
      <div className="animate-pulse space-y-4 p-4">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-40 rounded bg-muted" />
      </div>
    );
  }

  if (!allow.includes(profile.role)) {
    return <Navigate to={ROUTE_SETTINGS_PERSONAL_INFO} replace />;
  }

  return <>{children}</>;
}
