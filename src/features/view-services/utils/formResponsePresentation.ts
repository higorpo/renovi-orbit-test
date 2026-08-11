import type { ComponentType } from "react";
import {
  AlignLeft,
  Calendar,
  CheckCircle2,
  CircleDot,
  Clock3,
  Hash,
  Home,
  Image,
  ListChecks,
  SlidersHorizontal,
  Type,
} from "lucide-react";

const FULL_WIDTH_BLOCK_TYPES = new Set(["textarea", "description_ai", "image_gallery"]);

export function isFormResponseFullWidth(type: string): boolean {
  return FULL_WIDTH_BLOCK_TYPES.has(type);
}

export function getFormResponseIcon(
  type: string,
): ComponentType<{ className?: string; strokeWidth?: number }> {
  switch (type) {
    case "property_type":
      return Home;
    case "urgency":
      return Clock3;
    case "yes_no":
      return CheckCircle2;
    case "date":
      return Calendar;
    case "time":
      return Clock3;
    case "number":
    case "slider":
      return type === "slider" ? SlidersHorizontal : Hash;
    case "single_select":
    case "multi_select":
    case "radio":
    case "checkbox":
      return ListChecks;
    case "text":
      return Type;
    case "textarea":
    case "description_ai":
      return AlignLeft;
    case "image_gallery":
      return Image;
    default:
      return CircleDot;
  }
}
