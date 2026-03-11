// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Deno runtime
// @ts-nocheck

import {
  FORM_DATA_MAX_BYTES,
  MAX_CONTEXT_DEPTH,
  SUGGESTION_TRUNCATE_CHARS,
} from "./constants.ts";
import type { FormatFormDataToContextParams } from "./types.ts";

const propertyTypeMap: Record<string, string> = {
  house: "Casa",
  apartment: "Apartamento",
  commercial: "Comercial/Loja",
  warehouse: "Galpão",
  other: "Outro",
};

const urgencyMap: Record<string, string> = {
  urgent: "Urgente",
  emergency: "Emergência",
  asap: "O quanto antes",
  "next-week": "Próxima semana",
  "30-days": "Próximos 30 dias",
  flexible: "Flexível",
  normal: "Normal",
  schedule: "Data específica",
};

const locationMap: Record<string, string> = {
  bathroom: "Banheiro",
  kitchen: "Cozinha",
  laundry: "Área de Serviço",
  external: "Área Externa",
  pool: "Piscina",
  bedroom: "Quarto",
  living: "Sala",
  other: "Outro",
};

const problemTypeMap: Record<string, string> = {
  leak: "Vazamento",
  clog: "Entupimento",
  installation: "Instalação",
  renovation: "Reforma",
  "leak-detection": "Caça Vazamento",
};

const serviceTypeMap: Record<string, string> = {
  "install-shower": "Instalação de Chuveiro Elétrico",
  lighting: "Iluminação",
  outlets: "Tomadas/Interruptores",
  "install-fan": "Ventilador de Teto",
  breaker: "Quadro de Luz",
  "short-circuit": "Curto-circuito",
  wiring: "Fiação/Cabeamento",
  pattern: "Padrão de Entrada",
};

const wallTypeMap: Record<string, string> = {
  masonry: "Alvenaria",
  drywall: "Gesso/Drywall",
  wood: "Madeira",
  exposed: "Exposto",
};

const voltageMap: Record<string, string> = {
  "110v": "110V",
  "220v": "220V",
  bivolt: "Bivolt",
  "dont-know": "Não sei",
};

const ceilingHeightMap: Record<string, string> = {
  standard: "Padrão (até 3m)",
  high: "Alto (3-4m)",
  "very-high": "Muito alto (+4m)",
};

const keyTranslations: Record<string, string> = {
  "property type": "Tipo de Imóvel",
  property_type: "Tipo de Imóvel",
  urgency: "Urgência",
  location: "Local",
  "problem type": "Tipo de Problema",
  problem_type: "Tipo de Problema",
  "service type": "Tipo de Serviço",
  service_type: "Tipo de Serviço",
  "service types": "Tipos de Serviço",
  service_types: "Tipos de Serviço",
  "wall type": "Tipo de Parede",
  wall_type: "Tipo de Parede",
  voltage: "Voltagem",
  "points count": "Quantidade de Pontos",
  points_count: "Quantidade de Pontos",
  "ceiling height": "Altura do Teto",
  ceiling_height: "Altura do Teto",
  "additional details": "Detalhes Adicionais",
  additional_details: "Detalhes Adicionais",
};

/**
 * Build "SIGNIFICADO DOS CAMPOS" section from formSchema.steps[].blocks[] when description_ai is present.
 * Defensive: handles missing steps, blocks, or description_ai (legacy schemas).
 */
function buildSchemaFieldMeanings(
  formSchema: Record<string, unknown> | null | undefined
): string {
  if (!formSchema || typeof formSchema !== "object") return "";
  const steps = formSchema.steps;
  if (!Array.isArray(steps) || steps.length === 0) return "";

  const lines: string[] = [];
  for (const step of steps) {
    if (!step || typeof step !== "object") continue;
    const blocks = step.blocks;
    if (!Array.isArray(blocks)) continue;
    for (const block of blocks) {
      if (!block || typeof block !== "object") continue;
      const id = block.id;
      const label = block.label;
      const descAi = block.description_ai;
      if (
        typeof id !== "string" ||
        !id ||
        typeof descAi !== "string" ||
        !descAi.trim()
      ) {
        continue;
      }
      const labelStr = typeof label === "string" && label ? ` (${label})` : "";
      lines.push(`${id}${labelStr}: ${descAi.trim()}`);
    }
  }
  if (lines.length === 0) return "";
  return `SIGNIFICADO DOS CAMPOS (para a IA):\n${lines.map((l) => `  ${l}`).join("\n")}\n\nDADOS PREENCHIDOS:\n`;
}

function translateValue(key: string, value: string): string {
  const keyLower = key.toLowerCase();
  const valueLower = value.toLowerCase();

  if (
    keyLower.includes("property") ||
    keyLower.includes("tipo_imovel") ||
    keyLower.includes("property_type")
  ) {
    return propertyTypeMap[valueLower] || propertyTypeMap[value] || value;
  }
  if (keyLower.includes("urgency") || keyLower.includes("urgencia")) {
    return urgencyMap[valueLower] || urgencyMap[value] || value;
  }
  if (keyLower.includes("location") || keyLower.includes("local")) {
    return locationMap[valueLower] || locationMap[value] || value;
  }
  if (
    keyLower.includes("problem") ||
    keyLower.includes("problema") ||
    keyLower.includes("problem_type")
  ) {
    return problemTypeMap[valueLower] || problemTypeMap[value] || value;
  }
  if (
    keyLower.includes("service") ||
    keyLower.includes("servico") ||
    keyLower.includes("service_type") ||
    keyLower.includes("service_types")
  ) {
    return serviceTypeMap[valueLower] || serviceTypeMap[value] || value;
  }
  if (
    keyLower.includes("wall") ||
    keyLower.includes("parede") ||
    keyLower.includes("wall_type")
  ) {
    return wallTypeMap[valueLower] || wallTypeMap[value] || value;
  }
  if (keyLower.includes("voltage") || keyLower.includes("voltagem")) {
    return voltageMap[valueLower] || voltageMap[value] || value;
  }
  if (
    keyLower.includes("ceiling") ||
    keyLower.includes("altura") ||
    keyLower.includes("teto") ||
    keyLower.includes("ceiling_height")
  ) {
    return (
      ceilingHeightMap[valueLower] ||
      ceilingHeightMap[value] ||
      value
    );
  }

  return (
    propertyTypeMap[valueLower] ||
    propertyTypeMap[value] ||
    urgencyMap[valueLower] ||
    urgencyMap[value] ||
    locationMap[valueLower] ||
    locationMap[value] ||
    problemTypeMap[valueLower] ||
    problemTypeMap[value] ||
    serviceTypeMap[valueLower] ||
    serviceTypeMap[value] ||
    wallTypeMap[valueLower] ||
    wallTypeMap[value] ||
    voltageMap[valueLower] ||
    voltageMap[value] ||
    ceilingHeightMap[valueLower] ||
    ceilingHeightMap[value] ||
    value
  );
}

/**
 * Build readable context string from formData, notes, and optional formSchema (field meanings for AI).
 */
export function formatFormDataToContext(
  params: FormatFormDataToContextParams
): string {
  const { serviceName, formData, userNotes, mode, formSchema } = params;
  let context = "";
  context += `SERVIÇO: ${serviceName.toUpperCase()}\n\n`;

  // Optional: add field meanings from form schema so the AI knows what each field represents
  const schemaSection = buildSchemaFieldMeanings(formSchema);
  if (schemaSection) {
    context += schemaSection;
  }

  const formDataSize = JSON.stringify(formData).length;
  if (formDataSize > FORM_DATA_MAX_BYTES) {
    console.warn(
      `[formatFormDataToContext] Large formData: ${formDataSize} bytes`
    );
  }

  const processValue = (
    key: string,
    value: unknown,
    depth: number = 0
  ): string => {
    if (depth > MAX_CONTEXT_DEPTH) return String(value);
    if (value === null || value === undefined || value === "") return "";
    if (key.startsWith("_")) return "";

    if (
      mode === "suggestion" &&
      typeof value === "string" &&
      value.length > SUGGESTION_TRUNCATE_CHARS
    ) {
      return `${key}: ${value.substring(0, SUGGESTION_TRUNCATE_CHARS)}... (texto truncado)`;
    }

    let formattedKey = key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .replace(/_/g, " ");

    const keyLower = formattedKey.toLowerCase();
    if (keyTranslations[keyLower]) {
      formattedKey = keyTranslations[keyLower];
    }

    let formattedValue: string;

    if (Array.isArray(value)) {
      formattedValue = value
        .map((v) => {
          if (typeof v === "object" && v !== null) {
            return JSON.stringify(v);
          }
          if (typeof v === "string") {
            return translateValue(key, v);
          }
          return String(v);
        })
        .join(", ");
    } else if (typeof value === "object") {
      const nested: string[] = [];
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        const nestedResult = processValue(nestedKey, nestedValue, depth + 1);
        if (nestedResult) {
          nested.push(`  ${nestedKey}: ${nestedResult}`);
        }
      }
      formattedValue =
        nested.length > 0 ? `\n${nested.join("\n")}` : JSON.stringify(value);
    } else if (typeof value === "boolean") {
      formattedValue = value ? "Sim" : "Não";
    } else if (typeof value === "number") {
      formattedValue = String(value);
      if (
        key.toLowerCase().includes("area") ||
        key.toLowerCase().includes("metragem")
      ) {
        formattedValue += " m²";
      }
      if (key.toLowerCase().includes("btus")) formattedValue += " BTUs";
      if (
        key.toLowerCase().includes("valor") ||
        key.toLowerCase().includes("preco")
      ) {
        formattedValue = `R$ ${formattedValue}`;
      }
    } else {
      if (typeof value === "string") {
        formattedValue = translateValue(key, value);
      } else {
        formattedValue = String(value);
      }
    }

    return `${formattedKey}: ${formattedValue}`;
  };

  const processedKeys = new Set<string>();

  if (!schemaSection && Object.keys(formData).length > 0) {
    context += "DADOS PREENCHIDOS:\n";
  }

  for (const [key, value] of Object.entries(formData)) {
    if (value !== null && value !== undefined && value !== "") {
      const result = processValue(key, value);
      if (result) {
        context += `${result}\n`;
        processedKeys.add(key);
      }
    }
  }

  if (Object.keys(formData).length > 0) {
    console.log(
      `[formatFormDataToContext] Campos processados: ${Array.from(processedKeys).join(", ")}`
    );
    console.log(
      `[formatFormDataToContext] Total de campos no formData: ${Object.keys(formData).length}`
    );
  }

  if (userNotes && userNotes.trim()) {
    context += `\nOBSERVAÇÕES ADICIONAIS DO CLIENTE (ETAPA 3):\n${userNotes.trim()}\n`;
  }

  return context;
}
