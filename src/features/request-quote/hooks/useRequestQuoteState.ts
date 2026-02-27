import { useState } from "react";
import type { ServiceWithChildren } from "../types/request-quote.types";
import { defaultStep5 } from "../components/RequestQuote/schemas";
import type { Step4Data, Step5Data } from "../components/RequestQuote/schemas";

export interface Step3Data {
  description: string;
  photos: File[];
  photoPreviews: string[];
}

export interface RequestQuoteState {
  currentStep: number;
  setCurrentStep: (updater: number | ((prev: number) => number)) => void;
  loading: boolean;
  setLoading: (value: boolean) => void;
  selectedService: ServiceWithChildren | null;
  setSelectedService: (s: ServiceWithChildren | null) => void;
  step2Data: Record<string, unknown>;
  setStep2Data: (d: Record<string, unknown>) => void;
  step2FormSchema: Record<string, unknown> | null;
  setStep2FormSchema: (s: Record<string, unknown> | null) => void;
  step2FormVersion: string | null;
  setStep2FormVersion: (v: string | null) => void;
  step3Data: Step3Data;
  setStep3Data: (d: Step3Data | ((prev: Step3Data) => Step3Data)) => void;
  generatingDescription: boolean;
  setGeneratingDescription: (value: boolean) => void;
  step4Data: Step4Data;
  setStep4Data: (d: Step4Data) => void;
  step5Data: Step5Data;
  setStep5Data: (d: Step5Data | ((prev: Step5Data) => Step5Data)) => void;
}

export function useRequestQuoteState(): RequestQuoteState {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceWithChildren | null>(null);
  const [step2Data, setStep2Data] = useState<Record<string, unknown>>({});
  const [step2FormSchema, setStep2FormSchema] = useState<Record<string, unknown> | null>(null);
  const [step2FormVersion, setStep2FormVersion] = useState<string | null>(null);
  const [step3Data, setStep3Data] = useState<Step3Data>({
    description: "",
    photos: [],
    photoPreviews: [],
  });
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [step4Data, setStep4Data] = useState<Step4Data>(null);
  const [step5Data, setStep5Data] = useState<Step5Data>(defaultStep5);

  return {
    currentStep,
    setCurrentStep,
    loading,
    setLoading,
    selectedService,
    setSelectedService,
    step2Data,
    setStep2Data,
    step2FormSchema,
    setStep2FormSchema,
    step2FormVersion,
    setStep2FormVersion,
    step3Data,
    setStep3Data,
    generatingDescription,
    setGeneratingDescription,
    step4Data,
    setStep4Data,
    step5Data,
    setStep5Data,
  };
}
