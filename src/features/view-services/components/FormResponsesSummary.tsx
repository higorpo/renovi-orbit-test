import { buildSummaryEntries } from "@/features/dynamic-form";
import type { FormSchema } from "@/features/dynamic-form";

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
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">
        Informações do pedido
      </h3>
      <dl className="grid gap-2 sm:grid-cols-2">
        {entries.map((entry) => (
          <div key={entry.id}>
            <div className="rounded-lg border bg-muted/30 px-3 py-2">
              <dt className="text-xs font-medium text-muted-foreground">
                {entry.label}
              </dt>
              <dd className="mt-0.5 text-sm text-foreground">
                {entry.displayValue}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
