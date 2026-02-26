import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface FieldWithValidationProps {
  id: string;
  label?: string;
  required?: boolean;
  helpText?: string;
  error: string | null;
  hasError: boolean;
  hasSuccess?: boolean;
  children: ReactNode;
  /** Optional slot for unit or trailing icon, rendered after children (e.g. inside a relative container). */
  trailing?: ReactNode;
}

/**
 * Shared wrapper for form blocks: label, required asterisk, error/success message, help text.
 * Keeps a11y (aria-describedby, role="alert") and layout consistent across input-like blocks.
 */
export function FieldWithValidation({
  id,
  label,
  required,
  helpText,
  error,
  hasError,
  hasSuccess: _hasSuccess = false,
  children,
  trailing,
}: FieldWithValidationProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-foreground"
        >
          {label}
          {required && (
            <span className="text-destructive ml-1" aria-label="obrigatório">
              *
            </span>
          )}
        </label>
      )}
      <div className="relative">
        {children}
        {trailing}
      </div>
      {hasError && error && (
        <p
          id={`${id}-error`}
          className="text-xs text-destructive flex items-center gap-1 animate-in fade-in-0 slide-in-from-top-1"
          role="alert"
        >
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {helpText && !hasError && (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          {helpText}
        </p>
      )}
    </div>
  );
}
