import type {
  ParsedFormData,
  AddressPayload,
  StructuredDataPayload,
} from "./types.ts";
import { ESTIMATED_DURATION_HINT_VALUES } from "./types.ts";

export type ParseFormDataResult =
  | { ok: true; data: ParsedFormData }
  | { ok: false; error: string; status: number };

export async function parseFormData(formData: FormData): Promise<ParseFormDataResult> {
  const userId = formData.get("userId");
  const email = formData.get("email");
  const recaptchaToken = formData.get("recaptchaToken");
  const addressRaw = formData.get("address");
  const serviceId = formData.get("serviceId");
  const serviceTitle = formData.get("serviceTitle");
  const serviceRequestTitle = formData.get("serviceRequestTitle");
  const description = formData.get("description");
  const formDataStr = formData.get("formData");
  const formSchemaStr = formData.get("formSchema");
  const formVersionStr = formData.get("formVersion");

  if (typeof userId !== "string" || !userId.trim()) {
    return { ok: false, error: "userId é obrigatório.", status: 400 };
  }
  if (typeof email !== "string" || !email.trim()) {
    return { ok: false, error: "email é obrigatório.", status: 400 };
  }
  if (typeof serviceId !== "string" || !serviceId.trim()) {
    return { ok: false, error: "serviceId é obrigatório.", status: 400 };
  }
  if (typeof recaptchaToken !== "string" || !recaptchaToken.trim()) {
    return { ok: false, error: "recaptchaToken é obrigatório.", status: 400 };
  }
  if (typeof description !== "string") {
    return { ok: false, error: "description é obrigatório.", status: 400 };
  }
  if (typeof formDataStr !== "string" || !formDataStr.trim()) {
    return { ok: false, error: "formData é obrigatório.", status: 400 };
  }
  if (typeof formSchemaStr !== "string" || !formSchemaStr.trim()) {
    return { ok: false, error: "formSchema é obrigatório.", status: 400 };
  }
  if (typeof formVersionStr !== "string" || !formVersionStr.trim()) {
    return { ok: false, error: "formVersion é obrigatório.", status: 400 };
  }
  if (typeof addressRaw !== "string" || !addressRaw.trim()) {
    return { ok: false, error: "address é obrigatório.", status: 400 };
  }

  let address: AddressPayload;
  try {
    const parsed = JSON.parse(typeof addressRaw === "string" ? addressRaw : "{}") as AddressPayload;
    if (parsed.kind === "existing") {
      if (!parsed.addressId) {
        return { ok: false, error: "Endereço existente deve ter addressId.", status: 400 };
      }
      address = parsed;
    } else if (parsed.kind === "new") {
      address = parsed;
    } else {
      return { ok: false, error: "address deve ser um objeto com kind 'new' ou 'existing'.", status: 400 };
    }
  } catch {
    return { ok: false, error: "address inválido (JSON).", status: 400 };
  }

  let formDataObj: Record<string, unknown> = {};
  if (typeof formDataStr === "string" && formDataStr.trim()) {
    try {
      formDataObj = JSON.parse(formDataStr) as Record<string, unknown>;
    } catch {
      formDataObj = {};
    }
  }

  let formSchemaObj: Record<string, unknown> | null = null;
  if (typeof formSchemaStr === "string" && formSchemaStr.trim()) {
    try {
      formSchemaObj = JSON.parse(formSchemaStr) as Record<string, unknown>;
    } catch {
      formSchemaObj = null;
    }
  }

  const formVersion = typeof formVersionStr === "string" && formVersionStr.trim() ? formVersionStr.trim() : null;

  let structuredData: StructuredDataPayload | null = null;
  const structuredDataStr = formData.get("structuredData");
  if (typeof structuredDataStr === "string" && structuredDataStr.trim()) {
    try {
      const parsed = JSON.parse(structuredDataStr) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") {
        const durationHint =
          typeof parsed.estimated_duration_hint === "string" &&
          ESTIMATED_DURATION_HINT_VALUES.includes(
            parsed.estimated_duration_hint as (typeof ESTIMATED_DURATION_HINT_VALUES)[number]
          )
            ? parsed.estimated_duration_hint
            : null;
        structuredData = {
          urgency: ["low", "medium", "high"].includes(parsed.urgency as string)
            ? (parsed.urgency as "low" | "medium" | "high")
            : null,
          scope_complexity: ["simple", "medium", "complex"].includes(
            parsed.scope_complexity as string
          )
            ? (parsed.scope_complexity as "simple" | "medium" | "complex")
            : null,
          suggested_questions: Array.isArray(parsed.suggested_questions)
            ? (parsed.suggested_questions as string[])
            : null,
          tags: Array.isArray(parsed.tags) ? (parsed.tags as string[]) : null,
          missing_info_warnings: Array.isArray(parsed.missing_info_warnings)
            ? (parsed.missing_info_warnings as string[])
            : null,
          suggested_equipment: Array.isArray(parsed.suggested_equipment)
            ? (parsed.suggested_equipment as string[])
            : null,
          suggested_materials: Array.isArray(parsed.suggested_materials)
            ? (parsed.suggested_materials as string[])
            : null,
          estimated_duration_hint: durationHint,
        };
      }
    } catch {
      structuredData = null;
    }
  }

  const photoBlobs: Blob[] = [];
  let i = 0;
  while (true) {
    const file = formData.get(`photo_${i}`);
    if (file === null || file === undefined) break;
    if (file instanceof Blob) photoBlobs.push(file);
    i++;
  }

  const data: ParsedFormData = {
    userId: userId.trim(),
    email: email.trim(),
    recaptchaToken: recaptchaToken.trim(),
    address,
    serviceId: serviceId.trim(),
    serviceTitle: typeof serviceTitle === "string" ? serviceTitle.trim() : "Serviço",
    serviceRequestTitle:
      typeof serviceRequestTitle === "string" && serviceRequestTitle.trim()
        ? serviceRequestTitle.trim()
        : `Pedido de ${typeof serviceTitle === "string" ? serviceTitle.trim() || "Serviço" : "Serviço"}`,
    description: description.trim(),
    formData: formDataObj,
    formSchema: formSchemaObj,
    formVersion,
    photoFiles: photoBlobs,
    structuredData: structuredData ?? undefined,
  };

  return { ok: true, data };
}
