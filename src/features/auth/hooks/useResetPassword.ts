import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  resetPasswordSchema,
  zodIssuesToFieldErrors,
  type ResetPasswordFormData,
} from "@/features/auth/types/resetPassword.validation";
import { authApi } from "@/features/auth/api/auth.api";
import { toast } from "sonner";
import { validatePasswordStrength } from "@/features/auth/utils/passwordPolicy";

export function useResetPassword() {
  const navigate = useNavigate();
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [formData, setFormData] = useState<ResetPasswordFormData>({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordStrength = validatePasswordStrength(formData.password).strength;

  useEffect(() => {
    const { unsubscribe } = authApi.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
      }
    });
    return unsubscribe;
  }, []);

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

        toast.success("Senha alterada com sucesso! Faça login com a nova senha.");
        navigate("/login", { replace: true });
      } catch {
        toast.error("Erro ao alterar senha. Tente novamente.");
        setSubmitting(false);
      }
    },
    [formData, navigate]
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
