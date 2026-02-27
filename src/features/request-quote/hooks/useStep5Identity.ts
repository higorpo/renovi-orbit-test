import { useState, useMemo } from "react";
import { getPasswordStrengthDisplay } from "@/features/auth";
import type { Step5Data } from "../components/RequestQuote/schemas";

export interface UseStep5IdentityParams {
  data: Step5Data;
}

export interface UseStep5IdentityResult {
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (v: boolean) => void;
  passwordDisplay: ReturnType<typeof getPasswordStrengthDisplay>;
}

export function useStep5Identity({ data }: UseStep5IdentityParams): UseStep5IdentityResult {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const passwordDisplay = useMemo(
    () => getPasswordStrengthDisplay(data.password),
    [data.password]
  );

  return {
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    passwordDisplay,
  };
}
