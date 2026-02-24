/**
 * Route guards: centralised auth and role-based access.
 * - ProtectedRoute: requires auth; optional allowedRoles; redirects to login or role dashboard.
 * - GuestOnlyRoute: for login/signup; redirects to dashboard when already authenticated.
 */
import { useEffect, type ReactNode } from "react";
import { useNavigate, useLocation, Outlet } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { isAllowedRole, type ProfileRole } from "../types/auth.types";

function buildLoginRedirect(path: string, search: string): string {
  const redirect = path + search;
  return redirect === "/" ? "/login" : `/login?redirect=${encodeURIComponent(redirect)}`;
}

export interface ProtectedRouteProps {
  /** Roles allowed to access. If omitted, any authenticated user is allowed. */
  allowedRoles?: readonly ProfileRole[];
  /** Custom redirect when role is not allowed (default: profile dashboard). */
  forbiddenRedirect?: string;
  children?: ReactNode;
}

/**
 * Protects routes that require authentication. Optionally restricts by role.
 * - Loading: shows minimal placeholder to avoid flashing content.
 * - Not authenticated: redirects to login with ?redirect=current.
 * - Authenticated but role not allowed: redirects to forbiddenRedirect or profile dashboard.
 */
export function ProtectedRoute({
  allowedRoles,
  forbiddenRedirect,
  children,
}: ProtectedRouteProps) {
  const { user, profile, loading, getRedirectPath } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user || !profile) {
      navigate(buildLoginRedirect(pathname, search), { replace: true });
      return;
    }
    if (allowedRoles?.length && !allowedRoles.includes(profile.role)) {
      const target = forbiddenRedirect ?? getRedirectPath(profile);
      navigate(target, { replace: true });
    }
  }, [loading, user, profile, allowedRoles, forbiddenRedirect, getRedirectPath, navigate, pathname, search]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" aria-busy="true">
        <span className="text-muted-foreground">Carregando...</span>
      </div>
    );
  }
  if (!user || !profile) return null;
  if (allowedRoles?.length && !allowedRoles.includes(profile.role)) return null;

  return children ?? <Outlet />;
}

export interface GuestOnlyRouteProps {
  children: ReactNode;
}

/**
 * For login/signup: redirects to dashboard (or ?redirect=) when user is already authenticated with a valid role.
 */
export function GuestOnlyRoute({ children }: GuestOnlyRouteProps) {
  const { user, profile, loading, getRedirectPath } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = new URLSearchParams(location.search).get("redirect");

  useEffect(() => {
    if (loading || !user || !profile) return;
    if (!isAllowedRole(profile.role)) return;

    const path = redirectTo ?? getRedirectPath(profile);
    navigate(path, { replace: true });
  }, [loading, user, profile, redirectTo, getRedirectPath, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" aria-busy="true">
        <span className="text-muted-foreground">Carregando...</span>
      </div>
    );
  }
  if (user && profile && isAllowedRole(profile.role)) return null;

  return <>{children}</>;
}
