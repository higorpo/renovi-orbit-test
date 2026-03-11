import { useRef, useEffect, useCallback } from "react";
import { Loader2, Sparkles, Upload, Trash2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { RequestQuoteState } from "../../hooks/useRequestQuoteState";
import { useGenerateSmartDescription } from "../../hooks/useGenerateSmartDescription";
import { stableStringify } from "../../utils/stableStringify";

const MAX_DESCRIPTION_ATTEMPTS = 3;

export interface Step3DescriptionPhotosProps {
  state: RequestQuoteState;
  /** Ref held by parent so it persists when step 3 unmounts; avoids re-calling API when returning without editing. */
  step2DataSnapshotRef: React.MutableRefObject<string | null>;
}

export function Step3DescriptionPhotos({ state, step2DataSnapshotRef }: Step3DescriptionPhotosProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Attempt count for this mount; resets on unmount. Max 3 (1 initial + 2 retries). */
  const attemptCountRef = useRef(0);

  const onSuccessRef = useCallback(() => {
    step2DataSnapshotRef.current = stableStringify(state.step2Data);
  }, [state.step2Data, step2DataSnapshotRef]);

  const onFailureRef = useCallback(() => {
    if (attemptCountRef.current < MAX_DESCRIPTION_ATTEMPTS) {
      step2DataSnapshotRef.current = null;
    } else {
      step2DataSnapshotRef.current = stableStringify(state.step2Data);
    }
  }, [step2DataSnapshotRef, state.step2Data]);

  const { generateSmartDescription } = useGenerateSmartDescription({
    state,
    onSuccess: onSuccessRef,
    onFailure: onFailureRef,
  });

  const { description, photoPreviews } = state.step3Data;
  const generatingDescription = state.generatingDescription;

  const onDescriptionChange = (value: string) => {
    state.setStep3Data((prev) => ({ ...prev, description: value }));
  };

  const processFiles = useCallback(
    (newFiles: File[]) => {
      if (!newFiles.length) return;
      const allPhotos = [...state.step3Data.photos, ...newFiles];
      const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
      const allPreviews = [...state.step3Data.photoPreviews, ...newPreviews];
      state.setStep3Data((prev) => ({ ...prev, photos: allPhotos, photoPreviews: allPreviews }));
    },
    [state]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    processFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    processFiles(Array.from(e.dataTransfer.files ?? []));
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleRemovePhoto = (index: number) => {
    state.setStep3Data((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
      photoPreviews: prev.photoPreviews.filter((_, i) => i !== index),
    }));
  };

  // Regenerate description only when entering step 3 FROM step 2 (details) and step2 form data changed.
  // When coming from step 4 (address), do nothing. Max 3 attempts per mount (1 initial + 2 retries); resets on unmount.
  useEffect(() => {
    if (state.currentStep !== 3 || state.previousStep !== 2) return;
    if (state.generatingDescription) return;
    const step2Key = stableStringify(state.step2Data);
    if (step2DataSnapshotRef.current === step2Key) return;

    if (attemptCountRef.current >= MAX_DESCRIPTION_ATTEMPTS) {
      step2DataSnapshotRef.current = step2Key;
      return;
    }

    attemptCountRef.current += 1;
    step2DataSnapshotRef.current = step2Key;
    generateSmartDescription();
  }, [
    state.currentStep,
    state.previousStep,
    state.step2Data,
    state.generatingDescription,
    generateSmartDescription,
    step2DataSnapshotRef,
  ]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-primary mb-3 sm:mb-4 md:mb-6">
        Descrição e Fotos
      </h1>

      {generatingDescription ? (
        <div className="flex flex-col items-center justify-center py-8 sm:py-12">
          <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 text-accent animate-spin mb-3 sm:mb-4" />
          <p className="text-muted-foreground text-sm sm:text-base">✨ Gerando descrição profissional...</p>
        </div>
      ) : (
        <>
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
              <Label className="text-sm sm:text-base">
                Descrição do Serviço
                <span className="text-muted-foreground text-xs sm:text-sm ml-0 sm:ml-2 block sm:inline mt-0.5 sm:mt-0">
                  (Gerada automaticamente, edite se necessário)
                </span>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  toast.info("Você pode escrever manualmente.");
                  state.setGeneratingDescription(false);
                }}
                className="text-xs w-full sm:w-auto shrink-0"
              >
                <Sparkles className="h-3 w-3 mr-1 shrink-0" />
                Pular IA e escrever
              </Button>
            </div>
            <Textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="min-h-[100px] sm:min-h-[120px] text-sm sm:text-base"
              placeholder="A descrição será gerada automaticamente, ou você pode escrever manualmente..."
            />
          </div>

          <div>
            <Label className="text-sm sm:text-base mb-2 block">Fotos (Opcional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-border rounded-lg sm:rounded-xl p-4 sm:p-6 md:p-8 text-center hover:border-accent/50 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 sm:gap-3"
            >
              <Upload className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground shrink-0" />
              <p className="text-muted-foreground text-sm sm:text-base">Clique ou arraste e solte fotos aqui</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                PNG, JPG até 10MB cada (otimizamos automaticamente)
              </p>
            </div>

            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 mt-3 sm:mt-4">
                {photoPreviews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-24 sm:h-32 object-cover rounded-lg border border-border"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(index)}
                      className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-red-500 text-white p-1 sm:p-1.5 rounded-full opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center touch-manipulation"
                    >
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photoPreviews.length === 0 && (
              <div className="flex items-center gap-2 mt-2 sm:mt-3 text-[10px] sm:text-xs text-muted-foreground">
                <ImageIcon className="w-4 h-4" />
                <span>Adicionar fotos ajuda os profissionais a enviarem orçamentos mais precisos.</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
