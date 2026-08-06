import { LoadMoreButton } from "@/components/ui/load-more-button";
import { formatDatePtBr } from "@/lib/utils/formatDate";
import { usePublicProviderRatings } from "../hooks/usePublicProviderRatings";
import { ProviderRatingStars } from "./ProviderRatingStars";
import type { ProviderPublicRatingItem } from "../types/providerProfilePublic.types";

export interface ProviderProfileReviewsProps {
  providerId: string;
}

function RatingItem({ item }: { item: ProviderPublicRatingItem }) {
  const dateLabel = formatDatePtBr(item.submitted_at);
  const scoreLabel = item.overall_score.toFixed(1);

  return (
    <li className="rounded-xl border border-border/60 bg-background px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <ProviderRatingStars rating={item.overall_score} />
        <span className="text-sm font-semibold text-foreground">{scoreLabel}</span>
        <span className="text-xs text-muted-foreground">· Cliente</span>
        <time
          className="ml-auto text-xs text-muted-foreground"
          dateTime={item.submitted_at}
        >
          {dateLabel}
        </time>
      </div>
      {item.comment ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {item.comment}
        </p>
      ) : null}
    </li>
  );
}

export function ProviderProfileReviews({ providerId }: ProviderProfileReviewsProps) {
  const {
    items,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = usePublicProviderRatings(providerId);

  return (
    <section aria-labelledby="provider-reviews-heading">
      <h2 id="provider-reviews-heading" className="text-lg font-semibold mb-3">
        Avaliações
      </h2>

      {isLoading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Carregando avaliações">
          {Array.from({ length: 2 }, (_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-xl bg-muted/60"
            />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar as avaliações. Tente novamente mais tarde.
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ainda sem avaliações</p>
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((item) => (
              <RatingItem key={item.id} item={item} />
            ))}
          </ul>
          {hasNextPage ? (
            <LoadMoreButton
              onLoadMore={() => {
                void fetchNextPage();
              }}
              isLoading={isFetchingNextPage}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
