import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ClientServiceListCard } from "./ClientServiceListCard";
import {
  buildClientServiceCardShowcaseVariants,
  type ClientServiceCardShowcaseVariant,
} from "../../utils/clientServiceCardShowcaseFixtures";

const SHOWCASE_GROUPS = [
  "Negociação",
  "Em andamento",
  "Concluídos",
  "Cancelados",
] as const;

function groupVariants(
  variants: ClientServiceCardShowcaseVariant[],
): Map<string, ClientServiceCardShowcaseVariant[]> {
  const grouped = new Map<string, ClientServiceCardShowcaseVariant[]>();

  for (const group of SHOWCASE_GROUPS) {
    grouped.set(
      group,
      variants.filter((variant) => variant.group === group),
    );
  }

  return grouped;
}

export function ClientServiceCardShowcasePage() {
  const variants = useMemo(() => buildClientServiceCardShowcaseVariants(), []);
  const groupedVariants = useMemo(() => groupVariants(variants), [variants]);

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8 pb-16">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-10">
        <header className="space-y-2">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            Dev only
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Client Service Card — Showcase
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Variantes do card do cliente em Meus Serviços, incluindo múltiplos orçamentos e
            conversas por pedido.
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
                    <ClientServiceListCard model={variant.model} />
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
