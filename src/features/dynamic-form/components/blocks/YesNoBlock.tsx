import { cn } from "@/lib/utils";
import type { FormBlockV2 } from "../../types";
import { useFieldValidation, getValidationErrorMessage } from "../../hooks/useFieldValidation";
import { Check, AlertCircle } from "lucide-react";

interface YesNoBlockProps {
  block: FormBlockV2;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
}

export function YesNoBlock({ block, value, onChange }: YesNoBlockProps) {
  const { validation, markAsTouched } = useFieldValidation({
    block,
    value,
    validateOnChange: false,
  });

  const errorMessage = getValidationErrorMessage(block, validation.error);
  const hasError = validation.touched && validation.state === "invalid";
  const hasSuccess = validation.touched && validation.state === "valid" && value !== undefined;

  const handleSelect = (optionValue: boolean) => {
    onChange(optionValue);
    if (!validation.touched) setTimeout(() => markAsTouched(), 0);
  };

  return (
    <div className="space-y-3">
      {block.label && (
        <label
          htmlFor={`${block.id}-group`}
          className="block text-sm font-medium text-foreground"
        >
          {block.label}
          {block.required && (
            <span className="text-destructive ml-1" aria-label="obrigatório">
              *
            </span>
          )}
        </label>
      )}
      {block.helpText && (
        <p id={`${block.id}-help`} className="text-sm text-muted-foreground">
          {block.helpText}
        </p>
      )}
      <div
        id={`${block.id}-group`}
        role="radiogroup"
        aria-invalid={hasError}
        aria-required={block.required}
        aria-describedby={
          hasError
            ? `${block.id}-error`
            : block.helpText
              ? `${block.id}-help`
              : undefined
        }
        className="grid grid-cols-2 gap-3"
      >
        <button
          type="button"
          role="radio"
          aria-checked={value === true}
          onClick={() => handleSelect(true)}
          onBlur={markAsTouched}
          className={cn(
            "relative flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
            "hover:border-primary/50 hover:bg-primary/5",
            "focus:outline-none focus:ring-2 focus:ring-primary/30",
            value === true
              ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20"
              : "border-border bg-card",
            hasError && value !== true && "border-destructive/30"
          )}
        >
          {value === true && (
            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-3 h-3 text-primary-foreground" />
            </div>
          )}
          <span
            className={cn(
              "font-medium text-sm",
              value === true ? "text-primary" : "text-foreground"
            )}
          >
            Sim
          </span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={value === false}
          onClick={() => handleSelect(false)}
          onBlur={markAsTouched}
          className={cn(
            "relative flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
            "hover:border-primary/50 hover:bg-primary/5",
            "focus:outline-none focus:ring-2 focus:ring-primary/30",
            value === false
              ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20"
              : "border-border bg-card",
            hasError && value !== false && "border-destructive/30"
          )}
        >
          {value === false && (
            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-3 h-3 text-primary-foreground" />
            </div>
          )}
          <span
            className={cn(
              "font-medium text-sm",
              value === false ? "text-primary" : "text-foreground"
            )}
          >
            Não
          </span>
        </button>
      </div>
      {hasError && errorMessage && (
        <p
          id={`${block.id}-error`}
          className="text-xs text-destructive flex items-center gap-1 animate-in fade-in-0 slide-in-from-top-1"
          role="alert"
        >
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span>{errorMessage}</span>
        </p>
      )}
      {hasSuccess && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <Check className="w-3 h-3" />
          <span>Seleção válida</span>
        </p>
      )}
    </div>
  );
}
