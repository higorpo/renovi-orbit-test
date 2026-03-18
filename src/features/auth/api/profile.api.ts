import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import { authApi } from "./auth.api";
import type { Profile } from "../types/auth.types";

export interface GetProfileResult {
  profile: Profile | null;
  error: string | null;
}

export interface CreateProfileParams {
  fullName: string;
  role: "client" | "provider" | "admin";
}

/**
 * Busca perfil completo do usuário (tabela profiles, coluna role).
 * Se não existir perfil, cria um com base no usuário atual (metadata).
 */
export async function getProfile(userId: string): Promise<GetProfileResult> {
  const { data: profileData, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    logger.error("profile_fetch_error", {
      error: error.message,
      userId,
    });
    return { profile: null, error: error.message };
  }

  if (!profileData) {
    return createProfileFromCurrentUser(userId);
  }

  return { profile: profileData as Profile, error: null };
}

async function createProfileFromCurrentUser(
  userId: string
): Promise<GetProfileResult> {
  const { user } = await authApi.getCurrentUser();
  const metadataRole = user?.user_metadata?.role;
  const defaultRole =
    metadataRole && ["client", "provider"].includes(metadataRole)
      ? metadataRole
      : "client";
  const fullName =
    (user?.user_metadata?.full_name as string) || "Novo Usuário";

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      role: defaultRole,
      full_name: fullName,
    })
    .select()
    .single();

  if (error) {
    logger.error("profile_create_error", { userId, error: error.message });
    return { profile: null, error: error.message };
  }

  if (!data) return { profile: null, error: "Profile not found after insert" };

  return { profile: data as Profile, error: null };
}

export interface UpdateProfileParams {
  full_name?: string;
  phone?: string | null;
  profile_image_path?: string | null;
}

export interface UpdateProfileResult {
  error: string | null;
}

/** Allowed columns for profile update (prevents role/ID mass assignment). CPF is in client_profiles_private. */
const ALLOWED_UPDATE_KEYS: (keyof UpdateProfileParams)[] = [
  "full_name",
  "phone",
  "profile_image_path",
];

export async function updateProfile(
  userId: string,
  params: UpdateProfileParams
): Promise<UpdateProfileResult> {
  const payload: Record<string, unknown> = {};
  for (const key of ALLOWED_UPDATE_KEYS) {
    if (key in params) {
      payload[key] = params[key];
    }
  }
  if (Object.keys(payload).length === 0) {
    return { error: null };
  }

  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", userId);

  if (error) {
    logger.error("profile_update_error", {
      error: error.message,
      userId,
    });
    return { error: error.message };
  }
  return { error: null };
}

export interface UpdateRoleResult {
  error: string | null;
}

export async function updateRole(
  userId: string,
  role: "client" | "provider"
): Promise<UpdateRoleResult> {
  // Never allow admin via application; enforce even if type is bypassed
  if ((role as unknown as 'admin') === "admin") {
    logger.warn("profile_update_role_rejected", { reason: "admin_not_allowed", userId });
    return { error: "Role admin cannot be set via application." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (error) {
    logger.error("profile_update_role_error", {
      error: error.message,
      userId,
    });
    return { error: error.message };
  }
  return { error: null };
}

export const profileApi = {
  getProfile,
  updateProfile,
  updateRole,
};
