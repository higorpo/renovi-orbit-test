import { buildSummaryEntries } from "@/features/dynamic-form";
import type { FormSchema } from "@/features/dynamic-form";
import { ServiceDetailSection } from "./ServiceDetailSection";

export interface FormResponsesSummaryProps {
  formData: Record<string, unknown> | null;
  formSchema: FormSchema | null;
}

export function FormResponsesSummary({
  formData,
  formSchema,
}: FormResponsesSummaryProps) {
  const entries = buildSummaryEntries(formData, formSchema);
  if (entries.length === 0) return null;

  return (
    <ServiceDetailSection title="Informações do pedido">
      <dl className="grid gap-3 sm:grid-cols-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="rounded-md border border-border/80 bg-canvas-soft px-3 py-2.5"
          >
            <dt className="text-xs font-medium text-muted-foreground">{entry.label}</dt>
            <dd className="mt-0.5 text-caption text-ink">{entry.displayValue}</dd>
          </div>
        ))}
      </dl>
    </ServiceDetailSection>
  );
}
