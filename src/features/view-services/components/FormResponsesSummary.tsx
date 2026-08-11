import type { SummaryEntry } from "@/features/dynamic-form";
import { buildSummaryEntries } from "@/features/dynamic-form";
import type { FormSchema } from "@/features/dynamic-form";
import { cn } from "@/lib/utils";
import {
  getFormResponseIcon,
  isFormResponseFullWidth,
} from "../utils/formResponsePresentation";
import { ServiceDetailSection } from "./ServiceDetailSection";

export interface FormResponsesSummaryProps {
  formData: Record<string, unknown> | null;
  formSchema: FormSchema | null;
}

function FormResponseCard({ entry, index }: { entry: SummaryEntry; index: number }) {
  const Icon = getFormResponseIcon(entry.type);
  const fullWidth = isFormResponseFullWidth(entry.type);

  return (
    <div
      className={cn(
        "flex h-full min-w-0 items-start gap-3 rounded-lg border border-border bg-background px-3.5 py-3",
        "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300",
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground"
        aria-hidden
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium leading-none text-muted-foreground">{entry.label}</p>
        <p
          className={cn(
            "mt-1.5 text-sm font-semibold leading-snug text-ink",
            fullWidth ? "whitespace-pre-wrap" : "line-clamp-3",
          )}
        >
          {entry.displayValue}
        </p>
      </div>
    </div>
  );
}

export function FormResponsesSummary({
  formData,
  formSchema,
}: FormResponsesSummaryProps) {
  const entries = buildSummaryEntries(formData, formSchema);
  if (entries.length === 0) return null;

  return (
    <ServiceDetailSection title="Informações do pedido">
      <div className="grid gap-2.5 sm:grid-cols-2" role="list">
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            role="listitem"
            className={cn(isFormResponseFullWidth(entry.type) && "sm:col-span-2")}
          >
            <FormResponseCard entry={entry} index={index} />
          </div>
        ))}
      </div>
    </ServiceDetailSection>
  );
}
