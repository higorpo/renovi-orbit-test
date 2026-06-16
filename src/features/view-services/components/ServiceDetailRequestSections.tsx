import { Package, Wrench } from "lucide-react";
import type { FormSchema } from "@/features/dynamic-form";
import type { ServiceModel } from "../types/service.types";
import { FormResponsesSummary } from "./FormResponsesSummary";
import { ServicePhotoGallery } from "./ServicePhotoGallery";
import { SuggestedItemsInfo } from "./SuggestedItemsInfo";

interface ServiceDetailRequestSectionsProps {
  model: ServiceModel;
  suggestedEquipmentPt: string[];
  suggestedMaterialsPt: string[];
}

export function ServiceDetailRequestSections({
  model,
  suggestedEquipmentPt,
  suggestedMaterialsPt,
}: ServiceDetailRequestSectionsProps) {
  return (
    <>
      {model.description && (
        <div>
          <h3 className="text-sm font-semibold text-foreground">Descrição</h3>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {model.description}
          </p>
        </div>
      )}

      <FormResponsesSummary
        formData={model.formData}
        formSchema={model.formSchema as FormSchema | null}
      />

      {model.photoPaths.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Fotos ({model.photoPaths.length})
          </h3>
          <div className="mt-2">
            <ServicePhotoGallery photos={model.photoPaths} />
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
