import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ImageIcon } from "lucide-react";
import type { FormBlock } from "../../types";
import { cn } from "@/lib/utils";

interface ImageOption {
  value: string;
  label: string;
  image: string;
  tags?: string[];
  description?: string;
}

interface ImageGalleryBlockProps {
  block: FormBlock;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}

function isAllowedImageSrc(url: string): boolean {
  const t = url.trim();
  if (t.startsWith("/")) return true;
  try {
    const u = new URL(t, typeof window !== "undefined" ? window.location.href : "https://localhost");
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function ImageGalleryBlock({
  block,
  value,
  onChange,
}: ImageGalleryBlockProps) {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const options = (block.options as ImageOption[]) ?? [];
  const multiSelect = (block.config?.multiSelect as boolean) ?? false;
  const columns = (block.config?.columns as number) ?? 2;

  const selectedValues = Array.isArray(value)
    ? value
    : value
      ? [value]
      : [];

  const handleSelect = (optionValue: string) => {
    if (multiSelect) {
      const newSelection = selectedValues.includes(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue];
      onChange(newSelection);
    } else {
      onChange(optionValue);
    }
  };

  const handleImageError = (optionValue: string) => {
    setImageErrors((prev) => new Set(prev).add(optionValue));
  };

  return (
    <div className="space-y-4">
      {block.label && (
        <div className="space-y-1">
          <label className="text-base font-medium">
            {block.label}
            {block.required && (
              <span className="text-destructive ml-1">*</span>
            )}
          </label>
          {block.helpText && (
            <p className="text-sm text-muted-foreground">{block.helpText}</p>
          )}
        </div>
      )}
      <div
        className={cn(
          "grid gap-4",
          columns === 1 && "grid-cols-1",
          columns === 2 && "grid-cols-1 sm:grid-cols-2",
          columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
          columns === 4 && "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
        )}
      >
        {options.map((option) => {
          const isSelected = selectedValues.includes(option.value);
          const hasError = imageErrors.has(option.value);
          return (
            <Card
              key={option.value}
              className={cn(
                "relative overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
                isSelected && "ring-2 ring-primary ring-offset-2"
              )}
              onClick={() => handleSelect(option.value)}
            >
              <div className="relative aspect-[4/3] bg-muted">
                {hasError ? (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-12 w-12" />
                  </div>
                ) : isAllowedImageSrc(option.image) ? (
                  <img
                    src={option.image}
                    alt={option.label}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={() => handleImageError(option.value)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-10 w-10 opacity-40" aria-hidden />
                  </div>
                )}
                {isSelected && (
                  <div className="absolute inset-0 bg-copper/20 flex items-center justify-center">
                    <div className="bg-copper rounded-full p-2">
                      <CheckCircle2 className="h-6 w-6 text-copper-foreground" />
                    </div>
                  </div>
                )}
              </div>
              <div className="p-3 space-y-2">
                <p className="font-medium text-sm">{option.label}</p>
                {option.description && (
                  <p className="text-xs text-muted-foreground">
                    {option.description}
                  </p>
                )}
                {option.tags && option.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {option.tags.slice(0, 3).map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0.5"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      {multiSelect && selectedValues.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          {selectedValues.length}{" "}
          {selectedValues.length === 1
            ? "estilo selecionado"
            : "estilos selecionados"}
        </p>
      )}
    </div>
  );
}
