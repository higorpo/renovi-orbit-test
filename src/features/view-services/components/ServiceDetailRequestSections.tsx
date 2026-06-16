import { Package, Wrench } from "lucide-react";
import type { FormSchema } from "@/features/dynamic-form";
import type { ServiceModel } from "../types/service.types";
import { FormResponsesSummary } from "./FormResponsesSummary";
import { ServiceDetailSection } from "./ServiceDetailSection";
import { ServicePhotoGallery } from "./ServicePhotoGallery";
import { SuggestedItemsInfo } from "./SuggestedItemsInfo";

const suggestedItemClassName =
  "inline-flex items-center gap-1.5 rounded-sm border border-border bg-canvas-soft px-2.5 py-1 text-xs text-body";

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
    <div className="space-y-4">
      {model.description ? (
        <ServiceDetailSection title="Descrição">
          <p className="whitespace-pre-wrap text-caption leading-relaxed text-body">
            {model.description}
          </p>
        </ServiceDetailSection>
      ) : null}

      <FormResponsesSummary
        formData={model.formData}
        formSchema={model.formSchema as FormSchema | null}
      />

      {model.photoPaths.length > 0 ? (
        <ServiceDetailSection
          title={`Fotos (${model.photoPaths.length})`}
          description="Toque para ampliar"
        >
          <ServicePhotoGallery photos={model.photoPaths} />
        </ServiceDetailSection>
      ) : null}

      {suggestedEquipmentPt.length > 0 ? (
        <ServiceDetailSection
          title="Equipamentos que podem ser úteis"
          titleAccessory={
            <SuggestedItemsInfo ariaLabel="Mais informações sobre equipamentos sugeridos" />
          }
        >
          <div className="flex flex-wrap gap-2">
            {suggestedEquipmentPt.map((eq) => (
              <span key={eq} className={suggestedItemClassName}>
                <Wrench className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                {eq}
              </span>
            ))}
          </div>
        </ServiceDetailSection>
      ) : null}

      {suggestedMaterialsPt.length > 0 ? (
        <ServiceDetailSection
          title="Materiais que podem ser úteis"
          titleAccessory={
            <SuggestedItemsInfo ariaLabel="Mais informações sobre materiais sugeridos" />
          }
        >
          <div className="flex flex-wrap gap-2">
            {suggestedMaterialsPt.map((mat) => (
              <span key={mat} className={suggestedItemClassName}>
                <Package className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                {mat}
              </span>
            ))}
          </div>
        </ServiceDetailSection>
      ) : null}
    </div>
  );
}
