import { useState, useMemo } from "react";
import { getPasswordStrengthDisplay } from "../utils/passwordPolicy";
import type { PasswordStrengthDisplay } from "../utils/passwordPolicy";

export interface UsePasswordFieldDisplayParams {
  password: string;
}

export interface UsePasswordFieldDisplayResult {
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (v: boolean) => void;
  passwordDisplay: PasswordStrengthDisplay;
}

export function usePasswordFieldDisplay({
  password,
}: UsePasswordFieldDisplayParams): UsePasswordFieldDisplayResult {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const passwordDisplay = useMemo(
    () => getPasswordStrengthDisplay(password),
    [password]
  );

  return {
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    passwordDisplay,
  };
}
