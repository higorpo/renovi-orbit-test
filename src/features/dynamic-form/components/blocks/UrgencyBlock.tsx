import { cn } from "@/lib/utils";
import type { FormBlock, SelectOption } from "../../types";
import { DEFAULT_URGENCY_OPTIONS } from "../../types/defaults";
import { useFieldValidation } from "../../hooks/useFieldValidation";
import { Clock, Check } from "lucide-react";

interface UrgencyBlockProps {
  block: FormBlock;
  value: string | undefined;
  onChange: (value: string) => void;
}

export function UrgencyBlock({ block, value, onChange }: UrgencyBlockProps) {
  const { validation, markAsTouched } = useFieldValidation({
    block,
    value,
    validateOnChange: false,
  });

  const options = block.options?.length ? block.options : DEFAULT_URGENCY_OPTIONS;
  const hasError = validation.touched && validation.state === "invalid";
  const hasSuccess = validation.touched && validation.state === "valid" && value;

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    if (!validation.touched) setTimeout(() => markAsTouched(), 0);
  };

  const urgencyStyles: Record<string, string> = {
    emergency: "border-red-500/50 bg-red-500/10",
    urgent: "border-orange-500/50 bg-orange-500/10",
    normal: "border-blue-500/50 bg-blue-500/10",
    flexible: "border-green-500/50 bg-green-500/10",
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
          hasError ? `${block.id}-error` : block.helpText ? `${block.id}-help` : undefined
        }
        className="space-y-2"
      >
        {options.map((option: SelectOption) => {
          const isSelected = value === option.value;
          const selectedStyle =
            urgencyStyles[option.value] ?? "";
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelect(option.value)}
              onBlur={markAsTouched}
              className={cn(
                "relative w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left",
                "hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30",
                isSelected
                  ? cn(
                      "border-primary shadow-sm ring-2 ring-primary/20",
                      selectedStyle
                    )
                  : "border-border bg-card hover:border-primary/30",
                hasError && !isSelected && "border-destructive/30"
              )}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              {option.emoji && (
                <span className="text-2xl flex-shrink-0" aria-hidden>
                  {option.emoji}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <span
                  className={cn(
                    "font-medium block",
                    isSelected ? "text-primary" : "text-foreground"
                  )}
                >
                  {option.label}
                </span>
                {option.description && (
                  <span className="text-sm text-muted-foreground block mt-0.5">
                    {option.description}
                  </span>
                )}
              </div>
              {option.metadata?.slaHours != null && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" aria-hidden />
                  <span>{String(option.metadata.slaHours)}h</span>
                </div>
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
