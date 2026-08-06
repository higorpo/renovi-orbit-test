/**
 * Completion checklist criterion block (ADR-0003).
 * Met/not-met + justification when unmet + evidence list (paths or custom renderer).
 * Upload is wired by service-completion via onUploadEvidenceFile (or onRequestEvidenceUpload).
 */

import { cn } from "@/lib/utils";
import { AlertCircle, Check, ImagePlus, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { FormBlock, CompletionCriterionValue } from "../../types";
import { useFieldValidation, getValidationErrorMessage } from "../../hooks/useFieldValidation";
import { getCompletionCriterionConfig } from "../../utils/completionCriterion";

export type CompletionCriterionEvidenceRenderArgs = {
  paths: string[];
  readOnly: boolean;
  onRemovePath: (path: string) => void;
};

export type CompletionCriterionBlockProps = {
  block: FormBlock;
  value: CompletionCriterionValue | undefined;
  /** Required for editable use; omit when `readOnly`. */
  onChange?: (value: CompletionCriterionValue) => void;
  /** Legacy hook returning a storage path string after parent-handled upload. */
  onRequestEvidenceUpload?: () => void | Promise<void | string | null>;
  /** Preferred: pick file in the block, then upload via parent session flow. */
  onUploadEvidenceFile?: (file: File) => Promise<string | null>;
  /**
   * Custom evidence UI (thumbnails + lightbox). When omitted, falls back to
   * monospace path chips for backwards compatibility.
   */
  renderEvidence?: (args: CompletionCriterionEvidenceRenderArgs) => ReactNode;
  readOnly?: boolean;
  /** When true (e.g. after failed submit), force field-level validation UI. */
  forceValidate?: boolean;
};

type DraftValue = {
  met?: boolean;
  justification?: string;
  evidence_paths: string[];
};

function normalizeValue(
  value: CompletionCriterionValue | undefined,
): DraftValue {
  if (!value || typeof value !== "object") {
    return { evidence_paths: [] };
  }
  return {
    met: typeof value.met === "boolean" ? value.met : undefined,
    justification: value.justification,
    evidence_paths: Array.isArray(value.evidence_paths) ? value.evidence_paths : [],
  };
}

export function CompletionCriterionBlock({
  block,
  value,
  onChange,
  onRequestEvidenceUpload,
  onUploadEvidenceFile,
  renderEvidence,
  readOnly = false,
  forceValidate = false,
}: CompletionCriterionBlockProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const current = normalizeValue(value);
  const config = getCompletionCriterionConfig(block);
  const { validation, markAsTouched } = useFieldValidation({
    block,
    value,
    // Only revalidate while correcting after a failed submit — not on every click.
    validateOnChange: forceValidate,
  });

  useEffect(() => {
    if (forceValidate && !readOnly) {
      markAsTouched();
    }
  }, [forceValidate, readOnly, markAsTouched]);

  const errorMessage = getValidationErrorMessage(block, validation.error);
  const hasError = validation.touched && validation.state === "invalid";

  const emitChange = (next: CompletionCriterionValue) => {
    onChange?.(next);
  };

  const patch = (partial: Partial<DraftValue> & { met?: boolean }) => {
    const met = partial.met ?? current.met;
    if (typeof met !== "boolean") return;
    const next: CompletionCriterionValue = {
      met,
      justification: partial.justification ?? current.justification,
      evidence_paths: partial.evidence_paths ?? current.evidence_paths,
    };
    emitChange(next);
  };

  const handleSelectMet = (met: boolean) => {
    if (readOnly) return;
    patch({
      met,
      justification: met ? "" : current.justification,
      evidence_paths: current.evidence_paths,
    });
  };

  const handleRemovePath = (path: string) => {
    if (readOnly) return;
    patch({
      evidence_paths: current.evidence_paths.filter((p) => p !== path),
    });
  };

  const appendEvidencePath = (path: string) => {
    const latest = normalizeValue(valueRef.current);
    if (typeof latest.met !== "boolean") return;
    emitChange({
      met: latest.met,
      justification: latest.justification,
      evidence_paths: [...latest.evidence_paths, path],
    });
  };

  const handleAddEvidenceClick = async () => {
    if (readOnly) return;
    if (onUploadEvidenceFile) {
      fileInputRef.current?.click();
      return;
    }
    if (onRequestEvidenceUpload) {
      const result = await onRequestEvidenceUpload();
      if (typeof result === "string" && result.trim()) {
        appendEvidencePath(result.trim());
      }
    }
  };

  const handleFileSelected = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file || !onUploadEvidenceFile) return;
    const path = await onUploadEvidenceFile(file);
    if (path) appendEvidencePath(path);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const evidenceHint =
    current.met === false
      ? `Anexe de ${config.evidence_min} a ${config.evidence_max} foto(s) e explique o que não foi atendido.`
      : current.met === true && config.requires_evidence_when_met
        ? `Anexe de ${config.evidence_min} a ${config.evidence_max} foto(s) como evidência.`
        : null;

  const showEvidenceSection =
    current.evidence_paths.length > 0 ||
    current.met === false ||
    (current.met === true && config.requires_evidence_when_met);

  return (
    <div
      className="space-y-3"
      data-completion-criterion-id={block.id}
      data-invalid={hasError ? "true" : undefined}
    >
      {block.label && (
        <label
          htmlFor={`${block.id}-group`}
          className="block text-sm font-medium text-foreground"
        >
          {block.label}
          {(block.required ?? true) && (
            <span className="text-destructive ml-1" aria-label="obrigatório">
              *
            </span>
          )}
        </label>
      )}
      {block.helpText && (
        <p id={`${block.id}-help`} className="text-sm text-muted-foreground">
          {block.helpText}
        </p>
      )}

      <div
        id={`${block.id}-group`}
        role="radiogroup"
        aria-invalid={hasError}
        aria-required={block.required ?? true}
        aria-describedby={
          hasError
            ? `${block.id}-error`
            : block.helpText
              ? `${block.id}-help`
              : undefined
        }
        className="grid grid-cols-2 gap-3"
      >
        <button
          type="button"
          role="radio"
          aria-checked={current.met === true}
          disabled={readOnly}
          onClick={() => handleSelectMet(true)}
          className={cn(
            "relative flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 p-4 transition-[transform,border-color,background-color,box-shadow] duration-150 ease-out",
            "hover:border-primary/50 hover:bg-primary/5",
            "focus:outline-none focus:ring-2 focus:ring-primary/30",
            "active:scale-[0.97]",
            "disabled:pointer-events-none disabled:opacity-60",
            current.met === true
              ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20"
              : "border-border bg-card",
            hasError && current.met !== true && "border-destructive/30",
          )}
        >
          {current.met === true && (
            <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
              <Check className="h-3 w-3 text-primary-foreground" />
            </div>
          )}
          <span
            className={cn(
              "text-sm font-medium",
              current.met === true ? "text-primary" : "text-foreground",
            )}
          >
            Atendido
          </span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={current.met === false}
          disabled={readOnly}
          onClick={() => handleSelectMet(false)}
          className={cn(
            "relative flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 p-4 transition-[transform,border-color,background-color,box-shadow] duration-150 ease-out",
            "hover:border-primary/50 hover:bg-primary/5",
            "focus:outline-none focus:ring-2 focus:ring-primary/30",
            "active:scale-[0.97]",
            "disabled:pointer-events-none disabled:opacity-60",
            current.met === false
              ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20"
              : "border-border bg-card",
            hasError && current.met !== false && "border-destructive/30",
          )}
        >
          {current.met === false && (
            <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
              <Check className="h-3 w-3 text-primary-foreground" />
            </div>
          )}
          <span
            className={cn(
              "text-sm font-medium",
              current.met === false ? "text-primary" : "text-foreground",
            )}
          >
            Não atendido
          </span>
        </button>
      </div>

      {current.met === false && (
        <div className="space-y-2">
          <label
            htmlFor={`${block.id}-justification`}
            className="block text-sm font-medium text-foreground"
          >
            Justificativa
            <span className="text-destructive ml-1" aria-label="obrigatório">
              *
            </span>
          </label>
          <Textarea
            id={`${block.id}-justification`}
            value={current.justification ?? ""}
            // Prefer readOnly over disabled: disabled greys out the field and
            // drops pointer events, which feels like a permanent lock.
            readOnly={readOnly}
            aria-readonly={readOnly || undefined}
            aria-invalid={hasError}
            placeholder="Explique o que não foi atendido…"
            onChange={(e) => {
              if (readOnly) return;
              patch({ justification: e.target.value });
            }}
            className={cn(
              "min-h-[88px] bg-card",
              readOnly && "cursor-default opacity-80",
              hasError && "border-destructive focus-visible:ring-destructive/30",
            )}
          />
        </div>
      )}

      {showEvidenceSection && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Evidências</p>
            {!readOnly && (onUploadEvidenceFile || onRequestEvidenceUpload) && (
              <>
                {onUploadEvidenceFile ? (
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    className="sr-only"
                    aria-hidden
                    tabIndex={-1}
                    onChange={(e) => void handleFileSelected(e.target.files)}
                  />
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 transition-transform duration-150 ease-out active:scale-[0.97]"
                  onClick={() => void handleAddEvidenceClick()}
                >
                  <ImagePlus className="mr-1.5 h-4 w-4" aria-hidden />
                  Adicionar foto
                </Button>
              </>
            )}
          </div>
          {evidenceHint && !readOnly ? (
            <p className="text-xs text-muted-foreground">{evidenceHint}</p>
          ) : null}
          {renderEvidence ? (
            renderEvidence({
              paths: current.evidence_paths,
              readOnly,
              onRemovePath: handleRemovePath,
            })
          ) : current.evidence_paths.length > 0 ? (
            <ul className="space-y-1.5">
              {current.evidence_paths.map((path) => (
                <li
                  key={path}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs"
                >
                  <span className="min-w-0 flex-1 truncate font-mono">{path}</span>
                  {!readOnly && (
                    <button
                      type="button"
                      aria-label="Remover evidência"
                      className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors duration-150 ease-out hover:bg-destructive/10 hover:text-destructive active:scale-[0.97]"
                      onClick={() => handleRemovePath(path)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhuma foto anexada.</p>
          )}
        </div>
      )}

      {hasError && errorMessage && (
        <p
          id={`${block.id}-error`}
          className="flex items-center gap-1.5 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {errorMessage}
        </p>
      )}
    </div>
  );
}
