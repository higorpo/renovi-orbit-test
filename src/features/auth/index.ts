/**
 * Auth feature — Public API.
 *
 * Only the exports below are intended for use by the rest of the application.
 * Internal modules (api/, utils/, individual components) should NOT be imported
 * directly from outside this feature.
 */

// Provider & hook — wrap the app; consume auth state anywhere
export { AuthProvider, useAuth } from "./hooks/useAuth";

// Route guards — used in router.tsx to protect/restrict routes
export { ProtectedRoute, GuestOnlyRoute } from "./components/routeGuards";

// Types needed by other features (e.g. dashboard checks user role)
export type { Profile, ProfileRole, AuthContextType, SignUpResult } from "./types/auth.types";
export { isAllowedRole } from "./types/auth.types";

export { getProfile } from "./api/profile.api";
export { authApi } from "./api/auth.api";
export {
  validatePasswordStrength,
  getPasswordStrengthLabel,
  getPasswordStrengthColor,
  getPasswordStrengthDisplay,
  PASSWORD_REQUIREMENTS,
} from "./utils/passwordPolicy";
export type { PasswordStrengthDisplay } from "./utils/passwordPolicy";

// Inline client signup (e.g. request-quote flow) — first/last name fields + validation
export {
  clientSignupIdentitySchema,
  defaultClientSignupIdentity,
  identityToFullName,
} from "./types/clientSignupIdentity.validation";
export type { ClientSignupIdentityData } from "./types/clientSignupIdentity.validation";
export { usePasswordFieldDisplay } from "./hooks/usePasswordFieldDisplay";
export { InlineClientSignupFields } from "./components/InlineClientSignup/InlineClientSignupFields";
export type { InlineClientSignupFieldsProps } from "./components/InlineClientSignup/InlineClientSignupFields";
export { getClientEmailRedirectTo } from "./hooks/useClientSignupForm";