import { useState, useCallback } from "react";
import {
  forgotPasswordSchema,
  zodIssuesToFieldErrors,
  type ForgotPasswordFormData,
} from "./validation";
import { authApi } from "@/lib/api/auth.api";
import { toast } from "sonner";

const REDIRECT_PATH = "/recuperar-senha";

export function useForgotPasswordForm() {
  const [formData, setFormData] = useState<ForgotPasswordFormData>({
    email: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrors({});
      setSubmitting(true);

      try {
        const result = forgotPasswordSchema.safeParse(formData);
        if (!result.success) {
          setErrors(zodIssuesToFieldErrors(result.error.issues));
          setSubmitting(false);
          return;
        }

        const redirectTo =
          typeof window !== "undefined"
            ? `${window.location.origin}${REDIRECT_PATH}`
            : "";

        const { error } = await authApi.resetPasswordForEmail(
          formData.email,
          redirectTo
        );

        if (error) {
          setErrors({ email: error.message });
          setSubmitting(false);
          return;
        }

        setSent(true);
        toast.success("Email enviado! Verifique sua caixa de entrada.");
      } catch {
        toast.error("Erro ao processar solicitação");
      } finally {
        setSubmitting(false);
      }
    },
    [formData]
  );

  return {
    formData,
    setFormData,
    errors,
    submitting,
    sent,
    handleSubmit,
  };
}
