import { profileApi } from "../api/profile.api";
import {
  cacheGet,
  cachePersistGet,
  cachePersistSet,
  cacheRemove,
  cacheSet,
} from "@/lib/cache";
import { logger } from "@/lib/logger";
import { useCallback, useRef } from "react";
import type { Profile } from "../types/auth.types";

const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;

function profileCacheKey(userId: string): string {
  return `profile_${userId}`;
}

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
          const cached = await cacheGet<Profile>(profileCacheKey(userId));
          if (cached) {
            logger.debug("auth_profile_from_cache", { userId });
            return cached;
          }
        }

        const offline =
          typeof navigator !== "undefined" && "onLine" in navigator && !navigator.onLine;

        if (!forceRefresh && offline) {
          const disk = cachePersistGet<Profile>(profileCacheKey(userId));
          if (disk) {
            logger.debug("auth_profile_from_persist_offline", { userId });
            cacheSet(profileCacheKey(userId), disk, PROFILE_CACHE_TTL_MS);
            return disk;
          }
          return null;
        }

        try {
          logger.debug("auth_fetch_profile_db", { userId });
          const { profile: profileData, error } = await profileApi.getProfile(userId);

          if (profileData) {
            const pk = profileCacheKey(userId);
            cacheSet(pk, profileData, PROFILE_CACHE_TTL_MS);
            cachePersistSet(pk, profileData);
            return profileData;
          }

          if (error) {
            logger.error("auth_profile_fetch_error", { error, userId });
          }

          const diskFallback = cachePersistGet<Profile>(profileCacheKey(userId));
          if (diskFallback) {
            logger.debug("auth_profile_from_persist_fallback", { userId });
            cacheSet(profileCacheKey(userId), diskFallback, PROFILE_CACHE_TTL_MS);
            return diskFallback;
          }

          return null;
        } catch (error) {
          logger.error("auth_fetch_profile_exception", {
            error: error instanceof Error ? error.message : String(error),
            userId,
          });
          const diskFallback = cachePersistGet<Profile>(profileCacheKey(userId));
          if (diskFallback) {
            cacheSet(profileCacheKey(userId), diskFallback, PROFILE_CACHE_TTL_MS);
            return diskFallback;
          }
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
    cacheRemove(profileCacheKey(currentUserId));
    inFlightFetch.current = null;
    const updated = await fetchProfile(currentUserId, true);
    if (updated) {
      setProfile(updated);
      logger.debug("auth_profile_refreshed", { role: updated.role });
    }
  }, [currentUserId, fetchProfile, setProfile]);

  return { fetchProfile, refreshProfile, lastFetchedUserId };
}
