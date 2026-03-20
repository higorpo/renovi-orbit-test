import { Package, Tag, Wrench } from "lucide-react";
import type { ProviderJobItem } from "../types/provider-jobs.types";
import { FormResponsesSummary } from "./FormResponsesSummary";
import { JobDetailPhotoGallery } from "./JobDetailPhotoGallery";
import { SuggestedItemsInfo } from "./SuggestedItemsInfo";

interface JobDetailRequestSectionsProps {
  job: ProviderJobItem;
  suggestedEquipmentPt: string[];
  suggestedMaterialsPt: string[];
}

export function JobDetailRequestSections({
  job,
  suggestedEquipmentPt,
  suggestedMaterialsPt,
}: JobDetailRequestSectionsProps) {
  return (
    <>
      {job.description && (
        <div>
          <h3 className="text-sm font-semibold text-foreground">Descrição</h3>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {job.description}
          </p>
        </div>
      )}

      <FormResponsesSummary formData={job.form_data} formSchema={job.form_schema} />

      {job.photos && job.photos.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground">Fotos ({job.photos.length})</h3>
          <div className="mt-2">
            <JobDetailPhotoGallery photos={job.photos} />
          </div>
        </div>
      )}

      {job.tags && job.tags.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground">Tags</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {job.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                <Tag className="h-3 w-3" aria-hidden />
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {suggestedEquipmentPt.length > 0 && (
        <div>
          <div className="flex items-center">
            <h3 className="text-sm font-semibold text-foreground">
              Equipamentos que podem ser úteis
            </h3>
            <SuggestedItemsInfo ariaLabel="Mais informações sobre equipamentos sugeridos" />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {suggestedEquipmentPt.map((eq) => (
              <span
                key={eq}
                className="inline-flex items-center gap-1 rounded-full border bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
              >
                <Wrench className="h-3 w-3" aria-hidden />
                {eq}
              </span>
            ))}
          </div>
        </div>
      )}

      {suggestedMaterialsPt.length > 0 && (
        <div>
          <div className="flex items-center">
            <h3 className="text-sm font-semibold text-foreground">
              Materiais que podem ser úteis
            </h3>
            <SuggestedItemsInfo ariaLabel="Mais informações sobre materiais sugeridos" />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {suggestedMaterialsPt.map((mat) => (
              <span
                key={mat}
                className="inline-flex items-center gap-1 rounded-full border bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
              >
                <Package className="h-3 w-3" aria-hidden />
                {mat}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
