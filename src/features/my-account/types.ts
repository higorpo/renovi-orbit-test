import type { Profile } from "@/features/auth";

export interface AccountProfile extends Profile {
  phone?: string | null;
  cpf?: string | null;
  profile_image_path?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}
