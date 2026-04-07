import { useState, useCallback } from "react";
import {
  forgotPasswordSchema,
  zodIssuesToFieldErrors,
  type ForgotPasswordFormData,
} from "../types/forgotPassword.validation";
import { authApi } from "../api/auth.api";
import { toast } from "sonner";
import { useAnalytics } from "@/hooks/useAnalytics";
import { addBreadcrumb, metrics } from "@/lib/sentry";
import { logger } from "@/lib/logger";

const REDIRECT_PATH = "/recuperar-senha";

export function useForgotPasswordForm() {
  const { trackEvent } = useAnalytics();
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
          logger.warn("auth_forgot_password_api_error", {
            error: error.message,
          });
          setErrors({
            email: "Não foi possível enviar o email. Verifique o endereço ou tente novamente.",
          });
          setSubmitting(false);
          return;
        }

        addBreadcrumb({ message: "auth.password_reset_requested", data: { email: formData.email } });
        metrics.count("auth.password_reset_requested", 1);
        setSent(true);
        trackEvent("forgot_password_requested");
        toast.success("Email enviado! Verifique sua caixa de entrada.");
      } catch {
        addBreadcrumb({ message: "auth.password_reset_request_failed", level: "error" });
        toast.error("Erro ao processar solicitação");
      } finally {
        setSubmitting(false);
      }
    },
    [formData, trackEvent]
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
