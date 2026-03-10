import type { ParsedFormData, AddressPayload } from "./types.ts";

export type ParseFormDataResult =
  | { ok: true; data: ParsedFormData }
  | { ok: false; error: string; status: number };

export async function parseFormData(formData: FormData): Promise<ParseFormDataResult> {
  const userId = formData.get("userId");
  const email = formData.get("email");
  const addressRaw = formData.get("address");
  const serviceId = formData.get("serviceId");
  const serviceTitle = formData.get("serviceTitle");
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
      if (!parsed.addressId || !parsed.city || !parsed.neighborhood) {
        return { ok: false, error: "Endereço existente deve ter addressId, city e neighborhood.", status: 400 };
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
    address,
    serviceId: serviceId.trim(),
    serviceTitle: typeof serviceTitle === "string" ? serviceTitle.trim() : "Serviço",
    description: description.trim(),
    formData: formDataObj,
    formSchema: formSchemaObj,
    formVersion,
    photoFiles: photoBlobs,
  };

  return { ok: true, data };
}
