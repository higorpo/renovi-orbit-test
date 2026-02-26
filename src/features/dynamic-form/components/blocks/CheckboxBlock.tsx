/**
 * Checkbox block — multiple selection with native checkbox inputs.
 */

import { cn } from "@/lib/utils";
import type { FormBlock } from "../../types";
import {
  useFieldValidation,
  getValidationErrorMessage,
} from "../../hooks/useFieldValidation";
import { AlertCircle, Check } from "lucide-react";

interface CheckboxBlockProps {
  block: FormBlock;
  value: string[] | undefined;
  onChange: (value: string[]) => void;
}

export function CheckboxBlock({
  block,
  value = [],
  onChange,
}: CheckboxBlockProps) {
  const { validation, markAsTouched } = useFieldValidation({
    block,
    value,
    validateOnChange: false,
  });

  const options = block.options ?? [];
  const errorMessage = getValidationErrorMessage(block, validation.error);
  const hasError = validation.touched && validation.state === "invalid";
  const hasSuccess =
    validation.touched && validation.state === "valid" && value.length > 0;

  const handleToggle = (optionValue: string, isExclusive?: boolean) => {
    if (isExclusive) {
      onChange([optionValue]);
      if (!validation.touched) setTimeout(() => markAsTouched(), 0);
      return;
    }
    const exclusiveValues = options
      .filter((opt) => opt.exclusive)
      .map((opt) => opt.value);
    const currentWithoutExclusive = value.filter(
      (v) => !exclusiveValues.includes(v)
    );
    if (currentWithoutExclusive.includes(optionValue)) {
      onChange(currentWithoutExclusive.filter((v) => v !== optionValue));
    } else {
      onChange([...currentWithoutExclusive, optionValue]);
    }
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
      <div
        id={`${block.id}-group`}
        role="group"
        aria-invalid={hasError}
        aria-required={block.required}
        aria-describedby={
          hasError
            ? `${block.id}-error`
            : block.helpText
              ? `${block.id}-help`
              : undefined
        }
        className="space-y-2"
      >
        {options.map((option) => {
          const isSelected = value.includes(option.value);
          return (
            <label
              key={option.value}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                "hover:border-primary/30 hover:bg-primary/5",
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card",
                hasError && !isSelected && "border-destructive/30"
              )}
            >
              <input
                type="checkbox"
                name={`${block.id}-${option.value}`}
                checked={isSelected}
                onChange={() => handleToggle(option.value, option.exclusive)}
                onBlur={markAsTouched}
                className="h-4 w-4 rounded text-primary border-border focus:ring-primary"
              />
              <span className="flex-1 font-medium text-sm text-foreground">
                {option.label}
              </span>
              {option.emoji && (
                <span className="text-lg" aria-hidden>
                  {option.emoji}
                </span>
              )}
              {isSelected && (
                <Check className="w-4 h-4 text-primary shrink-0" />
              )}
              {option.exclusive && (
                <span className="text-[10px] text-muted-foreground">
                  (exclusivo)
                </span>
              )}
            </label>
          );
        })}
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
      {hasSuccess && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <Check className="w-3 h-3" />
          <span>{value.length} opção(ões) selecionada(s)</span>
        </p>
      )}
    </div>
  );
}
