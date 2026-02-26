/**
 * Slider block — range input with min/max/step and value display.
 */

import { cn } from "@/lib/utils";
import type { FormBlock } from "../../types";
import {
  useFieldValidation,
  getValidationErrorMessage,
} from "../../hooks/useFieldValidation";
import { AlertCircle } from "lucide-react";

interface SliderBlockProps {
  block: FormBlock;
  value: number | undefined;
  onChange: (value: number) => void;
}

export function SliderBlock({
  block,
  value,
  onChange,
}: SliderBlockProps) {
  const { validation, markAsTouched } = useFieldValidation({
    block,
    value,
    validateOnChange: true,
  });

  const min = block.min ?? 0;
  const max = block.max ?? 100;
  const step = block.step ?? 1;
  const currentValue = value ?? min;

  const errorMessage = getValidationErrorMessage(block, validation.error);
  const hasError = validation.touched && validation.state === "invalid";
  const hasSuccess =
    validation.touched && validation.state === "valid" && value !== undefined;

  return (
    <div className="space-y-3">
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
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <input
            id={block.id}
            type="range"
            min={min}
            max={max}
            step={step}
            value={currentValue}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            onBlur={markAsTouched}
            aria-invalid={hasError}
            aria-required={block.required}
            aria-describedby={
              hasError
                ? `${block.id}-error`
                : block.helpText
                  ? `${block.id}-help`
                  : undefined
            }
            className={cn(
              "flex-1 h-2 rounded-full appearance-none cursor-pointer accent-primary",
              "bg-muted [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow",
              hasError && "accent-destructive"
            )}
          />
          <span
            className={cn(
              "min-w-[3rem] text-sm font-medium tabular-nums text-right",
              hasError ? "text-destructive" : "text-foreground"
            )}
          >
            {currentValue}
            {block.unit ? ` ${block.unit}` : ""}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {min} – {max}
          {block.unit ? ` ${block.unit}` : ""}
        </p>
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
        <p className="text-xs text-green-600">
          Valor selecionado: {currentValue}
          {block.unit ? ` ${block.unit}` : ""}
        </p>
      )}
    </div>
  );
}
