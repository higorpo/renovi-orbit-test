import type { Session, User, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";

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

export interface ResetPasswordForEmailResult {
  error: Error | null;
}

export interface UpdateUserPasswordResult {
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
    if (error) {
      logger.error('auth_signup_error', { error: error.message });
      return { user: data.user, error: new Error('Não foi possível criar a conta. Tente novamente.') };
    }
    // When "Confirm email" is enabled, Supabase does not return an error for existing emails;
    // it returns a user with empty identities. Treat that as "already registered".
    const identities = data.user?.identities ?? [];
    if (data.user && identities.length === 0) {
      return {
        user: null,
        error: new Error("User already registered"),
      };
    }
    return {
      user: data.user,
      error: null,
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
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    let redirectTo = options?.redirectTo ?? `${origin}/login`;

    // Only allow same-origin or relative path to prevent open redirect
    if (redirectTo && !redirectTo.startsWith(origin) && !redirectTo.startsWith("/")) {
      redirectTo = `${origin}/login`;
    }
    if (redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
      redirectTo = `${origin}${redirectTo}`;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    return { error: error ? new Error(error.message) : null };
  },

  async resetPasswordForEmail(
    email: string,
    redirectTo: string
  ): Promise<ResetPasswordForEmailResult> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) {
      logger.warn("auth_reset_password_email_error", { error: error.message });
      return { error: new Error(error.message) };
    }
    return { error: null };
  },

  async updateUserPassword(password: string): Promise<UpdateUserPasswordResult> {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      logger.warn("auth_update_password_error", { error: error.message });
      return { error: new Error(error.message) };
    }
    return { error: null };
  },
};
