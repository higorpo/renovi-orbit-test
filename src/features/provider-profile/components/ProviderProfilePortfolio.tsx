import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolioImages } from "../hooks/usePortfolioImages";
import type {
  ProviderPublicProfile,
  ProviderPortfolioItemPublic,
} from "../types/providerProfilePublic.types";

interface PortfolioItemImagesProps {
  imageUrls: string[];
}

function PortfolioItemImages({ imageUrls }: PortfolioItemImagesProps) {
  if (imageUrls.length === 0) return null;

  if (imageUrls.length === 1) {
    return (
      <div className="aspect-video overflow-hidden rounded-xl bg-muted">
        <img
          src={imageUrls[0]}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  const [featured, ...rest] = imageUrls;

  return (
    <div className="space-y-2">
      <div className="aspect-video overflow-hidden rounded-xl bg-muted">
        <img
          src={featured}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div
        className={cn(
          "grid gap-2",
          rest.length === 1 && "grid-cols-1",
          rest.length === 2 && "grid-cols-2",
          rest.length >= 3 && "grid-cols-3",
        )}
      >
        {rest.map((url, i) => (
          <div
            key={i}
            className="aspect-square overflow-hidden rounded-lg bg-muted"
          >
            <img
              src={url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function PortfolioItemPlaceholder() {
  return (
    <div className="aspect-video overflow-hidden rounded-xl bg-muted flex items-center justify-center">
      <ImageOff className="h-8 w-8 text-muted-foreground/50" aria-hidden />
    </div>
  );
}

interface PortfolioItemProps {
  item: ProviderPortfolioItemPublic;
  imageUrls: string[];
}

function PortfolioItem({ item, imageUrls }: PortfolioItemProps) {
  const dateFormatted = item.execution_date
    ? new Date(item.execution_date).toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-3">
      {imageUrls.length > 0 ? (
        <PortfolioItemImages imageUrls={imageUrls} />
      ) : (
        <PortfolioItemPlaceholder />
      )}
      <div>
        <h3 className="font-medium">{item.title}</h3>
        {dateFormatted && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {dateFormatted}
          </p>
        )}
        {item.description?.trim() && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
            {item.description}
          </p>
        )}
      </div>
    </div>
  );
}

export interface ProviderProfilePortfolioProps {
  profile: ProviderPublicProfile;
}

export function ProviderProfilePortfolio({
  profile,
}: ProviderProfilePortfolioProps) {
  const items = profile.portfolio_items ?? [];
  const { imageMap, isLoading } = usePortfolioImages(items);

  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Portfólio</h2>
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="aspect-video rounded-xl" />
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {items.map((item) => (
            <PortfolioItem
              key={item.id}
              item={item}
              imageUrls={imageMap[item.id] ?? []}
            />
          ))}
        </div>
      )}
    </section>
  );
}
