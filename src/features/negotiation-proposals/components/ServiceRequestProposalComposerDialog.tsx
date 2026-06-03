import {
  ProposalComposerShellDialog,
  type ProposalComposerShellDialogProps,
} from "./ProposalComposerShellDialog";

export type ServiceRequestProposalComposerDialogProps = Omit<
  ProposalComposerShellDialogProps,
  "title" | "submitLabel" | "submittingLabel"
>;

export function ServiceRequestProposalComposerDialog(
  props: ServiceRequestProposalComposerDialogProps,
) {
  return (
    <ProposalComposerShellDialog
      title="Enviar orçamento"
      submitLabel="Enviar orçamento"
      submittingLabel="Enviando..."
      {...props}
    />
  );
}
