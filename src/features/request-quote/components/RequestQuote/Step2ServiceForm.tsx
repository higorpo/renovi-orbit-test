import { DynamicForm, DynamicFormSkeleton } from "@/features/dynamic-form";
import type { FormSchema } from "@/features/dynamic-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useServiceSchema } from "../../hooks/useServiceSchema";
import { formatServiceSchemaFallbackReason } from "../../utils/serviceSchemaFallbackMessages";

export interface Step2ServiceFormProps {
  serviceSlug: string | null;
  serviceId: string | null;
  data: Record<string, unknown>;
  onDataChange: (data: Record<string, unknown>) => void;
  onComplete: (data: Record<string, unknown>, schema: FormSchema | null) => void;
  onBack: () => void;
}

export function Step2ServiceForm({
  serviceSlug,
  serviceId,
  data,
  onDataChange,
  onComplete,
  onBack,
}: Step2ServiceFormProps) {
  const { schema, isLoading, fallbackReason } = useServiceSchema({
    serviceSlug,
    serviceId,
  });

  if (isLoading) {
    return <DynamicFormSkeleton />;
  }

  if (!schema) {
    return (
      <Alert variant="destructive" className="my-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Formulário não configurado</AlertTitle>
        <AlertDescription className="mt-2">
          <p>O formulário para este serviço ainda não foi configurado no sistema.</p>
          {fallbackReason && (
            <p className="text-xs text-muted-foreground mt-2">
              Motivo: {formatServiceSchemaFallbackReason(fallbackReason)}
            </p>
          )}
          <p className="text-sm mt-2">
            Por favor, entre em contato com o suporte ou tente novamente mais tarde.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <DynamicForm
      schema={schema}
      initialData={data}
      onComplete={(formData) => {
        onDataChange(formData);
        onComplete(formData, schema);
      }}
      onStepChange={(_stepIndex, _direction) => {}}
      onCancel={onBack}
    />
  );
}
