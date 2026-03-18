import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { useAccountProfile } from "./useAccountProfile";
import {
  getProviderPrivateProfile,
  getProviderPublicProfile,
} from "../api/providerProfile.api";
import type {
  ProviderPrivateProfile,
  ProviderPublicProfileWithServiceArea,
} from "../api/providerProfile.api";

const PROVIDER_PRIVATE_QUERY_KEY = ["provider-profiles-private"];
const PROVIDER_PUBLIC_QUERY_KEY = ["provider-profiles-public"];

export interface ProviderProfileComposed {
  profile: ReturnType<typeof useAccountProfile>["profile"];
  privateData: ProviderPrivateProfile | null;
  publicData: ProviderPublicProfileWithServiceArea | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Composes profile + provider_profiles_private + provider_profiles_public for the provider account page.
 * Rows in provider_profiles_* are created by DB trigger when profile.role = 'provider'.
 */
export function useProviderProfile(): ProviderProfileComposed {
  const { profile } = useAuth();
  const accountProfile = useAccountProfile();
  const providerId = profile?.id ?? null;
  const isProvider = profile?.role === "provider";

  const privateQuery = useQuery({
    queryKey: [...PROVIDER_PRIVATE_QUERY_KEY, providerId],
    queryFn: () => getProviderPrivateProfile(providerId!),
    enabled: Boolean(providerId && isProvider),
  });

  const publicQuery = useQuery({
    queryKey: [...PROVIDER_PUBLIC_QUERY_KEY, providerId],
    queryFn: () => getProviderPublicProfile(providerId!),
    enabled: Boolean(providerId && isProvider),
  });

  const isLoading =
    accountProfile.isLoading || privateQuery.isLoading || publicQuery.isLoading;
  const error =
    accountProfile.error ?? privateQuery.data?.error ?? publicQuery.data?.error ?? null;

  const refetch = () => {
    accountProfile.refetch();
    privateQuery.refetch();
    publicQuery.refetch();
  };

  return {
    profile: accountProfile.profile,
    privateData: privateQuery.data?.data ?? null,
    publicData: publicQuery.data?.data ?? null,
    isLoading,
    error: error ?? null,
    refetch,
  };
}
