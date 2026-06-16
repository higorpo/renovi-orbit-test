import { Check, ChevronDown, Lightbulb } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const COMPARISON_TIPS = [
  {
    title: "Experiência do profissional",
    description: "Avalie a reputação, avaliações e clareza na comunicação — não só o valor.",
  },
  {
    title: "Escopo e detalhes do orçamento",
    description: "Compare o que está incluso, materiais, prazo e garantias descritos na proposta.",
  },
  {
    title: "Custo-benefício, não só preço",
    description: "O menor valor pode omitir etapas importantes. O ideal combina qualidade e transparência.",
  },
] as const;

interface BudgetCompareGuidancePanelProps {
  className?: string;
}

export function BudgetCompareGuidancePanel({ className }: BudgetCompareGuidancePanelProps) {
  return (
    <Collapsible
      defaultOpen
      className={cn(
        "overflow-hidden rounded-2xl border border-primary/15 bg-primary/[0.04]",
        className,
      )}
    >
      <CollapsibleTrigger className="group flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-primary/[0.06]">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lightbulb className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            Como escolher o melhor orçamento?
          </span>
          <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
            Nem sempre o preço mais baixo é a melhor escolha. Veja o que avaliar antes de decidir.
          </span>
        </span>
        <ChevronDown
          className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-primary/10 px-4 pb-4 pt-3">
        <ul className="space-y-3">
          {COMPARISON_TIPS.map((tip) => (
            <li key={tip.title} className="flex gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{tip.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  {tip.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
