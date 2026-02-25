/**
 * Time block — native time input (HH:mm).
 */

import { cn } from "@/lib/utils";
import type { FormBlockV2 } from "../../types";
import { Input } from "@/components/ui/input";
import {
  useFieldValidation,
  getValidationErrorMessage,
} from "../../hooks/useFieldValidation";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface TimeBlockProps {
  block: FormBlockV2;
  value: string | undefined;
  onChange: (value: string) => void;
}

export function TimeBlock({
  block,
  value,
  onChange,
}: TimeBlockProps) {
  const { validation, markAsTouched } = useFieldValidation({
    block,
    value,
    validateOnChange: true,
  });

  const errorMessage = getValidationErrorMessage(block, validation.error);
  const hasError = validation.touched && validation.state === "invalid";
  const hasSuccess = validation.touched && validation.state === "valid" && value;

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
          type="time"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || "")}
          onBlur={markAsTouched}
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
      </div>
      {hasError && errorMessage && (
        <p
          id={`${block.id}-error`}
          className="text-xs text-destructive flex items-center gap-1"
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
