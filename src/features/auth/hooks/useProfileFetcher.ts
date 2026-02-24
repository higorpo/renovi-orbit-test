import { profileApi } from "../api/profile.api";
import { cacheGet, cacheRemove, cacheSet } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { useCallback, useRef } from "react";
import type { Profile } from "../types/auth.types";

const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const DUPLICATE_FETCH_THRESHOLD_MS = 1000;

export function useProfileFetcher(
  setProfile: (p: Profile | null) => void,
  currentUserId: string | null
) {
  const fetchingProfile = useRef(false);
  const lastFetchedUserId = useRef<string | null>(null);
  const lastFetchTime = useRef<number>(0);

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
          logger.error("auth_profile_fetch_error", { error, userId });
          return null;
        }

        if (profileData) {
          cacheSet(`profile_${userId}`, profileData, PROFILE_CACHE_TTL_MS);
        }

        return profileData;
      } catch (error) {
        logger.error("auth_fetch_profile_exception", {
          error: error instanceof Error ? error.message : String(error),
          userId,
        });
        return null;
      } finally {
        fetchingProfile.current = false;
      }
    },
    []
  );

  const refreshProfile = useCallback(async () => {
    if (!currentUserId) return;
    cacheRemove(`profile_${currentUserId}`);
    fetchingProfile.current = false;
    const updated = await fetchProfile(currentUserId, true);
    if (updated) {
      setProfile(updated);
      logger.debug("auth_profile_refreshed", { role: updated.role });
    }
  }, [currentUserId, fetchProfile, setProfile]);

  return { fetchProfile, refreshProfile, lastFetchedUserId };
}
