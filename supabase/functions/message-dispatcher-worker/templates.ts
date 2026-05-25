import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailTemplateSource } from "./renderEmail.ts";
import type { PushTemplateSource } from "./renderPush.ts";

export interface EmailTemplateRow extends EmailTemplateSource {
  template_key: string;
  channel: string;
  active: boolean;
}

export interface PushTemplateRow extends PushTemplateSource {
  template_key: string;
  channel: string;
  active: boolean;
}

async function fetchTemplateByChannel(
  supabase: SupabaseClient,
  templateKey: string,
  channel: "email" | "push",
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .schema("message_dispatcher")
    .from("message_templates")
    .select(
      "template_key, channel, subject_template, body_template, variable_schema, active",
    )
    .eq("template_key", templateKey)
    .eq("channel", channel)
    .maybeSingle();

  if (error) {
    throw new Error(`template_fetch_failed: ${error.message}`);
  }
  if (!data || !(data as { active: boolean }).active) {
    throw new Error(`template_not_found: ${templateKey}`);
  }

  return data as Record<string, unknown>;
}

export async function fetchEmailTemplate(
  supabase: SupabaseClient,
  templateKey: string,
): Promise<EmailTemplateRow> {
  const data = await fetchTemplateByChannel(supabase, templateKey, "email");
  return data as unknown as EmailTemplateRow;
}

export async function fetchPushTemplate(
  supabase: SupabaseClient,
  templateKey: string,
): Promise<PushTemplateRow> {
  const data = await fetchTemplateByChannel(supabase, templateKey, "push");
  return data as unknown as PushTemplateRow;
}
