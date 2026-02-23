import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import type { Profile } from "@/lib/auth/auth.types";

const ALLOWED_ROLES = ["client", "provider", "admin"] as const;

export interface UseRedirectWhenAuthenticatedArgs {
  user: { id: string } | null;
  profile: Profile | null;
  loading: boolean;
  /** Ref updated each render with current submitting; effect also depends on submitting so it re-runs when form finishes. */
  submittingRef: React.MutableRefObject<boolean>;
  submitting: boolean;
  redirectTo: string | null;
  getRedirectPath: (profile: Profile) => string;
}

/**
 * Redirects to the appropriate dashboard (or redirectTo) when user is authenticated
 * and has a valid role. Returns resetRedirect so the form can re-enable redirect after sign-in.
 */
export function useRedirectWhenAuthenticated({
  user,
  profile,
  loading,
  submittingRef,
  submitting,
  redirectTo,
  getRedirectPath,
}: UseRedirectWhenAuthenticatedArgs): { resetRedirect: () => void } {
  const navigate = useNavigate();
  const hasRedirected = useRef(false);

  const resetRedirect = () => {
    hasRedirected.current = false;
  };

  useEffect(() => {
    if (
      loading ||
      submittingRef.current ||
      !user ||
      !profile ||
      hasRedirected.current
    )
      return;
    if (!profile.role || !ALLOWED_ROLES.includes(profile.role)) return;

    hasRedirected.current = true;
    const path = redirectTo ?? getRedirectPath(profile);
    navigate(path, { replace: true });
  }, [
    user,
    profile,
    navigate,
    loading,
    submitting,
    getRedirectPath,
    redirectTo,
    submittingRef,
  ]);

  return { resetRedirect };
}
