import { Camera, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export interface ChatComposerAttachmentSourceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPickCamera: () => void;
  onPickGallery: () => void;
}

export function ChatComposerAttachmentSourceSheet({
  open,
  onOpenChange,
  onPickCamera,
  onPickGallery,
}: ChatComposerAttachmentSourceSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-[max(1rem,env(safe-area-inset-bottom))]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Enviar foto</DrawerTitle>
          <DrawerDescription>Escolha como deseja adicionar a imagem.</DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-2 px-4">
          <Button
            type="button"
            variant="secondary"
            className="h-12 justify-start gap-3"
            onClick={() => {
              onOpenChange(false);
              onPickCamera();
            }}
          >
            <Camera className="h-5 w-5" aria-hidden />
            Tirar foto
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-12 justify-start gap-3"
            onClick={() => {
              onOpenChange(false);
              onPickGallery();
            }}
          >
            <Image className="h-5 w-5" aria-hidden />
            Escolher da galeria
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
