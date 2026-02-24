import { useState, useEffect, useCallback } from "react";
import {
  signInSchema,
  zodIssuesToFieldErrors,
  type SignInFormData,
} from "./validation";
import { getPersistSession, setPersistSession } from "@/lib/auth/persistSession";

const SUBMITTING_RESET_DELAY_MS = 5000;

export interface UseLoginFormArgs {
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

export function useLoginForm({
  signIn,
  signInWithGoogle,
}: UseLoginFormArgs) {
  const [formData, setFormData] = useState<SignInFormData>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    setRememberMe(getPersistSession());
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrors({});
      setSubmitting(true);

      try {
        const result = signInSchema.safeParse(formData);
        if (!result.success) {
          setErrors(zodIssuesToFieldErrors(result.error.issues));
          setSubmitting(false);
          return;
        }

        setPersistSession(rememberMe);
        await signIn(formData.email, formData.password);
        setTimeout(() => setSubmitting(false), SUBMITTING_RESET_DELAY_MS);
      } catch {
        setSubmitting(false);
      }
    },
    [formData, rememberMe, signIn]
  );

  const handleGoogleLogin = useCallback(async () => {
    try {
      setSubmitting(true);
      setPersistSession(rememberMe);
      await signInWithGoogle();
    } catch {
      setSubmitting(false);
    }
  }, [signInWithGoogle, rememberMe]);

  return {
    formData,
    setFormData,
    errors,
    submitting,
    showPassword,
    setShowPassword,
    rememberMe,
    setRememberMe,
    handleSubmit,
    handleGoogleLogin,
  };
}
