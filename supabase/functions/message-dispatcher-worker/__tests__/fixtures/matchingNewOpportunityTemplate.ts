/**
 * Shared fixtures mirroring migration 20260711100000_matching_mmd_batch_notification_trigger.sql.
 */

export const MATCHING_NEW_OPPORTUNITY_VARIABLE_SCHEMA = {
  type: "object",
  properties: {
    service_request_id: { type: "string", format: "uuid" },
    title: { type: "string" },
    service_name: { type: "string" },
    neighborhood: { type: "string" },
    urgency: { type: "string" },
    deep_link_path: { type: "string" },
  },
  required: [
    "service_request_id",
    "title",
    "service_name",
    "neighborhood",
    "urgency",
    "deep_link_path",
  ],
  additionalProperties: false,
} as const;

export const MATCHING_NEW_OPPORTUNITY_TEMPLATE_VARIABLES = {
  service_request_id: "7017e457-5a32-44e7-b8da-1727a14f4d33",
  title: "Fix kitchen sink",
  service_name: "Plumbing",
  neighborhood: "Pinheiros",
  urgency: "normal",
  deep_link_path: "/dashboard/services/7017e457-5a32-44e7-b8da-1727a14f4d33",
} as const;

export const MATCHING_NEW_OPPORTUNITY_PUSH_TEMPLATE = {
  subject_template: null,
  body_template: "{{title}} — {{neighborhood}}",
  variable_schema: MATCHING_NEW_OPPORTUNITY_VARIABLE_SCHEMA,
} as const;

export const MATCHING_NEW_OPPORTUNITY_EMAIL_TEMPLATE = {
  subject_template: "Nova oportunidade: {{title}}",
  body_template:
    "<p>Você recebeu uma nova oportunidade de serviço: <strong>{{title}}</strong>.</p>"
    + "<p>{{service_name}} · {{neighborhood}} · urgência {{urgency}}</p>"
    + '<p><a href="{{deep_link_path}}">Ver oportunidade</a></p>',
} as const;
