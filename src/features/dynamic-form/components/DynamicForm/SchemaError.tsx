import { AlertTriangle } from "lucide-react";
import type { SchemaValidationResult } from "../../utils/schemaValidator";
import { formatValidationErrors } from "../../utils/schemaValidator";

interface SchemaErrorProps {
  validationResult: SchemaValidationResult;
  schemaName?: string;
}

export function SchemaError({ validationResult, schemaName }: SchemaErrorProps) {
  return (
    <div
      className="p-6 border border-destructive/50 bg-destructive/5 rounded-xl"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="w-6 h-6 text-destructive flex-shrink-0 mt-0.5"
          aria-hidden
        />
        <div className="space-y-3 flex-1">
          <div>
            <h3 className="text-lg font-semibold text-destructive">
              Schema inválido
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              O formulário não pode ser renderizado devido a erros no schema.
              {schemaName && (
                <span className="block mt-1">
                  <strong>Schema:</strong> {schemaName}
                </span>
              )}
            </p>
          </div>
          <pre className="bg-card p-4 rounded-lg border text-sm font-mono whitespace-pre-wrap overflow-auto max-h-64">
            {formatValidationErrors(validationResult)}
          </pre>
          <p className="text-xs text-muted-foreground">
            Corrija os erros acima no Admin Panel antes de publicar o formulário.
          </p>
        </div>
      </div>
    </div>
  );
}
