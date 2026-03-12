import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  resetPasswordSchema,
  zodIssuesToFieldErrors,
  type ResetPasswordFormData,
} from "@/features/auth/types/resetPassword.validation";
import { authApi } from "@/features/auth/api/auth.api";
import { useAuth } from "@/features/auth";
import { toast } from "sonner";
import { validatePasswordStrength } from "@/features/auth/utils/passwordPolicy";
import { useAnalytics } from "@/hooks/useAnalytics";

export function useResetPassword() {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const { user, profile, getRedirectPath } = useAuth();
  const [formData, setFormData] = useState<ResetPasswordFormData>({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordStrength = validatePasswordStrength(formData.password).strength;

  // Show password form when user is logged in (e.g. via recovery link Supabase logs them in)
  const recoveryMode = Boolean(user);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrors({});
      setSubmitting(true);

      try {
        const result = resetPasswordSchema.safeParse(formData);
        if (!result.success) {
          setErrors(zodIssuesToFieldErrors(result.error.issues));
          setSubmitting(false);
          return;
        }

        const passwordValidation = validatePasswordStrength(formData.password);
        if (!passwordValidation.valid) {
          setErrors({
            password: passwordValidation.errors[0] ?? "Senha não atende aos requisitos de segurança.",
          });
          setSubmitting(false);
          return;
        }

        const { error } = await authApi.updateUserPassword(formData.password);

        if (error) {
          if (error.message.includes('New password should be different')) {
            setErrors({ password: 'A nova senha deve ser diferente da senha atual.' });
          } else {
            setErrors({ password: error.message });
          }

          setSubmitting(false);
          return;
        }

        toast.success("Senha alterada com sucesso!");
        trackEvent("reset_password_completed", { recovery_mode: recoveryMode });
        const path = profile ? getRedirectPath(profile) : "/login";
        navigate(path, { replace: true });
      } catch {
        toast.error("Erro ao alterar senha. Tente novamente.");
        setSubmitting(false);
      }
    },
    [formData, navigate, profile, getRedirectPath, recoveryMode, trackEvent]
  );

  return {
    recoveryMode,
    formData,
    setFormData,
    errors,
    submitting,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    passwordStrength,
    handleSubmit,
  };
}
