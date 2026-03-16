import type { User, Session } from "@supabase/supabase-js";

export type ProfileRole = "client" | "provider" | "admin";

export const ALLOWED_ROLES: readonly ProfileRole[] = [
  "client",
  "provider",
  "admin",
] as const;

export function isAllowedRole(role: string | null | undefined): role is ProfileRole {
  return role != null && ALLOWED_ROLES.includes(role as ProfileRole);
}

export interface Profile {
  id: string;
  role: ProfileRole;
  full_name: string;
  phone?: string | null;
  cpf?: string | null;
  profile_image_path?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  loadingSession: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: "client" | "provider",
    options?: { emailRedirectTo?: string }
  ) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getRedirectPath: (userProfile: Profile) => string;
}

export type SignUpResult =
  | { success: true; userId: string }
  | { success: false; reason: "already_registered" }
  | { success: false; reason: "error"; message: string };
