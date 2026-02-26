import { cn } from "@/lib/utils";
import type { FormBlock } from "../../types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Minus, Plus, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  useFieldValidation,
  getValidationErrorMessage,
} from "../../hooks/useFieldValidation";

interface NumberInputBlockProps {
  block: FormBlock;
  value: number | undefined;
  onChange: (value: number) => void;
}

export function NumberInputBlock({
  block,
  value,
  onChange,
}: NumberInputBlockProps) {
  const { validation, markAsTouched } = useFieldValidation({
    block,
    value,
    validateOnChange: true,
  });

  const errorMessage = getValidationErrorMessage(block, validation.error);
  const hasError = validation.touched && validation.state === "invalid";
  const hasSuccess =
    validation.touched && validation.state === "valid" && value !== undefined;

  const step = block.step ?? 1;
  const min = block.min;
  const max = block.max;

  const handleIncrement = () => {
    const newValue = (value ?? 0) + step;
    if (max !== undefined && newValue > max) return;
    onChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = (value ?? 0) - step;
    if (min !== undefined && newValue < min) return;
    onChange(newValue);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (inputValue === "" || inputValue === "-") {
      onChange(0);
      return;
    }
    const num = parseFloat(inputValue);
    if (!Number.isNaN(num)) onChange(num);
  };

  const isMinDisabled = min !== undefined && (value ?? 0) <= min;
  const isMaxDisabled = max !== undefined && (value ?? 0) >= max;

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
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleDecrement}
          disabled={isMinDisabled}
          className="h-10 w-10 shrink-0"
          aria-label="Diminuir valor"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <div className="relative flex-1">
          <Input
            id={block.id}
            type="number"
            inputMode="numeric"
            value={value ?? ""}
            onChange={handleChange}
            onBlur={markAsTouched}
            placeholder={block.placeholder ?? "0"}
            min={min}
            max={max}
            step={step}
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
              "text-center transition-all",
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
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleIncrement}
          disabled={isMaxDisabled}
          className="h-10 w-10 shrink-0"
          aria-label="Aumentar valor"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {(min !== undefined || max !== undefined) && !hasError && (
        <p className="text-xs text-muted-foreground text-center">
          {min !== undefined && max !== undefined
            ? `Entre ${min} e ${max}${block.unit ? ` ${block.unit}` : ""}`
            : min !== undefined
              ? `Mínimo: ${min}${block.unit ? ` ${block.unit}` : ""}`
              : `Máximo: ${max}${block.unit ? ` ${block.unit}` : ""}`}
        </p>
      )}
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
