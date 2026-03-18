import { useQuery } from "@tanstack/react-query";
import { getPublicProfileBySlug } from "../api/providerProfilePublic.api";

export function useProviderPublicProfile(slug: string | undefined) {
  return useQuery({
    queryKey: ["provider-public-profile", slug ?? ""],
    queryFn: async () => {
      if (!slug?.trim()) return { data: null, error: "Slug is required" };
      return getPublicProfileBySlug(slug.trim());
    },
    enabled: !!slug?.trim(),
  });
}
