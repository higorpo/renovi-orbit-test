import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

export type ScoreDimensionKey =
  | "quality"
  | "punctuality"
  | "communication"
  | "value";

export const SCORE_DIMENSION_LABELS: Record<ScoreDimensionKey, string> = {
  quality: "Qualidade",
  punctuality: "Pontualidade",
  communication: "Comunicação",
  value: "Custo-benefício",
};

export type ScoreDimensionPickerProps = {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
  name: string;
};

export function ScoreDimensionPicker({
  label,
  value,
  onChange,
  disabled = false,
  name,
}: ScoreDimensionPickerProps) {
  return (
    <div className="space-y-2" data-testid={`score-dimension-${name}`}>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex items-center gap-1"
      >
        {[1, 2, 3, 4, 5].map((score) => {
          const selected = value === score;
          const filled = value !== null && score <= value;
          return (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${score} de 5`}
              disabled={disabled}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                "disabled:opacity-50 disabled:pointer-events-none",
                filled
                  ? "text-amber-500"
                  : "text-muted-foreground/40 hover:text-amber-400",
              )}
              onClick={() => onChange(score)}
            >
              <Star
                className={cn("h-6 w-6", filled && "fill-current")}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
