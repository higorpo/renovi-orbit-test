import { cn } from "@/lib/utils";
import type { FormBlock } from "../../types";
import { Textarea } from "@/components/ui/textarea";

interface DescriptionBlockProps {
  block: FormBlock;
  value: string | undefined;
  onChange: (value: string) => void;
}

export function DescriptionBlock({
  block,
  value,
  onChange,
}: DescriptionBlockProps) {
  const currentLength = value?.length ?? 0;
  const maxLength = block.validation?.maxLength ?? 500;
  const minLength = block.validation?.minLength ?? 0;
  const isValid = currentLength >= minLength && currentLength <= maxLength;
  const showWarning = currentLength > maxLength * 0.9;

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor={block.id}
          className="block text-base font-medium text-foreground mb-2"
        >
          {block.label}
          {block.required && <span className="text-destructive ml-1">*</span>}
        </label>
        {(block.helpText) && (
          <p className="text-sm text-muted-foreground mb-3">
            {block.helpText}
          </p>
        )}
      </div>
      <Textarea
        id={block.id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={block.placeholder ?? "Descreva aqui..."}
        className={cn(
          "min-h-[120px] resize-none text-base",
          !isValid && value && "border-destructive focus-visible:ring-destructive"
        )}
        maxLength={maxLength}
      />
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {!isValid && value && (
            <span className="text-destructive font-medium">
              {currentLength < minLength
                ? `Mínimo: ${minLength} caracteres`
                : `Máximo: ${maxLength} caracteres`}
            </span>
          )}
          {isValid && currentLength >= minLength && (
            <span className="text-green-600 font-medium">✓ Descrição válida</span>
          )}
        </div>
        <span
          className={cn(
            "tabular-nums",
            showWarning && "text-orange-500 font-medium",
            currentLength > maxLength && "text-destructive font-medium"
          )}
        >
          {currentLength} / {maxLength}
        </span>
      </div>
      {currentLength === 0 && block.required && (
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-foreground">
            💡 Dicas para uma boa descrição:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 pl-4">
            <li className="list-disc">O que precisa ser feito?</li>
            <li className="list-disc">Algum detalhe importante?</li>
            <li className="list-disc">Quando precisa ser realizado?</li>
          </ul>
        </div>
      )}
    </div>
  );
}
