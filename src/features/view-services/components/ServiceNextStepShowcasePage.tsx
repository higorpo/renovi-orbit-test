import { useMemo } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ServiceNextStepCard } from "./ServiceNextStepCard";
import {
  buildServiceNextStepShowcaseVariants,
  type ServiceNextStepShowcaseVariant,
} from "../utils/serviceNextStepShowcaseFixtures";

const SHOWCASE_GROUPS = ["Cliente", "Prestador", "Estados"] as const;

function groupVariants(
  variants: ServiceNextStepShowcaseVariant[],
): Map<string, ServiceNextStepShowcaseVariant[]> {
  const grouped = new Map<string, ServiceNextStepShowcaseVariant[]>();

  for (const group of SHOWCASE_GROUPS) {
    grouped.set(
      group,
      variants.filter((variant) => variant.group === group),
    );
  }

  return grouped;
}

export function ServiceNextStepShowcasePage() {
  const variants = useMemo(() => buildServiceNextStepShowcaseVariants(), []);
  const groupedVariants = useMemo(() => groupVariants(variants), [variants]);

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8 pb-16">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-10">
        <header className="space-y-2">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            Dev only
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Service Next Step Card — Showcase
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Todas as variantes do card “Próximo passo” da detalhe do serviço (cliente,
            prestador e estados disabled).
          </p>
          <p className="font-mono text-[11px] text-muted-foreground/80">
            /dev/demo/service-next-step-showcase
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
                        id: {variant.id} · intent: {variant.step.intent}
                      </p>
                    </div>
                    <ServiceNextStepCard
                      step={variant.step}
                      disabled={variant.disabled}
                      onAction={() =>
                        toast.message(`CTA: ${variant.step.actionLabel}`, {
                          description: variant.id,
                        })
                      }
                    />
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
