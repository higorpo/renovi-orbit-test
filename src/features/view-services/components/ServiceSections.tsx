import { buildSummaryEntries } from "@/features/dynamic-form";
import type { FormSchema } from "@/features/dynamic-form";
import { ServicePhotoGallery } from "./ServicePhotoGallery";

interface ServiceSectionsProps {
  description: string | null;
  formData: Record<string, unknown> | null;
  formSchema: FormSchema | null;
  photos: string[];
}

export function ServiceSections({
  description,
  formData,
  formSchema,
  photos,
}: ServiceSectionsProps) {
  const entries = buildSummaryEntries(formData, formSchema);

  return (
    <div className="space-y-6">
      {description ? (
        <div>
          <h3 className="text-sm font-semibold text-foreground">Descrição</h3>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      ) : null}

      {entries.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Informações do pedido</h3>
          <dl className="grid gap-2 sm:grid-cols-2">
            {entries.map((entry) => (
              <div key={entry.id}>
                <div className="rounded-lg border bg-muted/30 px-3 py-2">
                  <dt className="text-xs font-medium text-muted-foreground">{entry.label}</dt>
                  <dd className="mt-0.5 text-sm text-foreground">{entry.displayValue}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {photos.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-foreground">Fotos ({photos.length})</h3>
          <div className="mt-2">
            <ServicePhotoGallery photos={photos} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
