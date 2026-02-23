import type { User, Session } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  role: "client" | "provider" | "admin";
  full_name: string;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  loadingSession: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: "client" | "provider"
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getRedirectPath: (userProfile: Profile) => string;
}
