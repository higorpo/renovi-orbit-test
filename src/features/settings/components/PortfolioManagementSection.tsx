import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SettingsCardHeader } from "./SettingsCardHeader";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ImageIcon, Trash2, Loader2, Paperclip, X, Pencil, GripVertical } from "lucide-react";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import {
  type ProviderPortfolioItem,
  getPortfolioImageSignedUrl,
} from "../api/providerProfile.api";

function PortfolioCover({ paths }: { paths: string[] }) {
  const [url, setUrl] = useState<string | null>(null);
  const firstPath = paths[0];
  useEffect(() => {
    if (!firstPath) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    void getPortfolioImageSignedUrl(firstPath).then((resolved) => {
      if (!cancelled) setUrl(resolved || null);
    });
    return () => {
      cancelled = true;
    };
  }, [firstPath]);

  return (
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-primary-soft text-ink">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center" aria-hidden>
          <ImageIcon className="h-5 w-5" strokeWidth={1.75} />
        </span>
      )}
      {paths.length > 1 ? (
        <span className="absolute bottom-1 right-1 rounded-md bg-ink/80 px-1 text-[10px] font-semibold text-white">
          +{paths.length - 1}
        </span>
      ) : null}
    </div>
  );
}

/** Existing portfolio images with signed URLs and remove button for edit mode. */
function ExistingImagesEditable({
  paths,
  onRemove,
  disabled,
}: {
  paths: string[];
  onRemove: (path: string) => void;
  disabled?: boolean;
}) {
  const [urlsByPath, setUrlsByPath] = useState<Record<string, string>>({});
  useEffect(() => {
    if (paths.length === 0) {
      setUrlsByPath({});
      return;
    }
    let cancelled = false;
    Promise.all(paths.map((path) => getPortfolioImageSignedUrl(path))).then(
      (resolved) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        paths.forEach((path, i) => {
          if (resolved[i]) next[path] = resolved[i];
        });
        setUrlsByPath(next);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [paths]);
  if (paths.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {paths.map((path) => (
        <div
          key={path}
          className="relative overflow-hidden rounded-md border aspect-square"
        >
          {urlsByPath[path] ? (
            <img
              src={urlsByPath[path]}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-muted animate-pulse" />
          )}
          <button
            type="button"
            onClick={() => onRemove(path)}
            disabled={disabled}
            className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm transition hover:bg-muted"
            aria-label="Remover imagem"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export interface PortfolioManagementSectionProps {
  items: ProviderPortfolioItem[];
  onCreateItem: (params: {
    title: string;
    description?: string;
    imageFiles?: File[];
  }) => Promise<unknown>;
  onUpdateItem?: (itemId: string, params: {
    title: string;
    description?: string | null;
    existingImagePaths: string[];
    pathsToRemove: string[];
    imageFiles?: File[];
  }) => Promise<unknown>;
  onDeleteItem: (itemId: string) => Promise<unknown>;
  onReorderItems?: (itemIds: string[]) => Promise<unknown>;
  isCreating: boolean;
  isUpdating?: boolean;
  isDeleting: boolean;
  disabled?: boolean;
}

interface SortablePortfolioItemProps {
  item: ProviderPortfolioItem;
  onEdit: (item: ProviderPortfolioItem) => void;
  onDelete: (itemId: string) => void;
  disabled?: boolean;
  isDeleting: boolean;
  deletingId: string | null;
  showEditButton: boolean;
}

function SortablePortfolioItem({
  item,
  onEdit,
  onDelete,
  disabled,
  isDeleting,
  deletingId,
  showEditButton,
}: SortablePortfolioItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const extraCount = (item.image_paths?.length ?? 0) > 1 ? item.image_paths!.length - 1 : 0;

  return (
    <li ref={setNodeRef} style={style} className={isDragging ? "z-10 opacity-50" : undefined}>
      <article className="rounded-2xl border border-border bg-canvas p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-canvas-soft hover:text-ink active:cursor-grabbing"
            aria-label="Reordenar item"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <PortfolioCover paths={item.image_paths ?? []} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[15px] font-semibold tracking-tight text-ink">
              {item.title}
            </p>
            {item.description ? (
              <p className="mt-0.5 line-clamp-2 text-sm text-body">{item.description}</p>
            ) : null}
            <p className="mt-1 text-caption text-muted-foreground">
              {item.execution_date
                ? new Date(item.execution_date).toLocaleDateString("pt-BR")
                : extraCount > 0
                  ? `${extraCount + 1} fotos`
                  : "No perfil público"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {showEditButton ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-full text-body hover:bg-canvas-soft hover:text-ink"
                onClick={() => onEdit(item)}
                disabled={disabled}
                aria-label={`Editar ${item.title}`}
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full text-body hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDelete(item.id)}
              disabled={disabled || isDeleting}
              aria-label={`Excluir ${item.title}`}
            >
              {deletingId === item.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </article>
    </li>
  );
}

export function PortfolioManagementSection({
  items,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onReorderItems,
  isCreating,
  isUpdating = false,
  isDeleting,
  disabled,
}: PortfolioManagementSectionProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProviderPortfolioItem | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [keptExistingPaths, setKeptExistingPaths] = useState<string[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [orderedItems, setOrderedItems] = useState<ProviderPortfolioItem[]>(items);
  const isDraggingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const isDesktop = useBreakpointMd();
  const dialogOpen = addOpen || editingItem !== null;

  // Sync ordered items from server when not actively dragging
  useEffect(() => {
    if (!isDraggingRef.current) {
      setOrderedItems(items);
    }
  }, [items]);

  const handleDragStart = () => {
    isDraggingRef.current = true;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    isDraggingRef.current = false;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedItems((prev) => {
        const oldIndex = prev.findIndex((i) => i.id === active.id);
        const newIndex = prev.findIndex((i) => i.id === over.id);
        const newOrder = arrayMove(prev, oldIndex, newIndex);
        onReorderItems?.(newOrder.map((i) => i.id));
        return newOrder;
      });
    }
  };

  useEffect(() => {
    if (editingItem) {
      setNewTitle(editingItem.title);
      setNewDescription(editingItem.description ?? "");
      setKeptExistingPaths([...(editingItem.image_paths ?? [])]);
      setSelectedFiles([]);
    }
  }, [editingItem]);

  useEffect(() => {
    const urls = selectedFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedFiles]);

  const resetDialog = () => {
    setNewTitle("");
    setNewDescription("");
    setSelectedFiles([]);
    setKeptExistingPaths([]);
    setAddOpen(false);
    setEditingItem(null);
  };

  const handleCloseDialog = (open: boolean) => {
    if (!open) {
      setAddOpen(false);
      setEditingItem(null);
      setNewTitle("");
      setNewDescription("");
      setSelectedFiles([]);
      setKeptExistingPaths([]);
    }
  };

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setIsSubmitting(true);
    try {
      await onCreateItem({
        title,
        description: newDescription.trim() || undefined,
        imageFiles: selectedFiles.length > 0 ? selectedFiles : undefined,
      });
      resetDialog();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingItem || !onUpdateItem) return;
    const title = newTitle.trim();
    if (!title) return;
    setIsSubmitting(true);
    try {
      const existingPaths = editingItem.image_paths ?? [];
      const pathsToRemove = existingPaths.filter((p) => !keptExistingPaths.includes(p));
      await onUpdateItem(editingItem.id, {
        title,
        description: newDescription.trim() || null,
        existingImagePaths: existingPaths,
        pathsToRemove,
        imageFiles: selectedFiles.length > 0 ? selectedFiles : undefined,
      });
      resetDialog();
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeExistingImage = (path: string) => {
    setKeptExistingPaths((prev) => prev.filter((p) => p !== path));
  };

  const handleDelete = async (itemId: string) => {
    setDeletingId(itemId);
    try {
      await onDeleteItem(itemId);
    } finally {
      setDeletingId(null);
    }
  };

  const handleFileSelection = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSelectedFiles((current) => [...current, ...Array.from(files)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  };

  const isWorking = isCreating || isUpdating || isSubmitting;
  const isEditMode = editingItem !== null;
  const overlayTitle = isEditMode ? "Editar trabalho" : "Adicionar trabalho ao portfólio";

  const handleOverlayOpenChange = (next: boolean) => {
    if (!next && !isWorking) {
      handleCloseDialog(false);
    }
  };

  const formContent = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="portfolio-title">Título</Label>
        <Input
          id="portfolio-title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Ex.: Instalação elétrica residencial"
          disabled={disabled}
        />
      </div>
      <div>
        <Label htmlFor="portfolio-desc">Descrição (opcional)</Label>
        <Textarea
          id="portfolio-desc"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          placeholder="Descreva o trabalho realizado..."
          rows={3}
          disabled={disabled}
          className="max-sm:resize-none"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="portfolio-images">Imagens do trabalho</Label>
        {isEditMode && keptExistingPaths.length > 0 && (
          <ExistingImagesEditable
            paths={keptExistingPaths}
            onRemove={removeExistingImage}
            disabled={disabled || isWorking}
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isWorking}
          >
            <Paperclip className="mr-2 h-4 w-4" />
            {isEditMode ? "Anexar mais imagens" : "Anexar imagens"}
          </Button>
          <span className="text-xs text-muted-foreground">
            JPEG, PNG, WebP, HEIC ou HEIF. Até 5 MB cada.
          </span>
        </div>
        <input
          ref={fileInputRef}
          id="portfolio-images"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelection(e.target.files)}
        />
        {selectedFiles.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {selectedFiles.map((file, index) => (
              <div key={`${file.name}-${file.size}-${index}`} className="relative overflow-hidden rounded-md border">
                <img
                  src={previewUrls[index]}
                  alt={file.name}
                  className="aspect-square w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeSelectedFile(index)}
                  className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm transition hover:bg-muted"
                  aria-label={`Remover imagem ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const footerContent = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => handleCloseDialog(false)}
        disabled={isWorking}
      >
        Cancelar
      </Button>
      <Button
        type="button"
        onClick={isEditMode ? handleSaveEdit : handleAdd}
        disabled={!newTitle.trim() || isWorking}
      >
        {isWorking ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : isEditMode ? (
          "Salvar"
        ) : (
          "Adicionar"
        )}
      </Button>
    </>
  );

  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="pb-3 sm:pb-3">
        <SettingsCardHeader
          title="Portfólio"
          icon={ImageIcon}
          description="Trabalhos exibidos no perfil público"
        />
      </CardHeader>
      <CardContent className="space-y-4 pt-0 sm:pt-0">
        <div className="flex items-center justify-between gap-3">
          <p className="text-caption text-muted-foreground">
            {orderedItems.length === 0
              ? "Nenhum item"
              : orderedItems.length === 1
                ? "1 trabalho"
                : `${orderedItems.length} trabalhos`}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 rounded-full sm:min-h-9"
            onClick={() => {
              setEditingItem(null);
              setAddOpen(true);
            }}
            disabled={disabled}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Adicionar trabalho
          </Button>
        </div>
        {orderedItems.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-canvas-soft px-6 py-12 text-center">
            <div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-ink"
              aria-hidden
            >
              <ImageIcon className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <p className="font-display text-base font-semibold tracking-tight text-ink">
              Nenhum item no portfólio
            </p>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-body">
              Mostre trabalhos realizados para os clientes no seu perfil público.
            </p>
          </div>
        ) : onReorderItems ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedItems.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-3">
                {orderedItems.map((item) => (
                  <SortablePortfolioItem
                    key={item.id}
                    item={item}
                    onEdit={setEditingItem}
                    onDelete={handleDelete}
                    disabled={disabled}
                    isDeleting={isDeleting}
                    deletingId={deletingId}
                    showEditButton={Boolean(onUpdateItem)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <ul className="m-0 list-none space-y-3 p-0">
            {orderedItems.map((item) => (
              <li key={item.id}>
                <article className="rounded-2xl border border-border bg-canvas p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <PortfolioCover paths={item.image_paths ?? []} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-[15px] font-semibold tracking-tight text-ink">
                        {item.title}
                      </p>
                      {item.description ? (
                        <p className="mt-0.5 line-clamp-2 text-sm text-body">{item.description}</p>
                      ) : null}
                      {item.execution_date ? (
                        <p className="mt-1 text-caption text-muted-foreground">
                          {new Date(item.execution_date).toLocaleDateString("pt-BR")}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {onUpdateItem ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 rounded-full text-body hover:bg-canvas-soft hover:text-ink"
                          onClick={() => setEditingItem(item)}
                          disabled={disabled}
                          aria-label={`Editar ${item.title}`}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 rounded-full text-body hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleDelete(item.id)}
                        disabled={disabled || isDeleting}
                        aria-label={`Excluir ${item.title}`}
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {isDesktop ? (
        <Sheet open={dialogOpen} onOpenChange={handleOverlayOpenChange}>
          <SheetContent
            side="right"
            className="flex w-full flex-col gap-0 border-l p-0 sm:max-w-lg md:max-w-xl"
            aria-describedby={undefined}
          >
            <SheetHeader className="shrink-0 space-y-0 border-b px-6 py-4 pr-14 text-left">
              <SheetTitle className="font-display text-lg font-semibold tracking-tight text-ink">
                {overlayTitle}
              </SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 py-5">
              {formContent}
            </div>
            <SheetFooter className="shrink-0 flex-row justify-end gap-2 space-x-0 border-t bg-canvas px-6 py-4">
              {footerContent}
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : (
        <Drawer
          open={dialogOpen}
          onOpenChange={handleOverlayOpenChange}
          shouldScaleBackground={false}
          handleOnly
          dismissible={!isWorking}
        >
          <DrawerContent
            className="flex max-h-[90vh] flex-col gap-0 rounded-t-2xl p-0"
            aria-describedby={undefined}
          >
            <DrawerHeader className="shrink-0 space-y-0 border-b px-4 pb-3 pt-1 text-left">
              <div className="flex items-center justify-between gap-3">
                <DrawerTitle className="text-base font-semibold sm:text-lg">
                  {overlayTitle}
                </DrawerTitle>
                <DrawerClose asChild>
                  <button
                    type="button"
                    aria-label="Fechar"
                    disabled={isWorking}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground opacity-80 transition-all hover:bg-muted hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </DrawerClose>
              </div>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 touch-pan-y overscroll-y-contain">
              {formContent}
            </div>
            <DrawerFooter className="relative z-10 shrink-0 w-full flex-row gap-2 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md">
              <div className="flex w-full gap-2 [&>button]:flex-1">{footerContent}</div>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}
    </Card>
  );
}
