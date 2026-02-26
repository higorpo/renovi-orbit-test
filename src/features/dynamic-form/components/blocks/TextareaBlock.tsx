import { cn } from "@/lib/utils";
import type { FormBlock } from "../../types";
import { Textarea } from "@/components/ui/textarea";
import {
  useFieldValidation,
  getValidationErrorMessage,
} from "../../hooks/useFieldValidation";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface TextareaBlockProps {
  block: FormBlock;
  value: string | undefined;
  onChange: (value: string) => void;
}

export function TextareaBlock({
  block,
  value,
  onChange,
}: TextareaBlockProps) {
  const { validation, markAsTouched } = useFieldValidation({
    block,
    value,
    validateOnChange: true,
  });

  const errorMessage = getValidationErrorMessage(block, validation.error);
  const hasError = validation.touched && validation.state === "invalid";
  const hasSuccess = validation.touched && validation.state === "valid" && value;

  const maxLength = block.validation?.maxLength;
  const currentLength = (value ?? "").length;
  const showWarning = maxLength ? currentLength > maxLength * 0.9 : false;
  const isOverLimit = maxLength ? currentLength > maxLength : false;

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
        <Textarea
          id={block.id}
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
                : maxLength
                  ? `${block.id}-counter`
                  : undefined
          }
          aria-required={block.required}
          className={cn(
            "min-h-[100px] resize-none transition-all",
            hasError && "border-destructive focus-visible:ring-destructive",
            hasSuccess &&
              "border-green-500/50 focus-visible:ring-green-500/30",
            !hasError && !hasSuccess && "border-border"
          )}
          maxLength={maxLength}
        />
      </div>
      <div className="flex justify-between items-center">
        {hasError && errorMessage ? (
          <p
            id={`${block.id}-error`}
            className="text-xs text-destructive flex items-center gap-1 animate-in fade-in-0 slide-in-from-top-1"
            role="alert"
          >
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            <span>{errorMessage}</span>
          </p>
        ) : block.helpText && !hasError ? (
          <p id={`${block.id}-help`} className="text-xs text-muted-foreground">
            {block.helpText}
          </p>
        ) : hasSuccess ? (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Texto válido</span>
          </p>
        ) : (
          <span />
        )}
        {maxLength != null && (
          <span
            id={`${block.id}-counter`}
            className={cn(
              "text-xs tabular-nums",
              isOverLimit && "text-destructive font-medium",
              showWarning && !isOverLimit && "text-orange-500 font-medium",
              !showWarning && !isOverLimit && "text-muted-foreground"
            )}
          >
            {currentLength} / {maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
