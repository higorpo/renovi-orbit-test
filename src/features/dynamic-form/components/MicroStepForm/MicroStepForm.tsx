/**
 * Micro-step form — schema-driven dynamic form (1 question = 1 screen).
 * No draft persistence in this migration; validation blocks invalid schemas.
 */

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { FormProvider, useFormContext } from "../FormContext";
import { ProgressBar } from "../ProgressBar";
import { MicroStepRenderer } from "../MicroStepRenderer";
import { SchemaError } from "./SchemaError";
import type { FormSchemaV2, FormDataV2 } from "../../types";
import type { SchemaValidationResult } from "../../utils/schemaValidator";
import { validateFormSchemaV2 } from "../../utils/schemaValidator";

export interface MicroStepFormProps {
  schema: FormSchemaV2;
  onComplete: (data: FormDataV2) => void;
  onChange?: (data: FormDataV2, stepIndex: number) => void;
  onStepChange?: (stepIndex: number, direction: "next" | "back") => void;
  onCancel?: () => void;
  initialData?: FormDataV2;
  className?: string;
}

function FormContent({
  onComplete,
  onStepChange,
  onCancel,
}: {
  onComplete: (data: FormDataV2) => void;
  onStepChange?: (stepIndex: number, direction: "next" | "back") => void;
  onCancel?: () => void;
}) {
  const {
    schema,
    formData,
    currentStepIndex,
    totalSteps,
    nextStep,
    prevStep,
    isStepValid,
    isFormComplete,
  } = useFormContext();

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;
  const currentValid = isStepValid(currentStepIndex);

  const handleNext = useCallback(() => {
    if (currentValid && !isLastStep) {
      nextStep();
      onStepChange?.(currentStepIndex + 1, "next");
    }
  }, [currentValid, isLastStep, nextStep, currentStepIndex, onStepChange]);

  const handleBack = useCallback(() => {
    if (!isFirstStep) {
      prevStep();
      onStepChange?.(currentStepIndex - 1, "back");
    }
  }, [isFirstStep, prevStep, currentStepIndex, onStepChange]);

  const handleAutoAdvance = useCallback(() => {
    if (currentValid && !isLastStep) {
      nextStep();
      onStepChange?.(currentStepIndex + 1, "next");
    }
  }, [currentValid, isLastStep, nextStep, currentStepIndex, onStepChange]);

  const handleSubmit = useCallback(() => {
    if (isFormComplete()) {
      onComplete(formData);
    }
  }, [isFormComplete, onComplete, formData]);

  return (
    <div className="flex flex-col min-h-full">
      {schema.config.showProgressBar !== false && (
        <div className="px-4 pt-4 pb-2 border-b border-border/50">
          <ProgressBar variant="bar" showLabels />
        </div>
      )}

      <div className="flex-1 px-4 py-6 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStepIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <MicroStepRenderer onAutoAdvance={handleAutoAdvance} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-4 pb-4 pt-3 border-t border-border/50 bg-background">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={isFirstStep ? onCancel : handleBack}
            className="flex-1"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {isFirstStep ? "Cancelar" : "Voltar"}
          </Button>
          {isLastStep ? (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!isFormComplete()}
              className="flex-1"
            >
              <Check className="w-4 h-4 mr-1" />
              Concluir
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!currentValid}
              className="flex-1"
            >
              Próximo
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function MicroStepForm({
  schema,
  onComplete,
  onChange,
  onStepChange,
  onCancel,
  initialData = {},
  className,
}: MicroStepFormProps) {
  const [validationResult] = useState<SchemaValidationResult>(() =>
    validateFormSchemaV2(schema)
  );

  if (!validationResult.valid) {
    return (
      <div className={cn("p-4", className)}>
        <SchemaError
          validationResult={validationResult}
          schemaName={schema?.metadata?.categorySlug}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <FormProvider schema={schema} initialData={initialData} onChange={onChange}>
        <FormContent
          onComplete={onComplete}
          onStepChange={onStepChange}
          onCancel={onCancel}
        />
      </FormProvider>
    </div>
  );
}
