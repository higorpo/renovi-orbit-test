import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import type {
  FormSchema,
  FormData,
  FormStep,
  FormBlock,
  FormContextValue,
} from "../types";
import {
  getVisibleSteps,
  getVisibleBlocks as getVisibleBlocksForStep,
  isStepComplete,
} from "../types/helpers";

const FormContext = createContext<FormContextValue | null>(null);

export function useFormContext(): FormContextValue {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error("useFormContext must be used within FormProvider");
  }
  return context;
}

interface FormProviderProps {
  schema: FormSchema;
  initialData?: FormData;
  onChange?: (data: FormData, stepIndex: number) => void;
  children: React.ReactNode;
}

export function FormProvider({
  schema,
  initialData = {},
  onChange,
  children,
}: FormProviderProps) {
  const [formData, setFormData] = useState<FormData>(initialData);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const visibleSteps = useMemo(
    () => getVisibleSteps(schema, formData),
    [schema, formData]
  );
  const totalSteps = visibleSteps.length;
  const currentStepData = visibleSteps[currentStepIndex] ?? null;

  useEffect(() => {
    if (currentStepIndex >= totalSteps && totalSteps > 0) {
      setCurrentStepIndex(totalSteps - 1);
    }
  }, [totalSteps, currentStepIndex]);

  const setFieldValue = useCallback(
    (fieldId: string, value: unknown) => {
      setFormData((prev) => {
        const newData = { ...prev, [fieldId]: value };
        onChange?.(newData, currentStepIndex);
        return newData;
      });
    },
    [currentStepIndex, onChange]
  );

  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < totalSteps) {
      setCurrentStepIndex(index);
    }
  }, [totalSteps]);

  const nextStep = useCallback(() => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [currentStepIndex, totalSteps]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const isStepValid = useCallback(
    (stepIndex: number) => {
      const step = visibleSteps[stepIndex];
      return step ? isStepComplete(step, formData) : false;
    },
    [visibleSteps, formData]
  );

  const isFormComplete = useCallback(() => {
    return visibleSteps.every((_, index) => isStepValid(index));
  }, [visibleSteps, isStepValid]);

  const getVisibleBlocks = useCallback(
    (step: FormStep): FormBlock[] => getVisibleBlocksForStep(step, formData),
    [formData]
  );

  const value: FormContextValue = {
    schema,
    formData,
    currentStepIndex,
    currentStepData,
    totalSteps,
    visibleSteps,
    setFormData,
    updateField: setFieldValue,
    setFieldValue,
    goToStep,
    nextStep,
    prevStep,
    isStepValid,
    getVisibleBlocks,
    isFirstStep: currentStepIndex === 0,
    isLastStep: currentStepIndex === totalSteps - 1,
    canProceed: isStepValid(currentStepIndex),
    isFormComplete,
  };

  return (
    <FormContext.Provider value={value}>
      {children}
    </FormContext.Provider>
  );
}
