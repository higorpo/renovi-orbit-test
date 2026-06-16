import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ProviderServiceListCard } from "./ProviderServiceListCard";
import {
  buildProviderServiceCardShowcaseVariants,
  type ProviderServiceCardShowcaseVariant,
} from "../../utils/providerServiceCardShowcaseFixtures";

const SHOWCASE_GROUPS = [
  "Negociação",
  "Em andamento",
  "Concluídos",
  "Cancelados",
] as const;

function groupVariants(
  variants: ProviderServiceCardShowcaseVariant[],
): Map<string, ProviderServiceCardShowcaseVariant[]> {
  const grouped = new Map<string, ProviderServiceCardShowcaseVariant[]>();

  for (const group of SHOWCASE_GROUPS) {
    grouped.set(
      group,
      variants.filter((variant) => variant.group === group),
    );
  }

  return grouped;
}

export function ProviderServiceCardShowcasePage() {
  const variants = useMemo(() => buildProviderServiceCardShowcaseVariants(), []);
  const groupedVariants = useMemo(() => groupVariants(variants), [variants]);

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8 pb-16">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-10">
        <header className="space-y-2">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            Dev only
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Provider Service Card — Showcase
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Todas as variantes do card do prestador em Meus Serviços. Datas relativas são
            calculadas com base em hoje.
          </p>
        </header>

        {SHOWCASE_GROUPS.map((group) => {
          const items = groupedVariants.get(group) ?? [];
          if (items.length === 0) return null;

          return (
            <section key={group} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">{group}</h2>
                <p className="text-xs text-muted-foreground">
                  {items.length} variante{items.length === 1 ? "" : "s"}
                </p>
              </div>

              <div className="flex flex-col gap-8">
                {items.map((variant) => (
                  <article key={variant.id} className="space-y-3">
                    <div className="space-y-1 rounded-lg border border-border/60 bg-background/80 px-3 py-2">
                      <p className="text-sm font-medium text-foreground">{variant.label}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {variant.description}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground/80">
                        id: {variant.id}
                      </p>
                    </div>
                    <ProviderServiceListCard model={variant.model} />
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
