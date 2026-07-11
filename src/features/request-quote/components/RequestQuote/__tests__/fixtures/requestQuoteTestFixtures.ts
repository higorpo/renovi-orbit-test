import { vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { RequestQuoteState, Step3Data } from "../../../../hooks/useRequestQuoteState";
import type { ServiceWithChildren } from "../../../../types/request-quote.types";
import type { FormSchema } from "@/features/dynamic-form";
import type { ClientSignupIdentityData } from "@/features/auth";
import type { AddressSelection } from "@/features/addresses";

const defaultStep3Data: Step3Data = {
  description: "",
  photos: [],
  photoPreviews: [],
};

const defaultStep5Data: ClientSignupIdentityData = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
  termsAccepted: false,
};

/** Builds a full mock RequestQuoteState for tests. Override any field via overrides. */
export function mockRequestQuoteState(
  overrides: Partial<RequestQuoteState> = {}
): RequestQuoteState {
  const setCurrentStep = vi.fn();
  const setPreviousStep = vi.fn();
  const setLoading = vi.fn();
  const setSelectedService = vi.fn();
  const setStep2Data = vi.fn();
  const setStep2FormSchema = vi.fn();
  const setStep2FormVersion = vi.fn();
  const setStep3Data = vi.fn();
  const setGeneratingDescription = vi.fn();
  const setStep4Data = vi.fn();
  const setStep5Data = vi.fn();
  const setOrderCreatedEmail = vi.fn();

  return {
    currentStep: 1,
    setCurrentStep,
    previousStep: 0,
    setPreviousStep,
    loading: false,
    setLoading,
    selectedService: null,
    setSelectedService,
    step2Data: {},
    setStep2Data,
    step2FormSchema: null,
    setStep2FormSchema,
    step2FormVersion: null,
    setStep2FormVersion,
    step3Data: defaultStep3Data,
    setStep3Data,
    generatingDescription: false,
    setGeneratingDescription,
    step4Data: null,
    setStep4Data,
    step5Data: defaultStep5Data,
    setStep5Data,
    orderCreatedEmail: null,
    setOrderCreatedEmail,
    ...overrides,
  } as RequestQuoteState;
}

/** Single service (no children) for Step1 and selectedService. */
export const mockServiceWithChildren: ServiceWithChildren = {
  id: "svc-1",
  slug: "limpeza",
  title: "Limpeza",
  description: "Serviço de limpeza",
  active: true,
  show_on_request_quote: true,
  parent_id: null,
  form_id: "form-1",
  icon_key: "Wrench",
  color_key: "slate",
  image_url: "https://example.com/limpeza.jpg",
  sort_order: 0,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ai_prompt_id: null,
};

/** Service with children for flatServices tests. */
export const mockServiceWithChildrenNested: ServiceWithChildren = {
  ...mockServiceWithChildren,
  id: "svc-root",
  slug: "root",
  title: "Root Service",
  children: [
    {
      ...mockServiceWithChildren,
      id: "svc-child-1",
      slug: "child-1",
      title: "Child 1",
      parent_id: "svc-root",
    },
  ],
};

/** List of services as returned by useRequestQuoteServices (root-level only; children are nested). */
export const mockServicesList: ServiceWithChildren[] = [
  mockServiceWithChildren,
  mockServiceWithChildrenNested,
];

/** Minimal valid FormSchema for Step2 / useServiceSchema. */
export const mockFormSchema: FormSchema = {
  version: "2.0",
  id: "test-form",
  title: "Test Form",
  metadata: { categorySlug: "test", categoryId: "svc-1", status: "draft" },
  config: { showProgressBar: true },
  steps: [
    {
      id: "step1",
      order: 0,
      title: "Step 1",
      blocks: [
        {
          id: "field1",
          type: "text",
          label: "Campo",
          required: true,
          description_ai: "Test field.",
        },
      ],
    },
  ],
};

/** Valid UUIDs for address form (addressFormSchema expects UUIDs for *_id fields). */
const UUID_NEIGHBORHOOD = "11111111-1111-4111-8111-111111111111";
const UUID_STATE = "22222222-2222-4222-8222-222222222222";
const UUID_CITY = "33333333-3333-4333-8333-333333333333";

/** Step 4: existing address selection (always valid). */
export const mockStep4DataExisting: AddressSelection = {
  kind: "existing",
  addressId: "addr-1",
};

/** Step 4: new address with valid form data (passes addressFormSchema). */
export const mockStep4DataNew: AddressSelection = {
  kind: "new",
  formData: {
    address_label: "Casa",
    address_zip: "01310-100",
    address_street: "Avenida Paulista",
    address_number: "1000",
    address_complement: "",
    address_neighborhood_id: UUID_NEIGHBORHOOD,
    address_neighborhood: "Bela Vista",
    address_state_id: UUID_STATE,
    address_state: "SP",
    address_city_id: UUID_CITY,
    address_city: "São Paulo",
  },
};

/** Step 5: valid identity data (passes clientSignupIdentitySchema). */
export const mockStep5DataValid: ClientSignupIdentityData = {
  firstName: "João",
  lastName: "Silva",
  email: "joao@example.com",
  password: "SecurePass123!",
  confirmPassword: "SecurePass123!",
  termsAccepted: true,
};

/** Step 5: invalid identity (e.g. short name, missing terms). */
export const mockStep5DataInvalid: ClientSignupIdentityData = {
  firstName: "J",
  lastName: "S",
  email: "invalid",
  password: "short",
  confirmPassword: "other",
  termsAccepted: false,
};

/** Creates a fresh QueryClient for tests (avoids cache leakage). */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export interface RequestQuoteWrapperOptions {
  initialEntries?: string[];
  queryClient?: QueryClient;
}
