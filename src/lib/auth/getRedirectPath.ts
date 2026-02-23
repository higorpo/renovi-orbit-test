import type { Profile } from "@/lib/auth/auth.types";

/**
 * Returns the redirect path after login based on profile role.
 */
export function getRedirectPathForProfile(profile: Profile): string {
  if (profile.role === "admin") return "/admin/dashboard";
  if (profile.role === "provider") return "/dashboard/provider";
  if (profile.role === "client") return "/dashboard/client";
  if (import.meta.env.DEV) {
    console.warn("[Auth] Unknown role:", profile.role);
  }
  return "/onboarding";
}
