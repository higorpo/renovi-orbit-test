import { cn } from "@/lib/utils";
import type { FormBlock, SelectOption } from "../../types";
import { DEFAULT_PROPERTY_TYPE_OPTIONS } from "../../types/defaults";
import { useFieldValidation } from "../../hooks/useFieldValidation";
import { Check } from "lucide-react";

interface PropertyTypeBlockProps {
  block: FormBlock;
  value: string | undefined;
  onChange: (value: string) => void;
}

export function PropertyTypeBlock({ block, value, onChange }: PropertyTypeBlockProps) {
  const { validation, markAsTouched } = useFieldValidation({
    block,
    value,
    validateOnChange: false,
  });

  const options =
    block.options?.length ? block.options : DEFAULT_PROPERTY_TYPE_OPTIONS;
  const columns = (block.config?.columns as number) ?? 2;
  const hasError = validation.touched && validation.state === "invalid";
  const hasSuccess = validation.touched && validation.state === "valid" && value;

  const handleSelect = (optionValue: string) => {
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
        className={cn(
          "grid gap-3",
          columns === 1 && "grid-cols-1",
          columns === 2 && "grid-cols-2",
          columns === 3 && "grid-cols-3",
          columns === 4 && "grid-cols-4"
        )}
      >
        {options.map((option: SelectOption) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelect(option.value)}
              onBlur={markAsTouched}
              className={cn(
                "relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200",
                "hover:border-primary/50 hover:bg-primary/5",
                "focus:outline-none focus:ring-2 focus:ring-primary/30",
                isSelected
                  ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20"
                  : "border-border bg-card",
                hasError && !isSelected && "border-destructive/30"
              )}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              {option.emoji && (
                <span className="text-3xl mb-2" aria-hidden>
                  {option.emoji}
                </span>
              )}
              <span
                className={cn(
                  "font-medium text-sm",
                  isSelected ? "text-primary" : "text-foreground"
                )}
              >
                {option.label}
              </span>
              {option.description && (
                <span className="text-xs text-muted-foreground mt-1 text-center">
                  {option.description}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {block.helpText && !hasError && (
        <p id={`${block.id}-help`} className="text-xs text-muted-foreground">
          {block.helpText}
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
