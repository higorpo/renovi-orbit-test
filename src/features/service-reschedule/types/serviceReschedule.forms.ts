import { z } from "zod";
import {
  addCalendarDaysIso,
  todayCalendarIso,
} from "@/features/view-services/utils/serviceCalendarDate";

export const requestRescheduleFormSchema = z.object({
  note: z.string().max(500, "A observação deve ter no máximo 500 caracteres."),
});

export type RequestRescheduleFormValues = z.infer<typeof requestRescheduleFormSchema>;

const proposeShiftSchema = z.enum(["morning", "afternoon", "full_day"]);

export const proposeRescheduleFormSchema = z
  .object({
    startDate: z.string().min(1, "Selecione a data de início."),
    endDate: z.string(),
    shift: proposeShiftSchema,
  })
  .superRefine((data, context) => {
    const minDate = addCalendarDaysIso(todayCalendarIso(), 1);

    if (data.startDate < minDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A data de início deve ser a partir de amanhã.",
        path: ["startDate"],
      });
    }

    if (data.endDate.trim() && data.endDate < data.startDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A data de término deve ser igual ou posterior à data de início.",
        path: ["endDate"],
      });
    }
  });

export type ProposeRescheduleFormValues = z.infer<typeof proposeRescheduleFormSchema>;

export const confirmRescheduleFormSchema = z.object({});

export type ConfirmRescheduleFormValues = z.infer<typeof confirmRescheduleFormSchema>;
