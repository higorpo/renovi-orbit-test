import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  respondClientBudgetQuestion,
  uploadQuestionResponseImages,
} from "../api/clientBudgets.api";

const MAX_IMAGES = 5;
const MAX_TEXT_LENGTH = 1000;

export function useQuestionResponseComposer(serviceRequestId: string, questionId: string) {
  const queryClient = useQueryClient();
  const [responseText, setResponseText] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => responseText.trim().length > 0 && !isSubmitting,
    [responseText, isSubmitting],
  );

  const onSelectImages = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const next = [...selectedImages, ...Array.from(fileList)];
    if (next.length > MAX_IMAGES) {
      toast.error(`Você pode anexar no máximo ${MAX_IMAGES} imagens.`);
      return;
    }
    setSelectedImages(next);
  };

  const removeImage = (index: number) => {
    setSelectedImages((current) => current.filter((_, i) => i !== index));
  };

  const submit = async () => {
    const trimmed = responseText.trim();
    if (!trimmed) {
      toast.error("Escreva uma resposta antes de enviar.");
      return false;
    }
    if (trimmed.length > MAX_TEXT_LENGTH) {
      toast.error(`A resposta deve ter no máximo ${MAX_TEXT_LENGTH} caracteres.`);
      return false;
    }

    setIsSubmitting(true);
    try {
      const uploadResult = await uploadQuestionResponseImages({
        serviceRequestId,
        questionId,
        files: selectedImages,
      });
      if (uploadResult.error) {
        toast.error(uploadResult.error);
        return false;
      }

      const result = await respondClientBudgetQuestion({
        questionId,
        response: trimmed,
        imagePaths: uploadResult.paths,
      });
      if (result.error) {
        toast.error(result.error);
        return false;
      }

      toast.success("Resposta enviada com sucesso.");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["client-budget-detail", serviceRequestId],
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: ["client-budget-questions"],
          refetchType: "active",
        }),
      ]);
      setResponseText("");
      setSelectedImages([]);
      return true;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    responseText,
    setResponseText,
    selectedImages,
    onSelectImages,
    removeImage,
    submit,
    isSubmitting,
    canSubmit,
    maxImages: MAX_IMAGES,
    maxTextLength: MAX_TEXT_LENGTH,
  };
}
