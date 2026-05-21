import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { cachePersistRemove, cacheRemove } from "@/lib/cache";
import { logger } from "@/lib/logger";
import type { Profile } from "../types/auth.types";

export interface AuthHandlersContext {
  getIsMounted: () => boolean;
  setSession: (s: Session | null) => void;
  setUser: (u: import("@supabase/supabase-js").User | null) => void;
  setProfile: (p: Profile | null) => void;
  setLoading: (v: boolean) => void;
  setLoadingSession: (v: boolean) => void;
  fetchProfile: (userId: string, forceRefresh?: boolean) => Promise<Profile | null>;
  getRedirectPath: (profile: Profile) => string;
  navigate: (path: string, opts?: { replace?: boolean }) => void;
  isExplicitSignIn: React.MutableRefObject<boolean>;
  lastFetchedUserId: React.MutableRefObject<string | null>;
}

function applySession(
  ctx: AuthHandlersContext,
  session: Session | null,
  loadingSession = false
) {
  ctx.setSession(session);
  ctx.setUser(session?.user ?? null);
  ctx.setLoadingSession(loadingSession);
}

export function createAuthEventHandlers(
  ctx: AuthHandlersContext
): Record<AuthChangeEvent | "default", (session: Session | null) => void> {
  const fallback = (session: Session | null) => {
    applySession(ctx, session, false);
    if (session?.user) {
      ctx.fetchProfile(session.user.id).then((profile) => {
        if (!ctx.getIsMounted()) return;
        if (profile) ctx.setProfile(profile);
        ctx.setLoading(false);
      });
    } else {
      ctx.setProfile(null);
      ctx.setLoading(false);
    }
  };

  return {
    SIGNED_IN(session) {
      applySession(ctx, session, false);
      if (session?.user) {
        ctx.fetchProfile(session.user.id).then((profile) => {
          if (!ctx.getIsMounted()) return;
          if (profile) {
            ctx.setProfile(profile);
            if (ctx.isExplicitSignIn.current) {
              ctx.navigate(ctx.getRedirectPath(profile), { replace: true });
            }
          }
          ctx.isExplicitSignIn.current = false;
          ctx.setLoading(false);
        }).catch((err) => {
          logger.error("auth_fetch_profile_error", {
            error: err instanceof Error ? err.message : String(err),
          });
          ctx.isExplicitSignIn.current = false;
          ctx.setLoading(false);
        });
      }
    },

    SIGNED_OUT() {
      logger.debug("auth_signed_out", {});
      applySession(ctx, null, false);
      ctx.setProfile(null);
      ctx.setLoading(false);
      if (ctx.lastFetchedUserId.current) {
        const uid = ctx.lastFetchedUserId.current;
        const pk = `profile_${uid}`;
        cacheRemove(pk);
        void cachePersistRemove(pk);
      }
    },

    TOKEN_REFRESHED(session) {
      logger.debug("auth_token_refreshed", {});
      applySession(ctx, session);
    },

    USER_UPDATED(session) {
      logger.debug("auth_user_updated", {});
      applySession(ctx, session);
      if (session?.user) {
        ctx.fetchProfile(session.user.id, true).then((profile) => {
          if (ctx.getIsMounted() && profile) ctx.setProfile(profile);
        });
      }
    },

    INITIAL_SESSION: fallback,
    PASSWORD_RECOVERY: fallback,
    MFA_CHALLENGE_VERIFIED: fallback,

    default: fallback,
  };
}

const HANDLED_EVENTS: AuthChangeEvent[] = [
  "SIGNED_IN",
  "SIGNED_OUT",
  "TOKEN_REFRESHED",
  "USER_UPDATED",
];

export function processAuthEvent(
  event: AuthChangeEvent,
  session: Session | null,
  ctx: AuthHandlersContext
): void {
  const handlers = createAuthEventHandlers(ctx);
  const handler =
    HANDLED_EVENTS.includes(event) && handlers[event]
      ? handlers[event]
      : handlers.default;
  handler(session);
}
