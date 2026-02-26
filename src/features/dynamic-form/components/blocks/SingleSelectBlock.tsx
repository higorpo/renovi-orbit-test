import { cn } from "@/lib/utils";
import type { FormBlock } from "../../types";
import { useFieldValidation, getValidationErrorMessage } from "../../hooks/useFieldValidation";
import { Check, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SingleSelectBlockProps {
  block: FormBlock;
  value: string | undefined;
  onChange: (value: string) => void;
  otherText?: string;
  onOtherTextChange?: (text: string) => void;
}

export function SingleSelectBlock({
  block,
  value,
  onChange,
  otherText = "",
  onOtherTextChange,
}: SingleSelectBlockProps) {
  const { validation, markAsTouched } = useFieldValidation({
    block,
    value,
    validateOnChange: false,
  });

  const errorMessage = getValidationErrorMessage(block, validation.error);
  const hasError = validation.touched && validation.state === "invalid";
  const hasSuccess = validation.touched && validation.state === "valid" && value;

  const rawOptions = block.options ?? [];
  const columns = (block.config?.columns as number) ?? 2;
  const allowOther = block.config?.allowOther as boolean | undefined;
  const options = allowOther
    ? rawOptions.filter(
        (opt) =>
          opt.value !== "other" &&
          opt.value !== "outro" &&
          opt.label?.toLowerCase() !== "outro"
      )
    : rawOptions;

  const isOtherSelected = value === "other";

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
        {options.map((option) => {
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
                <span className="text-2xl mb-2" aria-hidden>
                  {option.emoji}
                </span>
              )}
              <span
                className={cn(
                  "font-medium text-sm text-center",
                  isSelected ? "text-primary" : "text-foreground"
                )}
              >
                {option.label}
              </span>
              {option.description && (
                <span className="text-xs text-muted-foreground mt-1 text-center line-clamp-2">
                  {option.description}
                </span>
              )}
            </button>
          );
        })}
        {allowOther && (
          <button
            type="button"
            role="radio"
            aria-checked={isOtherSelected}
            onClick={() => handleSelect("other")}
            onBlur={markAsTouched}
            className={cn(
              "relative flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed transition-all duration-200",
              "hover:border-primary/50 hover:bg-primary/5",
              "focus:outline-none focus:ring-2 focus:ring-primary/30",
              isOtherSelected
                ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                : "border-border bg-card/50",
              hasError && !isOtherSelected && "border-destructive/30"
            )}
          >
            {isOtherSelected && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
            <span className="text-2xl mb-2" aria-hidden>
              ✏️
            </span>
            <span
              className={cn(
                "font-medium text-sm",
                isOtherSelected ? "text-primary" : "text-foreground"
              )}
            >
              {(block.config?.otherLabel as string) ?? "Outro"}
            </span>
          </button>
        )}
      </div>
      {allowOther && isOtherSelected && (
        <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <Input
            id={`${block.id}-other`}
            type="text"
            placeholder="Descreva qual..."
            value={otherText}
            onChange={(e) => onOtherTextChange?.(e.target.value)}
            className="w-full"
            autoFocus
            aria-label="Descreva a opção outro"
          />
        </div>
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
      {hasSuccess && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <Check className="w-3 h-3" />
          <span>Seleção válida</span>
        </p>
      )}
    </div>
  );
}
