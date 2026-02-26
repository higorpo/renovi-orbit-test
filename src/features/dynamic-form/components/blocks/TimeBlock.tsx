/**
 * Time block — native time input (HH:mm).
 */

import { cn } from "@/lib/utils";
import type { FormBlock } from "../../types";
import { Input } from "@/components/ui/input";
import {
  useFieldValidation,
  getValidationErrorMessage,
} from "../../hooks/useFieldValidation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { FieldWithValidation } from "../FieldWithValidation";

interface TimeBlockProps {
  block: FormBlock;
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
  const hasError = Boolean(validation.touched && validation.state === "invalid");
  const hasSuccess = Boolean(validation.touched && validation.state === "valid" && value);

  const trailing = (
    <>
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
    </>
  );

  return (
    <FieldWithValidation
      id={block.id}
      label={block.label}
      required={block.required}
      helpText={block.helpText}
      error={errorMessage}
      hasError={hasError}
      hasSuccess={hasSuccess}
      trailing={trailing}
    >
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
          hasSuccess && "border-green-500/50 focus-visible:ring-green-500/30",
          !hasError && !hasSuccess && "border-border"
        )}
      />
    </FieldWithValidation>
  );
}
