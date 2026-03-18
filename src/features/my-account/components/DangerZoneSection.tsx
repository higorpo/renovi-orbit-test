import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionTitleWithIcon } from "@/components/ui/section-title-with-icon";
import { AlertTriangle } from "lucide-react";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

export interface DangerZoneSectionProps {
  deleteDialogOpen: boolean;
  onDeleteDialogOpen: (open: boolean) => void;
  onDeleteConfirm?: () => void;
  isDeleting?: boolean;
}

export function DangerZoneSection({
  deleteDialogOpen,
  onDeleteDialogOpen,
  onDeleteConfirm,
  isDeleting,
}: DangerZoneSectionProps) {
  return (
    <>
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader className="pb-3 sm:pb-0">
          <SectionTitleWithIcon
            title="Zona de perigo"
            icon={AlertTriangle}
            iconGradient="from-destructive to-destructive/80"
            size="compact"
            className="!mb-0"
          />
        </CardHeader>
        <CardContent className="!pt-3">
          <p className="text-sm mb-4">
            Essa ação é irreversível. Seus dados serão removidos conforme as regras
            aplicáveis da LGPD e os requisitos legais de retenção.
          </p>
          <Button
            variant="destructive"
            onClick={() => onDeleteDialogOpen(true)}
            disabled={isDeleting}
            aria-label="Excluir minha conta"
          >
            Excluir minha conta
          </Button>
        </CardContent>
      </Card>

      <DeleteAccountDialog
        open={deleteDialogOpen}
        onClose={() => onDeleteDialogOpen(false)}
        onConfirm={onDeleteConfirm}
      />
    </>
  );
}
