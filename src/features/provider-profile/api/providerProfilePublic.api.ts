import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { ProviderPublicProfile } from "../types/providerProfilePublic.types";

export interface GetPublicProfileBySlugResult {
  data: ProviderPublicProfile | null;
  error: string | null;
  restricted?: boolean;
}

/**
 * Fetches public provider profile by slug. Respects visibility:
 * - public: anyone can see
 * - restricted: only authenticated users
 * Returns null data when not found or when restricted and user not logged in.
 */
export async function getPublicProfileBySlug(
  slug: string
): Promise<GetPublicProfileBySlugResult> {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) {
    return { data: null, error: "Slug is required" };
  }

  const { data, error } = await supabase.rpc("get_public_provider_by_slug", {
    slug_param: normalizedSlug,
  });

  if (error) {
    logger.error("get_public_provider_by_slug_error", {
      error: error.message,
      slug: normalizedSlug,
    });
    return { data: null, error: error.message };
  }

  if (data == null) {
    return { data: null, error: null };
  }

  return {
    data: data as unknown as ProviderPublicProfile,
    error: null,
  };
}
