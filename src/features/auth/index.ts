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
export type { Profile, ProfileRole, AuthContextType } from "./types/auth.types";
export { isAllowedRole } from "./types/auth.types";
