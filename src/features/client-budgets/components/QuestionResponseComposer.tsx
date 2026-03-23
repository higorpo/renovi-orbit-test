import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useMobileDialogViewport } from "@/hooks/useMobileDialogViewport";
import { useQuestionResponseComposer } from "../hooks/useQuestionResponseComposer";

interface QuestionResponseComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceRequestId: string;
  questionId: string;
}

interface QuestionResponseFormValues {
  response: string;
}

export function QuestionResponseComposer({
  open,
  onOpenChange,
  serviceRequestId,
  questionId,
}: QuestionResponseComposerProps) {
  const composer = useQuestionResponseComposer(serviceRequestId, questionId);
  const { contentRef, scheduleSync } = useMobileDialogViewport(open);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const responseSchema = useMemo(
    () =>
      z.object({
        response: z
          .string()
          .trim()
          .min(1, "Escreva uma resposta antes de enviar.")
          .max(
            composer.maxTextLength,
            `A resposta deve ter no máximo ${composer.maxTextLength} caracteres.`,
          ),
      }),
    [composer.maxTextLength],
  );
  const form = useForm<QuestionResponseFormValues>({
    mode: "onChange",
    resolver: zodResolver(responseSchema),
    defaultValues: {
      response: composer.responseText,
    },
  });

  useEffect(() => {
    const urls = composer.selectedImages.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [composer.selectedImages]);

  useEffect(() => {
    form.reset({ response: composer.responseText });
  }, [composer.responseText, form]);

  const handleSubmit = async () => {
    const ok = await composer.submit();
    if (ok) {
      form.reset({ response: "" });
      onOpenChange(false);
    }
  };
  const responseValue = form.watch("response") ?? "";
  const hasResponseError = Boolean(form.formState.errors.response);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0 [&>button]:hidden",
          "max-sm:inset-x-0 max-sm:bottom-auto max-sm:left-0 max-sm:right-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0",
          "sm:max-h-[90vh] sm:w-full sm:max-w-xl sm:rounded-lg sm:border sm:p-6",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="shrink-0 border-b px-4 py-3 text-left sm:border-b-0 sm:px-0 sm:py-0">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="text-base sm:text-lg">Responder pergunta</DialogTitle>
              <DialogClose asChild>
                <button
                  type="button"
                  aria-label="Fechar"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </DialogClose>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 touch-pan-y overscroll-y-contain [-webkit-overflow-scrolling:touch] sm:px-0 sm:py-0">
            <Form {...form}>
              <form
                id="client-question-response-form"
                onSubmit={form.handleSubmit(() => handleSubmit())}
                className="space-y-2"
              >
                <FormField
                  control={form.control}
                  name="response"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="client-question-response">Sua resposta</Label>
                      <FormControl>
                        <Textarea
                          id="client-question-response"
                          {...field}
                          placeholder="Escreva os detalhes para ajudar o prestador a montar o orçamento."
                          onChange={(event) => {
                            field.onChange(event.target.value);
                            composer.setResponseText(event.target.value);
                          }}
                          onFocus={scheduleSync}
                          className="min-h-32 resize-y max-sm:resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
            <p className="text-xs text-muted-foreground">
              {responseValue.length}/{composer.maxTextLength}
            </p>

            <div className="space-y-2">
              <Label htmlFor="client-question-images">Imagens (opcional)</Label>
              <div className="rounded-lg border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    PNG, JPEG/JPG, WebP, HEIC e HEIF. Ate 5 imagens.
                  </p>
                  <label htmlFor="client-question-images" className="w-full sm:w-auto">
                    <span className="inline-flex w-full cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted sm:w-auto">
                      <ImagePlus className="mr-2 h-4 w-4" />
                      Escolher imagens
                    </span>
                  </label>
                </div>
                <Input
                  id="client-question-images"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    composer.onSelectImages(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {composer.selectedImages.length}/{composer.maxImages} imagens selecionadas
                </p>
              </div>

              {previewUrls.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {previewUrls.map((previewUrl, index) => (
                    <div key={`${previewUrl}-${index}`} className="relative overflow-hidden rounded-md border">
                      <img
                        src={previewUrl}
                        alt={`Imagem ${index + 1}`}
                        className="h-28 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => composer.removeImage(index)}
                        className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground shadow-sm"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter className="relative z-10 mt-2 shrink-0 flex-row gap-2 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:mt-4 sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-0 sm:shadow-none sm:backdrop-blur-none [&>button]:flex-1 sm:[&>button]:flex-none">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="client-question-response-form"
              disabled={!composer.canSubmit || hasResponseError}
            >
              {composer.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar resposta"
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
