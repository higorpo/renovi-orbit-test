import { Check, Shield, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const TRUST_ITEMS = [
  {
    icon: Shield,
    title: "Pagamento protegido",
    description: "O prestador só recebe após você aprovar o serviço realizado conforme escopo acordado.",
  },
  {
    icon: Check,
    title: "Profissionais verificados",
    description: "Prestadores passam por checagem antes de atender na plataforma.",
  },
  {
    icon: Star,
    title: "Suporte Prestway",
    description: "Nossa equipe acompanha a negociação quando você precisar de ajuda.",
  },
] as const;

interface BudgetCompareTrustPanelProps {
  className?: string;
}

export function BudgetCompareTrustPanel({ className }: BudgetCompareTrustPanelProps) {
  return (
    <section
      aria-label="Segurança Prestway"
      className={cn(
        "rounded-2xl border border-border/80 bg-muted/20 px-4 py-3.5",
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Sua segurança na Prestway
      </p>
      <ul className="mt-3 space-y-3">
        {TRUST_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.title} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-primary shadow-sm">
                <Icon
                  className={cn(
                    "h-4 w-4",
                    item.icon === Star && "fill-amber-400 text-amber-500",
                  )}
                  strokeWidth={item.icon === Star ? 1.5 : 2}
                  aria-hidden
                />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
