import type { Session, User, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

export interface GetSessionResult {
  session: Session | null;
  error: Error | null;
}

export interface GetCurrentUserResult {
  user: User | null;
}

export interface SignInResult {
  error: Error | null;
}

export interface SignUpResult {
  user: User | null;
  error: Error | null;
}

export interface SignOutResult {
  error: Error | null;
}

export interface SignInWithOAuthOptions {
  redirectTo?: string;
}

export interface SignInWithOAuthResult {
  error: Error | null;
}

export const authApi = {
  async getSession(): Promise<GetSessionResult> {
    const { data, error } = await supabase.auth.getSession();
    return {
      session: data.session,
      error: error ? new Error(error.message) : null,
    };
  },

  async getCurrentUser(): Promise<GetCurrentUserResult> {
    const { data } = await supabase.auth.getUser();
    return { user: data.user };
  },

  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void
  ): { unsubscribe: () => void } {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(callback);
    return {
      unsubscribe: () => subscription.unsubscribe(),
    };
  },

  async signInWithPassword(
    email: string,
    password: string
  ): Promise<SignInResult> {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error ? new Error(error.message) : null };
  },

  async signUp(
    email: string,
    password: string,
    options: { emailRedirectTo?: string; data?: { full_name?: string; role?: string } }
  ): Promise<SignUpResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: options.emailRedirectTo ?? "https://renovi.com.br/",
        data: options.data,
      },
    });
    return {
      user: data.user,
      error: error ? new Error(error.message) : null,
    };
  },

  async signOut(): Promise<SignOutResult> {
    const { error } = await supabase.auth.signOut();
    return { error: error ? new Error(error.message) : null };
  },

  async signInWithOAuth(
    provider: "google",
    options?: SignInWithOAuthOptions
  ): Promise<SignInWithOAuthResult> {
    const redirectTo =
      options?.redirectTo ?? `${typeof window !== "undefined" ? window.location.origin : ""}/login`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    return { error: error ? new Error(error.message) : null };
  },
};
