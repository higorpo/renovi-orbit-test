import type { FormSchema, FormData } from "../../../../types";

/** Minimal valid schema for a single step with one text field (smoke tests). */
export const minimalSchema: FormSchema = {
  version: "2.0",
  id: "minimal",
  title: "Minimal Form",
  metadata: { categorySlug: "test", categoryId: null, status: "draft" },
  config: { showProgressBar: true },
  steps: [
    {
      id: "step1",
      order: 0,
      title: "Step 1",
      blocks: [{ id: "text1", type: "text", label: "Name", required: true, description_ai: "User name." }],
    },
  ],
};

/** Schema with multiple steps for navigation tests. */
export const multiStepSchema: FormSchema = {
  version: "2.0",
  id: "multi",
  title: "Multi Step Form",
  metadata: { categorySlug: "test", categoryId: null, status: "draft" },
  config: { showProgressBar: true },
  steps: [
    {
      id: "s1",
      order: 0,
      title: "First",
      description: "First step desc",
      icon: "1️⃣",
      blocks: [
        { id: "prop", type: "property_type", label: "Tipo", required: true, description_ai: "Property type.", options: [{ value: "house", label: "Casa" }, { value: "apt", label: "Apto" }] },
        { id: "urgency", type: "urgency", label: "Urgência", required: true, description_ai: "Urgency level.", options: [{ value: "low", label: "Low" }, { value: "high", label: "High" }] },
      ],
    },
    {
      id: "s2",
      order: 1,
      title: "Second",
      blocks: [
        { id: "name", type: "text", label: "Nome", required: true, placeholder: "Seu nome", description_ai: "Contact name." },
        { id: "desc", type: "textarea", label: "Descrição", required: false, description_ai: "Description text." },
      ],
    },
    {
      id: "s3",
      order: 2,
      title: "Third",
      blocks: [
        { id: "count", type: "number", label: "Quantidade", min: 0, max: 10, required: true, description_ai: "Quantity value." },
        { id: "confirm", type: "yes_no", label: "Confirmar?", required: true, description_ai: "Confirmation choice." },
      ],
    },
  ],
};

/** Schema that includes most block types in a single long step (for block rendering tests). */
export const allBlocksSchema: FormSchema = {
  version: "2.0",
  id: "all-blocks",
  title: "All Blocks Form",
  metadata: { categorySlug: "test", categoryId: null, status: "draft" },
  config: { showProgressBar: true },
  steps: [
    {
      id: "all",
      order: 0,
      title: "All blocks",
      blocks: [
        { id: "property_type", type: "property_type", label: "Tipo de imóvel", required: true, description_ai: "Property type.", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] },
        { id: "urgency", type: "urgency", label: "Urgência", required: true, description_ai: "Urgency.", options: [{ value: "low", label: "Low" }, { value: "high", label: "High" }] },
        { id: "description_ai", type: "description_ai", label: "Descrição IA", required: false, description_ai: "AI description field." },
        { id: "single_select", type: "single_select", label: "Single", required: true, description_ai: "Single choice.", options: [{ value: "x", label: "X" }, { value: "y", label: "Y" }] },
        { id: "multi_select", type: "multi_select", label: "Multi", required: false, description_ai: "Multi choice.", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] },
        { id: "radio", type: "radio", label: "Radio", required: true, description_ai: "Radio choice.", options: [{ value: "r1", label: "R1" }, { value: "r2", label: "R2" }] },
        { id: "checkbox", type: "checkbox", label: "Checkbox", required: false, description_ai: "Checkbox options.", options: [{ value: "c1", label: "C1" }, { value: "c2", label: "C2" }] },
        { id: "yes_no", type: "yes_no", label: "Sim/Não", required: true, description_ai: "Yes or no." },
        { id: "text", type: "text", label: "Texto", required: true, description_ai: "Text input.", validation: { minLength: 2, maxLength: 100 } },
        { id: "textarea", type: "textarea", label: "Área de texto", required: false, description_ai: "Long text.", validation: { maxLength: 500 } },
        { id: "number", type: "number", label: "Número", required: true, min: 1, max: 99, unit: "un", description_ai: "Numeric value." },
        { id: "slider", type: "slider", label: "Slider", min: 0, max: 100, required: false, description_ai: "Slider value." },
        { id: "date", type: "date", label: "Data", required: false, description_ai: "Date value." },
        { id: "time", type: "time", label: "Hora", required: false, description_ai: "Time value." },
        { id: "static_text", type: "static_text", label: "Texto estático (informativo)", description_ai: "Static text." },
        {
          id: "conditional_alert",
          type: "conditional_alert",
          label: "Alerta quando Sim/Não = Sim",
          visibility: [{ dependsOn: "yes_no", operator: "equals", value: true }],
          config: { alertType: "info", alertTitle: "Aviso" },
          description_ai: "Conditional alert when yes_no is true.",
        },
      ],
    },
  ],
};

/** Schema with visibility rules: step and block visibility depend on form data. */
export const visibilitySchema: FormSchema = {
  version: "2.0",
  id: "visibility",
  title: "Visibility Form",
  metadata: { categorySlug: "test", categoryId: null, status: "draft" },
  config: { showProgressBar: true },
  steps: [
    {
      id: "s1",
      order: 0,
      title: "First",
      blocks: [
        { id: "choice", type: "yes_no", label: "Mostrar segundo step?", required: true, description_ai: "Whether to show second step." },
      ],
    },
    {
      id: "s2",
      order: 1,
      title: "Second (visible when choice=Sim)",
      visibility: [{ dependsOn: "choice", operator: "equals", value: true }],
      blocks: [
        { id: "detail", type: "text", label: "Detalhe", required: true, description_ai: "Detail text." },
        {
          id: "alert_block",
          type: "conditional_alert",
          label: "Alerta condicional",
          visibility: [{ dependsOn: "detail", operator: "isNotEmpty" }],
          config: { alertType: "success", alertTitle: "Preenchido" },
          description_ai: "Alert when detail is filled.",
        },
      ],
    },
  ],
};

/** Schema with strict validation (min/max, pattern, required) for validation tests. */
export const validationHeavySchema: FormSchema = {
  version: "2.0",
  id: "validation",
  title: "Validation Form",
  metadata: { categorySlug: "test", categoryId: null, status: "draft" },
  config: { showProgressBar: true },
  steps: [
    {
      id: "s1",
      order: 0,
      title: "Validations",
      blocks: [
        { id: "required_text", type: "text", label: "Obrigatório", required: true, description_ai: "Required text." },
        { id: "min_length", type: "text", label: "Mín 3 caracteres", required: true, description_ai: "Min length text.", validation: { minLength: 3 } },
        { id: "pattern", type: "text", label: "Só números", required: true, description_ai: "Numeric pattern.", validation: { pattern: "^[0-9]+$", message: "Apenas dígitos" } },
        { id: "num_range", type: "number", label: "Entre 5 e 15", required: true, min: 5, max: 15, description_ai: "Number in range." },
      ],
    },
  ],
};

/** Pre-filled form data for multiStepSchema to simulate completed steps. */
export const multiStepFilledData: FormData = {
  prop: "house",
  urgency: "low",
  name: "Test User",
  desc: "Some description",
  count: 5,
  confirm: true,
};

/** Pre-filled data for allBlocksSchema (partial). */
export const allBlocksPartialData: FormData = {
  property_type: "a",
  urgency: "low",
  single_select: "x",
  radio: "r1",
  yes_no: true,
  text: "Ab",
  number: 10,
};
