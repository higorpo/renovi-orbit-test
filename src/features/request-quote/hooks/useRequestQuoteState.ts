import { useState } from "react";
import type { ServiceWithChildren } from "../types/request-quote.types";
import type { ClientSignupIdentityData } from "@/features/auth";
import { defaultClientSignupIdentity } from "@/features/auth";
import type { AddressSelection } from "@/features/addresses";
import type { ServiceRequestStructuredData } from "../types/request-quote.types";

export interface Step3Data {
  description: string;
  photos: File[];
  photoPreviews: string[];
  /** AI-derived structured data from generate-smart-description (saved on service_requests). */
  structured?: ServiceRequestStructuredData | null;
}

export interface RequestQuoteState {
  currentStep: number;
  setCurrentStep: (updater: number | ((prev: number) => number)) => void;
  previousStep: number;
  setPreviousStep: (value: number) => void;
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
  step4Data: AddressSelection;
  setStep4Data: (d: AddressSelection) => void;
  step5Data: ClientSignupIdentityData;
  setStep5Data: (d: ClientSignupIdentityData | ((prev: ClientSignupIdentityData) => ClientSignupIdentityData)) => void;
  /** When set, show "confirm email" screen (guest flow after order created). */
  orderCreatedEmail: string | null;
  setOrderCreatedEmail: (email: string | null) => void;
}

export function useRequestQuoteState(): RequestQuoteState {
  const [currentStep, setCurrentStep] = useState(1);
  const [previousStep, setPreviousStep] = useState(0);
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
  const [step4Data, setStep4Data] = useState<AddressSelection>(null);
  const [step5Data, setStep5Data] = useState<ClientSignupIdentityData>(defaultClientSignupIdentity);
  const [orderCreatedEmail, setOrderCreatedEmail] = useState<string | null>(null);

  return {
    currentStep,
    setCurrentStep,
    previousStep,
    setPreviousStep,
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
    orderCreatedEmail,
    setOrderCreatedEmail,
  };
}
