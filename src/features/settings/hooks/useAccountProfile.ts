import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { getProfile } from "@/features/auth";

const QUERY_KEY = ["settings", "profile"];

export function useAccountProfile() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: [...QUERY_KEY, user?.id ?? ""],
    queryFn: async () => {
      if (!user?.id) return { profile: null, error: "Not authenticated" };
      return getProfile(user.id);
    },
    enabled: !!user?.id,
  });

  return {
    profile: query.data?.profile ?? null,
    error: query.data?.error ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export { QUERY_KEY as ACCOUNT_PROFILE_QUERY_KEY };
