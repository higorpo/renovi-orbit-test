import type { FormSchema } from "../types/provider-jobs.types";

export interface FormResponsesSummaryProps {
  formData: Record<string, unknown> | null;
  formSchema: FormSchema | null;
}

function resolveLabel(fieldId: string, schema: FormSchema | null): string {
  if (!schema?.fields) return fieldId;
  const field = schema.fields.find((f) => f.id === fieldId);
  return field?.label ?? fieldId;
}

function resolveOptionLabel(
  value: unknown,
  fieldId: string,
  schema: FormSchema | null,
): string {
  if (!schema?.fields) return String(value);
  const field = schema.fields.find((f) => f.id === fieldId);
  if (!field?.options) return String(value);

  if (Array.isArray(value)) {
    return value
      .map((v) => {
        const opt = field.options!.find((o) => o.value === v);
        return opt?.label ?? String(v);
      })
      .join(", ");
  }

  const opt = field.options.find((o) => o.value === value);
  return opt?.label ?? String(value);
}

function formatValue(
  value: unknown,
  fieldId: string,
  schema: FormSchema | null,
): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (Array.isArray(value)) return resolveOptionLabel(value, fieldId, schema);
  if (typeof value === "string") return resolveOptionLabel(value, fieldId, schema);
  if (typeof value === "number") return String(value);
  return String(value);
}

export function FormResponsesSummary({
  formData,
  formSchema,
}: FormResponsesSummaryProps) {
  if (!formData || Object.keys(formData).length === 0) return null;

  const entries = Object.entries(formData).filter(
    ([, v]) => v != null && v !== "",
  );
  if (entries.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">
        Informações do pedido
      </h3>
      <dl className="grid gap-2 sm:grid-cols-2">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className="rounded-lg border bg-muted/30 px-3 py-2"
          >
            <dt className="text-xs font-medium text-muted-foreground">
              {resolveLabel(key, formSchema)}
            </dt>
            <dd className="mt-0.5 text-sm text-foreground">
              {formatValue(value, key, formSchema)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
