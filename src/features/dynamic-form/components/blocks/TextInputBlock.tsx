import { cn } from "@/lib/utils";
import type { FormBlock } from "../../types";
import { Input } from "@/components/ui/input";
import {
  useFieldValidation,
  getValidationErrorMessage,
} from "../../hooks/useFieldValidation";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface TextInputBlockProps {
  block: FormBlock;
  value: string | undefined;
  onChange: (value: string) => void;
}

export function TextInputBlock({
  block,
  value,
  onChange,
}: TextInputBlockProps) {
  const { validation, markAsTouched } = useFieldValidation({
    block,
    value,
    validateOnChange: true,
  });

  const errorMessage = getValidationErrorMessage(block, validation.error);
  const hasError = validation.touched && validation.state === "invalid";
  const hasSuccess = validation.touched && validation.state === "valid" && value;

  const inputType = (block.config?.inputType as string) ?? "text";
  const inputMode = (block.config?.inputMode as string) ?? "text";

  return (
    <div className="space-y-2">
      {block.label && (
        <label
          htmlFor={block.id}
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
      <div className="relative">
        <Input
          id={block.id}
          type={inputType}
          inputMode={inputMode as React.HTMLAttributes<HTMLInputElement>["inputMode"]}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={markAsTouched}
          placeholder={block.placeholder as string | undefined}
          aria-invalid={hasError}
          aria-describedby={
            hasError
              ? `${block.id}-error`
              : block.helpText
                ? `${block.id}-help`
                : undefined
          }
          aria-required={block.required}
          className={cn(
            "transition-all",
            hasError && "border-destructive focus-visible:ring-destructive",
            hasSuccess &&
              "border-green-500/50 focus-visible:ring-green-500/30",
            !hasError && !hasSuccess && "border-border"
          )}
        />
        {hasError && (
          <AlertCircle
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-destructive"
            aria-hidden
          />
        )}
        {hasSuccess && (
          <CheckCircle2
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500"
            aria-hidden
          />
        )}
        {block.unit && !hasError && !hasSuccess && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {block.unit}
          </span>
        )}
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
      {block.helpText && !hasError && (
        <p id={`${block.id}-help`} className="text-xs text-muted-foreground">
          {block.helpText}
        </p>
      )}
    </div>
  );
}
