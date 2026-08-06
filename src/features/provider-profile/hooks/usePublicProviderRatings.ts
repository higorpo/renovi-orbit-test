import { useInfiniteQuery } from "@tanstack/react-query";
import { listPublicProviderRatings } from "../api/providerProfileRatings.api";
import type {
  ProviderPublicRatingCursor,
  ProviderPublicRatingsPage,
} from "../types/providerProfilePublic.types";

const STALE_TIME_MS = 60_000;
const DEFAULT_PAGE_SIZE = 20;

export function providerPublicRatingsQueryKey(providerId: string) {
  return ["provider-public-ratings", providerId] as const;
}

export function usePublicProviderRatings(providerId: string | undefined) {
  const normalizedId = providerId?.trim() ?? "";

  const query = useInfiniteQuery<ProviderPublicRatingsPage>({
    queryKey: providerPublicRatingsQueryKey(normalizedId),
    queryFn: async ({ pageParam }) => {
      const cursor = (pageParam as ProviderPublicRatingCursor | null) ?? null;
      const { data, error } = await listPublicProviderRatings({
        providerId: normalizedId,
        pageSize: DEFAULT_PAGE_SIZE,
        cursor,
      });

      if (error || !data) {
        throw new Error(error ?? "Erro ao carregar avaliações");
      }

      return data;
    },
    initialPageParam: null as ProviderPublicRatingCursor | null,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.next_cursor ?? undefined : undefined,
    enabled: !!normalizedId,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });

  const items = query.data?.pages.flatMap((page) => page?.items ?? []) ?? [];

  return {
    items,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    isError: query.isError,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
}
