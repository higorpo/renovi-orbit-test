import { useCallback, useState } from "react";
import { toast } from "sonner";
import { createProviderJobQuestion } from "../api/providerJobQuestions.api";

const MAX_QUESTION_LENGTH = 1000;

interface OpenComposerOptions {
  prefilledQuestion?: string;
}

export function useProviderJobQuestionComposer(serviceRequestId: string) {
  const [isOpen, setIsOpen] = useState(false);
  const [questionDraft, setQuestionDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openComposer = useCallback((options?: OpenComposerOptions) => {
    setQuestionDraft(options?.prefilledQuestion?.trim() ?? "");
    setIsOpen(true);
  }, []);

  const closeComposer = useCallback(() => {
    if (isSubmitting) return;
    setIsOpen(false);
    setQuestionDraft("");
  }, [isSubmitting]);

  const submitQuestion = useCallback(async (): Promise<boolean> => {
    const cleanQuestion = questionDraft.trim();
    if (!cleanQuestion) {
      toast.error("Escreva uma pergunta antes de enviar.");
      return false;
    }

    if (cleanQuestion.length > MAX_QUESTION_LENGTH) {
      toast.error(`A pergunta deve ter no máximo ${MAX_QUESTION_LENGTH} caracteres.`);
      return false;
    }

    setIsSubmitting(true);
    try {
      const { error } = await createProviderJobQuestion({
        serviceRequestId,
        question: cleanQuestion,
      });

      if (error) {
        if (error.includes("Question limit reached")) {
          toast.error("Você já atingiu o limite de 3 perguntas para este pedido.");
          return false;
        }
        toast.error(error);
        return false;
      }

      toast.success("Pergunta enviada com sucesso.");
      setIsOpen(false);
      setQuestionDraft("");
      return true;
    } finally {
      setIsSubmitting(false);
    }
  }, [questionDraft, serviceRequestId]);

  return {
    isOpen,
    isSubmitting,
    questionDraft,
    setQuestionDraft,
    openComposer,
    closeComposer,
    submitQuestion,
    maxQuestionLength: MAX_QUESTION_LENGTH,
  };
}
