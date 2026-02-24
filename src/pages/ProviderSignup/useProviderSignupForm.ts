import { useState, useCallback } from "react";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { validatePasswordStrength } from "@/lib/passwordPolicy";
import {
  signUpSchema,
  zodIssuesToFieldErrors,
  type ProviderSignupFormData,
} from "./validation";

export const STEPS = [
  { title: "Seus Dados", description: "Informações básicas" },
  { title: "Segurança", description: "Crie sua senha" },
  { title: "Confirmação", description: "Revise e finalize" },
] as const;

const PROVIDER_ONBOARDING_PATH = "/onboarding/provider";

function getEmailRedirectTo(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${PROVIDER_ONBOARDING_PATH}`;
}

export function useProviderSignupForm() {
  const { signUp, signInWithGoogle } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState<ProviderSignupFormData>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep = useCallback(
    (step: number): boolean => {
      setErrors({});

      if (step === 0) {
        if (!formData.fullName || formData.fullName.length < 3) {
          setErrors({ fullName: "Nome deve ter no mínimo 3 caracteres" });
          return false;
        }
        if (
          !formData.email ||
          !z.string().email().safeParse(formData.email).success
        ) {
          setErrors({ email: "Email inválido" });
          return false;
        }
      }

      if (step === 1) {
        const passwordValidation = validatePasswordStrength(formData.password);
        if (!passwordValidation.valid) {
          setErrors({ password: passwordValidation.errors[0] });
          return false;
        }
        if (formData.password !== formData.confirmPassword) {
          setErrors({ confirmPassword: "As senhas não coincidem" });
          return false;
        }
      }

      return true;
    },
    [formData]
  );

  const handleNext = useCallback(() => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  }, [currentStep, validateStep]);

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleGoogleSignup = useCallback(async () => {
    try {
      setSubmitting(true);
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}${PROVIDER_ONBOARDING_PATH}`
          : undefined;
      await signInWithGoogle(redirectTo);
    } catch {
      setSubmitting(false);
    }
  }, [signInWithGoogle]);

  const handleSubmit = useCallback(async () => {
    if (!formData.termsAccepted) {
      setErrors({ termsAccepted: "Você deve aceitar os termos" });
      return;
    }

    const result = signUpSchema.safeParse(formData);
    if (!result.success) {
      setErrors(zodIssuesToFieldErrors(result.error.issues));
      return;
    }

    setSubmitting(true);
    try {
      await signUp(
        formData.email,
        formData.password,
        formData.fullName,
        "provider",
        { emailRedirectTo: getEmailRedirectTo() }
      );
      setSignupSuccess(true);
    } finally {
      setSubmitting(false);
    }
  }, [formData, signUp]);

  const passwordValidation = validatePasswordStrength(formData.password);

  return {
    formData,
    setFormData,
    errors,
    setErrors,
    currentStep,
    submitting,
    signupSuccess,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    validateStep,
    handleNext,
    handleBack,
    handleSubmit,
    handleGoogleSignup,
    passwordStrength: passwordValidation.strength,
  };
}
