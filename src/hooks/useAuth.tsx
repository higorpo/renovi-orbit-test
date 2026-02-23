/**
 * AuthProvider com prevenção de race conditions.
 * Orquestra estado e UI; comunicação com backend via auth.api e profile.api.
 */
import { authApi } from "@/lib/api/auth.api";
import { profileApi } from "@/lib/api/profile.api";
import { cacheGet, cacheRemove, cacheSet } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { validatePasswordStrength } from "@/lib/passwordPolicy";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import type { AuthContextType, Profile } from "./auth.types";
import { useAnalytics } from "./useAnalytics";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const AUTH_DEBOUNCE_MS = 300;
const SESSION_FETCH_TIMEOUT_MS = 5000;
const DUPLICATE_FETCH_THRESHOLD_MS = 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSession, setLoadingSession] = useState(true);
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();

  const fetchingProfile = useRef(false);
  const lastFetchedUserId = useRef<string | null>(null);
  const lastFetchTime = useRef<number>(0);
  const authChangeDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const lastAuthEvent = useRef<{
    event: AuthChangeEvent;
    session: Session | null;
  } | null>(null);
  const isExplicitSignIn = useRef(false);

  const fetchProfile = useCallback(
    async (userId: string, forceRefresh = false): Promise<Profile | null> => {
      const now = Date.now();
      if (
        fetchingProfile.current &&
        lastFetchedUserId.current === userId &&
        now - lastFetchTime.current < DUPLICATE_FETCH_THRESHOLD_MS
      ) {
        logger.debug("auth_skip_duplicate_fetch", { userId });
        return null;
      }

      if (!forceRefresh) {
        const cached = await cacheGet<Profile>(`profile_${userId}`);
        if (cached) {
          logger.debug("auth_profile_from_cache", { userId });
          return cached;
        }
      }

      fetchingProfile.current = true;
      lastFetchedUserId.current = userId;
      lastFetchTime.current = now;

      try {
        logger.debug("auth_fetch_profile_db", { userId });
        const { profile: profileData, error } = await profileApi.getProfile(
          userId
        );

        if (error) {
          console.error("[Auth] Profile fetch error:", error);
          return null;
        }

        if (profileData) {
          cacheSet(`profile_${userId}`, profileData, PROFILE_CACHE_TTL_MS);
        }

        return profileData;
      } catch (error) {
        console.error("❌ [Auth] Exception fetching profile:", error);
        return null;
      } finally {
        fetchingProfile.current = false;
      }
    },
    []
  );

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    cacheRemove(`profile_${user.id}`);
    fetchingProfile.current = false;
    const updated = await fetchProfile(user.id, true);
    if (updated) {
      setProfile(updated);
      logger.debug("auth_profile_refreshed", { role: updated.role });
    }
  }, [user, fetchProfile]);

  const getRedirectPath = useCallback((userProfile: Profile): string => {
    if (userProfile.role === "admin") return "/admin/dashboard";
    if (userProfile.role === "provider") return "/dashboard/provider";
    if (userProfile.role === "client") return "/dashboard/client";
    if (import.meta.env.DEV) {
      console.warn("[Auth] Unknown role:", userProfile.role);
    }
    return "/onboarding";
  }, []);

  useEffect(() => {
    let isMounted = true;

    const sessionTimeout = setTimeout(() => {
      if (isMounted && loadingSession) {
        logger.warn("auth_session_fetch_timeout", {
          afterMs: SESSION_FETCH_TIMEOUT_MS,
        });
        setLoadingSession(false);
        setLoading(false);
      }
    }, SESSION_FETCH_TIMEOUT_MS);

    authApi.getSession().then(({ session: currentSession, error }) => {
      clearTimeout(sessionTimeout);
      if (!isMounted) return;

      if (error) {
        console.error("[Auth] Error getting session:", error);
        setLoadingSession(false);
        setLoading(false);
        return;
      }

      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoadingSession(false);

      if (currentSession?.user) {
        fetchProfile(currentSession.user.id)
          .then((userProfile) => {
            if (!isMounted) return;
            if (userProfile) setProfile(userProfile);
            setLoading(false);
          })
          .catch((err) => {
            logger.error("auth_fetch_profile_error", {
              error: err instanceof Error ? err.message : String(err),
            });
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    const { unsubscribe } = authApi.onAuthStateChange((event, currentSession) => {
      if (!isMounted) return;
      logger.debug("auth_state_change", {
        event,
        userId: currentSession?.user?.id,
      });

      if (authChangeDebounceTimer.current) {
        clearTimeout(authChangeDebounceTimer.current);
      }
      lastAuthEvent.current = { event, session: currentSession };
      authChangeDebounceTimer.current = setTimeout(() => {
        if (!isMounted || !lastAuthEvent.current) return;
        const { event: debouncedEvent, session: debouncedSession } =
          lastAuthEvent.current;

        switch (debouncedEvent) {
          case "SIGNED_IN":
            handleSignedIn(debouncedSession);
            break;
          case "SIGNED_OUT":
            handleSignedOut();
            break;
          case "TOKEN_REFRESHED":
            handleTokenRefreshed(debouncedSession);
            break;
          case "USER_UPDATED":
            handleUserUpdated(debouncedSession);
            break;
          default:
            handleGenericAuthChange(debouncedSession);
        }
      }, AUTH_DEBOUNCE_MS);
    });

    function handleSignedIn(currentSession: Session | null) {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoadingSession(false);

      if (currentSession?.user) {
        fetchProfile(currentSession.user.id)
          .then((userProfile) => {
            if (!isMounted) return;
            if (userProfile) {
              setProfile(userProfile);
              if (isExplicitSignIn.current) {
                isExplicitSignIn.current = false;
                navigate(getRedirectPath(userProfile), { replace: true });
              }
            }
            setLoading(false);
          })
          .catch((err) => {
            console.error("[Auth] Error in handleSignedIn:", err);
            setLoading(false);
          });
      }
    }

    function handleSignedOut() {
      logger.debug("auth_signed_out", {});
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoadingSession(false);
      setLoading(false);
      if (lastFetchedUserId.current) {
        cacheRemove(`profile_${lastFetchedUserId.current}`);
      }
    }

    function handleTokenRefreshed(currentSession: Session | null) {
      if (import.meta.env.DEV) console.log("[Auth] Token refreshed");
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
    }

    function handleUserUpdated(currentSession: Session | null) {
      logger.debug("auth_user_updated", {});
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        fetchProfile(currentSession.user.id, true).then((userProfile) => {
          if (!isMounted) return;
          if (userProfile) setProfile(userProfile);
        });
      }
    }

    function handleGenericAuthChange(currentSession: Session | null) {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoadingSession(false);
      if (currentSession?.user) {
        fetchProfile(currentSession.user.id).then((userProfile) => {
          if (!isMounted) return;
          if (userProfile) setProfile(userProfile);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    }

    return () => {
      isMounted = false;
      if (authChangeDebounceTimer.current) {
        clearTimeout(authChangeDebounceTimer.current);
      }
      clearTimeout(sessionTimeout);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setup once on mount; loadingSession is read inside timeout only
  }, [navigate, fetchProfile, getRedirectPath]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      isExplicitSignIn.current = true;

      const { error } = await authApi.signInWithPassword(email, password);

      if (error) {
        setLoading(false);
        isExplicitSignIn.current = false;
        const msg = error.message;
        if (msg.includes("Email not confirmed")) {
          toast.error("Por favor, confirme seu email antes de fazer login.");
          throw new Error("Email não confirmado");
        }
        if (msg.includes("Invalid login credentials")) {
          toast.error("Email ou senha incorretos.");
          throw new Error("Credenciais inválidas");
        }
        toast.error(msg || "Erro ao fazer login");
        throw error;
      }

      toast.success("Login realizado!");
    } catch (error) {
      logger.error("auth_sign_in_error", {
        error: error instanceof Error ? error.message : String(error),
      });
      setLoading(false);
      isExplicitSignIn.current = false;
      throw error;
    }
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      role: "client" | "provider"
    ) => {
      try {
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.valid) {
          toast.error(passwordValidation.errors[0]);
          throw new Error(passwordValidation.errors[0]);
        }

        setLoading(true);

        const { user: newUser, error } = await authApi.signUp(email, password, {
          data: { full_name: fullName, role },
        });

        if (error) {
          setLoading(false);
          if (error.message.includes("User already registered")) {
            toast.error(
              "Este email já está cadastrado. Faça login ou recupere sua senha."
            );
            throw new Error("Usuário já existe");
          }
          throw error;
        }

        if (newUser) {
          trackEvent("signup_completed", { method: "email", user_role: role });
          if (!newUser.email_confirmed_at) {
            toast.success(
              "Cadastro realizado! Por favor, confirme seu email para fazer login."
            );
            setLoading(false);
            navigate("/signup-success");
            return;
          }
          toast.success("Cadastro realizado! Redirecionando...");
        }
      } catch (error) {
        console.error("[Auth] Signup error:", error);
        setLoading(false);
        const errMsg =
          error instanceof Error ? error.message : String(error);
        if (!errMsg.includes("Usuário já existe")) {
          toast.error(errMsg || "Erro ao criar conta");
        }
        throw error;
      }
    },
    [navigate, trackEvent]
  );

  const signOut = useCallback(async () => {
    try {
      setUser(null);
      setSession(null);
      setProfile(null);
      setLoading(false);
      setLoadingSession(false);

      const { error } = await authApi.signOut();
      if (error) throw error;

      toast.success("Logout realizado com sucesso!");
      navigate("/", { replace: true });
    } catch (error) {
      logger.error("auth_logout_error", {
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error(
        error instanceof Error ? error.message : String(error) || "Erro ao fazer logout"
      );
    }
  }, [navigate]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        loadingSession,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        getRedirectPath,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
