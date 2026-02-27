/**
 * AuthProvider: orquestra estado de auth e perfil.
 * Delega: carregamento de perfil (useProfileFetcher), eventos de auth (authStateHandlers),
 * sessão expirada (useSessionExpiredHandler), redirect por role.
 */
import { authApi } from "@/features/auth/api/auth.api";
import { logger } from "@/lib/logger";
import { validatePasswordStrength } from "@/features/auth/utils/passwordPolicy";
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
import type { AuthContextType, Profile, SignUpResult } from "@/features/auth/types/auth.types";
import { processAuthEvent } from "@/features/auth/utils/authStateHandlers";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useProfileFetcher } from "@/features/auth/hooks/useProfileFetcher";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_DEBOUNCE_MS = 300;

function getRedirectPathForProfile(profile: Profile): string {
  if (profile.role === "admin") return "/admin/dashboard";
  if (profile.role === "provider") return "/dashboard/provider";
  if (profile.role === "client") return "/dashboard/client";
  if (import.meta.env.DEV) {
    logger.warn("auth_unknown_role", { role: profile.role });
  }
  return "/onboarding";
}

const SESSION_FETCH_TIMEOUT_MS = 5000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSession, setLoadingSession] = useState(true);
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const isExplicitSignIn = useRef(false);

  const { fetchProfile, refreshProfile, lastFetchedUserId } = useProfileFetcher(
    setProfile,
    user?.id ?? null
  );

  const authDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAuthEventRef = useRef<{
    event: AuthChangeEvent;
    session: Session | null;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const getIsMounted = () => isMounted;

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
        logger.error("auth_session_error", { error: error.message });
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

      if (authDebounceRef.current) clearTimeout(authDebounceRef.current);
      lastAuthEventRef.current = { event, session: currentSession };
      authDebounceRef.current = setTimeout(() => {
        if (!isMounted || !lastAuthEventRef.current) return;
        const { event: e, session: s } = lastAuthEventRef.current;
        const ctx = {
          getIsMounted,
          setSession,
          setUser,
          setProfile,
          setLoading,
          setLoadingSession,
          fetchProfile,
          getRedirectPath: getRedirectPathForProfile,
          navigate,
          isExplicitSignIn,
          lastFetchedUserId,
        };
        processAuthEvent(e, s, ctx);
      }, AUTH_DEBOUNCE_MS);
    });

    return () => {
      isMounted = false;
      if (authDebounceRef.current) clearTimeout(authDebounceRef.current);
      clearTimeout(sessionTimeout);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once; loadingSession/lastFetchedUserId read inside effect only
  }, [navigate, fetchProfile]);

  const getRedirectPath = useCallback(getRedirectPathForProfile, []);

  const signInWithGoogle = useCallback(
    async (redirectTo?: string) => {
      try {
        const { error } = await authApi.signInWithOAuth("google", {
          redirectTo,
        });
        if (error) {
          toast.error("Erro ao conectar com Google. Tente novamente.");
          throw error;
        }
      } catch (error) {
        logger.error("auth_sign_in_google_error", {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    []
  );

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      isExplicitSignIn.current = true;

      const { error } = await authApi.signInWithPassword(email, password);

      if (error) {
        isExplicitSignIn.current = false;
        toast.error("Não foi possível entrar", {
          description:
            "Verifique seu email e senha. Se ainda não confirmou seu email, acesse o link enviado.",
        });
        throw error;
      }

      toast.success("Login realizado!");
    } catch (error) {
      logger.error("auth_sign_in_error", {
        error: error instanceof Error ? error.message : String(error),
      });
      isExplicitSignIn.current = false;
      throw error;
    }
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      role: "client" | "provider",
      options?: { emailRedirectTo?: string }
    ): Promise<SignUpResult> => {
      try {
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.valid) {
          const message = passwordValidation.errors[0];
          toast.error(message);
          return { success: false, reason: "error", message };
        }

        const { user: newUser, error } = await authApi.signUp(email, password, {
          data: { full_name: fullName, role },
          emailRedirectTo: options?.emailRedirectTo,
        });

        if (error) {
          if (
            error.message.includes("User already registered") ||
            error.message.includes("already registered")
          ) {
            toast.error(
              "Este email já está cadastrado. Faça login ou recupere sua senha."
            );
            return { success: false, reason: "already_registered" };
          }
          const message = error.message || "Não foi possível criar sua conta.";
          toast.error(message);
          return { success: false, reason: "error", message };
        }

        if (!newUser?.id) {
          toast.error("Erro ao criar conta. Tente novamente.");
          return {
            success: false,
            reason: "error",
            message: "Erro ao criar conta. Tente novamente.",
          };
        }

        const profile = await fetchProfile(newUser.id);
        if (profile) setProfile(profile);

        trackEvent("signup_completed", { method: "email", user_role: role });
        if (!newUser.email_confirmed_at) {
          toast.success(
            "Cadastro realizado! Por favor, confirme seu email para fazer login."
          );
        } else {
          toast.success("Cadastro realizado! Redirecionando...");
        }
        return { success: true, userId: newUser.id };
      } catch (error) {
        logger.error("auth_signup_error", {
          error: error instanceof Error ? error.message : String(error),
        });
        const message =
          error instanceof Error ? error.message : "Erro ao criar conta";
        toast.error(message);
        return { success: false, reason: "error", message };
      }
    },
    [trackEvent, fetchProfile, setProfile]
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
        signInWithGoogle,
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
