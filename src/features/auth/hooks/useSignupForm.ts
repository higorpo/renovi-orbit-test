import { useState, useCallback } from "react";
import { z } from "zod";
import { useAuth } from "./useAuth";
import { executeRecaptcha, verifyRecaptchaToken, type RecaptchaAction } from "@/lib/recaptcha";
import { validatePasswordStrength } from "../utils/passwordPolicy";
import { usePasswordFieldDisplay } from "./usePasswordFieldDisplay";
import {
  signUpSchema,
  zodIssuesToFieldErrors,
  validateFullName,
  type SignupFormData,
} from "../types/signup.validation";

export const SIGNUP_STEPS = [
  { title: "Seus Dados", description: "Informações básicas" },
  { title: "Segurança", description: "Crie sua senha" },
  { title: "Confirmação", description: "Revise e finalize" },
] as const;

export interface UseSignupFormConfig {
  role: "client" | "provider";
  onboardingPath: string;
  recaptchaAction: RecaptchaAction;
}

export function useSignupForm({ role, onboardingPath, recaptchaAction }: UseSignupFormConfig) {
  const { signUp, signInWithGoogle } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [formData, setFormData] = useState<SignupFormData>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const {
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    passwordDisplay,
  } = usePasswordFieldDisplay({ password: formData.password });

  const getEmailRedirectTo = useCallback((): string => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${onboardingPath}`;
  }, [onboardingPath]);

  const validateStep = useCallback(
    (step: number): boolean => {
      setErrors({});

      if (step === 0) {
        const fullNameError = validateFullName(formData.fullName);
        if (fullNameError) {
          setErrors({ fullName: fullNameError });
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
      setCurrentStep((prev) => Math.min(prev + 1, SIGNUP_STEPS.length - 1));
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
          ? `${window.location.origin}${onboardingPath}`
          : undefined;
      await signInWithGoogle(redirectTo);
    } catch {
      setSubmitting(false);
    }
  }, [signInWithGoogle, onboardingPath]);

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
    const token = await executeRecaptcha(recaptchaAction);
    if (!token) {
      setErrors({ recaptcha: "Não foi possível validar o reCAPTCHA. Tente novamente." });
      setSubmitting(false);
      return;
    }

    const recaptchaCheck = await verifyRecaptchaToken(token, recaptchaAction);
    if (!recaptchaCheck.success) {
      setErrors({
        recaptcha:
          recaptchaCheck.message ?? "Falha na validação anti-bot. Tente novamente.",
      });
      setSubmitting(false);
      return;
    }

    try {
      const signUpResult = await signUp(
        formData.email,
        formData.password,
        formData.fullName,
        role,
        { emailRedirectTo: getEmailRedirectTo() }
      );
      if (signUpResult.success) setSignupSuccess(true);
    } finally {
      setSubmitting(false);
    }
  }, [formData, signUp, role, recaptchaAction, getEmailRedirectTo]);

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
    passwordDisplay,
    validateStep,
    handleNext,
    handleBack,
    handleSubmit,
    handleGoogleSignup,
    getEmailRedirectTo,
  };
}
