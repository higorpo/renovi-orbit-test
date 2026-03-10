import { InlineClientSignupFields } from "@/features/auth";
import type { ClientSignupIdentityData } from "@/features/auth";

export interface Step5IdentityProps {
  data: ClientSignupIdentityData;
  onDataChange: (
    data: ClientSignupIdentityData | ((prev: ClientSignupIdentityData) => ClientSignupIdentityData)
  ) => void;
}

export function Step5Identity({ data, onDataChange }: Step5IdentityProps) {
  return (
    <InlineClientSignupFields
      data={data}
      onDataChange={onDataChange}
      title="Seus dados"
    />
  );
}
