import { profileApi } from "../api/profile.api";
import { cacheGet, cacheRemove, cacheSet } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { useCallback, useRef } from "react";
import type { Profile } from "../types/auth.types";

const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;

export function useProfileFetcher(
  setProfile: (p: Profile | null) => void,
  currentUserId: string | null
) {
  // Stores the in-flight promise so concurrent callers share the same DB request
  const inFlightFetch = useRef<Promise<Profile | null> | null>(null);
  const lastFetchedUserId = useRef<string | null>(null);

  const fetchProfile = useCallback(
    async (userId: string, forceRefresh = false): Promise<Profile | null> => {
      // Return the in-flight promise for the same user to avoid concurrent DB hits.
      // The promise is assigned synchronously (before any await) so this check is
      // race-condition-free even when multiple callers enter in the same microtask burst.
      if (!forceRefresh && inFlightFetch.current && lastFetchedUserId.current === userId) {
        logger.debug("auth_reuse_inflight_fetch", { userId });
        return inFlightFetch.current;
      }

      // Build the promise synchronously — assigned to the ref before the first await
      // so any concurrent call that checks the ref right after will reuse it.
      const promise = (async () => {
        if (!forceRefresh) {
          const cached = await cacheGet<Profile>(`profile_${userId}`);
          if (cached) {
            logger.debug("auth_profile_from_cache", { userId });
            return cached;
          }
        }

        try {
          logger.debug("auth_fetch_profile_db", { userId });
          const { profile: profileData, error } = await profileApi.getProfile(userId);

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
          inFlightFetch.current = null;
        }
      })();

      inFlightFetch.current = promise;
      lastFetchedUserId.current = userId;
      return promise;
    },
    []
  );

  const refreshProfile = useCallback(async () => {
    if (!currentUserId) return;
    cacheRemove(`profile_${currentUserId}`);
    inFlightFetch.current = null;
    const updated = await fetchProfile(currentUserId, true);
    if (updated) {
      setProfile(updated);
      logger.debug("auth_profile_refreshed", { role: updated.role });
    }
  }, [currentUserId, fetchProfile, setProfile]);

  return { fetchProfile, refreshProfile, lastFetchedUserId };
}
