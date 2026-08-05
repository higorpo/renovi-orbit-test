import type {
  FormBlock,
  FormStep,
  FormSchema,
  FormBlockType,
  VisibilityRule,
  VisibilityOperator,
  SelectOption,
} from "../../types";
import { DEFAULT_PROPERTY_TYPE_OPTIONS, DEFAULT_URGENCY_OPTIONS } from "../../types/defaults";

let blockIdCounter = 0;
let stepIdCounter = 0;

function nextBlockId(): string {
  blockIdCounter += 1;
  return `block_${Date.now()}_${blockIdCounter}`;
}

function nextStepId(): string {
  stepIdCounter += 1;
  return `step_${Date.now()}_${stepIdCounter}`;
}

export const BLOCK_TYPE_LABELS: Record<FormBlockType, string> = {
  text: "Texto (input)",
  textarea: "Área de texto",
  number: "Número",
  single_select: "Seleção única",
  multi_select: "Seleção múltipla",
  radio: "Radio",
  checkbox: "Checkbox",
  yes_no: "Sim/Não",
  date: "Data",
  time: "Hora",
  slider: "Slider",
  property_type: "Tipo de imóvel",
  urgency: "Urgência",
  description_ai: "Descrição (IA)",
  conditional_alert: "Alerta condicional",
  static_text: "Texto estático",
  image_gallery: "Galeria de imagens",
  preview_summary: "Resumo / Preview",
  completion_criterion: "Critério de conclusão",
};

export const BLOCK_TYPE_ICONS: Record<FormBlockType, string> = {
  text: "📝",
  textarea: "📄",
  number: "🔢",
  single_select: "☑️",
  multi_select: "☑️",
  radio: "🔘",
  checkbox: "☑️",
  yes_no: "✅",
  date: "📅",
  time: "🕐",
  slider: "🎚️",
  property_type: "🏠",
  urgency: "⚡",
  description_ai: "✏️",
  conditional_alert: "ℹ️",
  static_text: "📋",
  image_gallery: "🖼️",
  preview_summary: "✅",
  completion_criterion: "✔️",
};

export const VISIBILITY_OPERATORS: { value: VisibilityOperator; label: string }[] = [
  { value: "equals", label: "Igual a" },
  { value: "notEquals", label: "Diferente de" },
  { value: "in", label: "Está em" },
  { value: "notIn", label: "Não está em" },
  { value: "includes", label: "Inclui" },
  { value: "notIncludes", label: "Não inclui" },
  { value: "greaterThan", label: "Maior que" },
  { value: "lessThan", label: "Menor que" },
  { value: "isEmpty", label: "Está vazio" },
  { value: "isNotEmpty", label: "Não está vazio" },
];

export function createBlock(type: FormBlockType, overrides?: Partial<FormBlock>): FormBlock {
  const id = overrides?.id ?? nextBlockId();
  const defaultDescriptionAi =
    "Descreva o que este campo representa e como a IA deve interpretá-lo.";
  const base: FormBlock = {
    id,
    type,
    label: overrides?.label ?? BLOCK_TYPE_LABELS[type],
    description_ai: overrides?.description_ai ?? defaultDescriptionAi,
    required: overrides?.required ?? false,
    placeholder: overrides?.placeholder,
    helpText: overrides?.helpText,
    visibility: overrides?.visibility,
    options: overrides?.options,
    config: overrides?.config,
    step: overrides?.step,
    min: overrides?.min,
    max: overrides?.max,
    unit: overrides?.unit,
    validation: overrides?.validation,
  };

  switch (type) {
    case "text":
      return { ...base, placeholder: base.placeholder ?? "Digite..." };
    case "textarea":
      return { ...base, placeholder: base.placeholder ?? "Descreva..." };
    case "number":
      return { ...base, min: base.min ?? 0, max: base.max ?? 100, step: base.step ?? 1, unit: base.unit ?? "" };
    case "single_select":
    case "multi_select":
    case "radio":
    case "checkbox":
      return {
        ...base,
        options: base.options?.length ? base.options : [{ value: "opcao_1", label: "Opção 1" }],
      };
    case "slider":
      return {
        ...base,
        min: base.min ?? 0,
        max: base.max ?? 100,
        step: base.step ?? 1,
        unit: base.unit,
      };
    case "property_type":
      return { ...base, options: base.options ?? DEFAULT_PROPERTY_TYPE_OPTIONS };
    case "urgency":
      return { ...base, options: base.options ?? DEFAULT_URGENCY_OPTIONS };
    case "static_text":
      return { ...base, config: { ...base.config, variant: "p", size: "md", color: "default" } };
    case "conditional_alert":
      return {
        ...base,
        config: { ...base.config, alertType: "info", alertTitle: "Aviso" },
        visibility: base.visibility ?? [{ dependsOn: "field_id", operator: "equals", value: "" }],
      };
    case "image_gallery":
      return {
        ...base,
        config: { ...base.config, multiSelect: false, columns: 2 },
        options: base.options ?? [],
      };
    case "completion_criterion":
      return {
        ...base,
        required: overrides?.required ?? true,
        description_ai:
          overrides?.description_ai ??
          "Critério de conclusão do serviço: atendido/não atendido, justificativa e evidências fotográficas.",
        config: {
          requires_evidence_when_met: false,
          evidence_min: 1,
          evidence_max: 5,
          ...base.config,
        },
      };
    default:
      return base;
  }
}

export function createStep(overrides?: Partial<FormStep>): FormStep {
  const id = overrides?.id ?? nextStepId();
  const order = overrides?.order ?? 0;
  return {
    id,
    order,
    title: overrides?.title ?? `Step ${order + 1}`,
    icon: overrides?.icon ?? "📌",
    description: overrides?.description,
    visibility: overrides?.visibility,
    blocks: overrides?.blocks ?? [],
  };
}

export function createEmptySchema(): FormSchema {
  const step = createStep({ order: 0, title: "Primeiro passo", blocks: [] });
  return {
    version: "2.0",
    id: `schema_${Date.now()}`,
    title: "Novo formulário",
    description: "",
    metadata: {
      categorySlug: "demo-form",
      categoryId: null,
      status: "draft",
    },
    config: {
      showProgressBar: true,
    },
    steps: [step],
  };
}

export function createDefaultVisibilityRule(): VisibilityRule {
  return { dependsOn: "", operator: "equals", value: "" };
}

export type SelectOptionTemplate = Omit<SelectOption, "value"> & { value?: string };

export function optionFromTemplate(template: SelectOptionTemplate, index: number): SelectOption {
  return {
    value: template.value ?? `opt_${index}`,
    label: template.label ?? `Opção ${index + 1}`,
    emoji: template.emoji,
    description: template.description,
    exclusive: template.exclusive,
    metadata: template.metadata,
    image: template.image,
    tags: template.tags,
  };
}
