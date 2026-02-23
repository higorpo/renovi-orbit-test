/**
 * AuthProvider: orquestra estado de auth e perfil.
 * Delega: carregamento de perfil (useProfileFetcher), eventos de auth (authStateHandlers),
 * sessão expirada (useSessionExpiredHandler), redirect (getRedirectPathForProfile).
 */
import { authApi } from "@/lib/api/auth.api";
import { getRedirectPathForProfile } from "@/lib/auth/getRedirectPath";
import { cacheRemove } from "@/lib/cache";
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
import { processAuthEvent } from "./authStateHandlers";
import { useAnalytics } from "./useAnalytics";
import { useProfileFetcher } from "./useProfileFetcher";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_DEBOUNCE_MS = 300;
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
        logger.error("auth_signup_error", {
          error: error instanceof Error ? error.message : String(error),
        });
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
