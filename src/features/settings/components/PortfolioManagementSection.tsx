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
  Dialog,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ShellDialogContent } from "@/components/ui/shell-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ImageIcon, Trash2, Loader2, Paperclip, X, Pencil, GripVertical } from "lucide-react";
import { useMobileDialogViewport } from "@/hooks/useMobileDialogViewport";
import {
  type ProviderPortfolioItem,
  getPortfolioImageSignedUrl,
} from "../api/providerProfile.api";

function PortfolioItemThumbnails({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    if (paths.length === 0) {
      setUrls([]);
      return;
    }
    let cancelled = false;
    Promise.all(paths.map((path) => getPortfolioImageSignedUrl(path))).then(
      (resolved) => {
        if (!cancelled) setUrls(resolved.filter(Boolean));
      }
    );
    return () => {
      cancelled = true;
    };
  }, [paths]);
  if (urls.length === 0) return null;
  return (
    <div className="flex gap-1.5 mt-2 flex-wrap">
      {urls.slice(0, 5).map((url, index) => (
        <div
          key={`${url}-${index}`}
          className="h-12 w-12 shrink-0 overflow-hidden rounded border bg-muted"
        >
          <img
            src={url}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ))}
      {paths.length > 5 && (
        <span className="text-xs text-muted-foreground self-center">
          +{paths.length - 5}
        </span>
      )}
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

  const hasExtraContent =
    Boolean(item.description?.trim()) ||
    Boolean(item.execution_date) ||
    Boolean(item.image_paths?.length);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex gap-2 p-3 border rounded-md bg-background ${
        hasExtraContent ? "items-start" : "items-center"
      } ${isDragging ? "opacity-50 shadow-lg z-10" : ""}`}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing shrink-0 mt-0.5 touch-none text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        aria-label="Reordenar item"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{item.title}</p>
        {item.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
            {item.description}
          </p>
        )}
        {item.execution_date && (
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(item.execution_date).toLocaleDateString("pt-BR")}
          </p>
        )}
        {item.image_paths && item.image_paths.length > 0 && (
          <PortfolioItemThumbnails paths={item.image_paths} />
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {showEditButton && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="group hover:text-white"
            onClick={() => onEdit(item)}
            disabled={disabled}
            aria-label={`Editar ${item.title}`}
            title="Editar"
          >
            <Pencil className="h-4 w-4 group-hover:text-white" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="group hover:text-white"
          onClick={() => onDelete(item.id)}
          disabled={disabled || isDeleting}
          aria-label={`Excluir ${item.title}`}
        >
          {deletingId === item.id ? (
            <Loader2 className="h-4 w-4 animate-spin group-hover:text-white" />
          ) : (
            <Trash2 className="h-4 w-4 text-destructive group-hover:text-white" />
          )}
        </Button>
      </div>
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

  const dialogOpen = addOpen || editingItem !== null;
  const { contentRef, scheduleSync } = useMobileDialogViewport(dialogOpen);

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

  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="pb-3 sm:pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SettingsCardHeader
            title="Portfólio"
            icon={ImageIcon}
            description="Trabalhos realizados no seu perfil público"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => {
              setEditingItem(null);
              setAddOpen(true);
            }}
            disabled={disabled}
          >
            <Plus className="h-4 w-4 mr-2" aria-hidden />
            Adicionar trabalho
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0 sm:pt-0">
        {orderedItems.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-canvas-soft py-10 text-center text-sm text-body">
            Nenhum item no portfólio. Clique em &quot;Adicionar trabalho&quot; para começar.
          </p>
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
          <ul className="space-y-3">
            {orderedItems.map((item) => {
              const hasExtraContent =
                Boolean(item.description?.trim()) ||
                Boolean(item.execution_date) ||
                Boolean(item.image_paths?.length);
              return (
                <li
                  key={item.id}
                  className={`flex justify-between gap-2 p-3 border rounded-md ${hasExtraContent ? "items-start" : "items-center"}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{item.title}</p>
                    {item.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                        {item.description}
                      </p>
                    )}
                    {item.execution_date && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(item.execution_date).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                    {item.image_paths && item.image_paths.length > 0 && (
                      <PortfolioItemThumbnails paths={item.image_paths} />
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {onUpdateItem ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="group hover:text-white"
                        onClick={() => setEditingItem(item)}
                        disabled={disabled}
                        aria-label={`Editar ${item.title}`}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4 group-hover:text-white" />
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="group hover:text-white"
                      onClick={() => handleDelete(item.id)}
                      disabled={disabled || isDeleting}
                      aria-label={`Excluir ${item.title}`}
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin group-hover:text-white" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive group-hover:text-white" />
                      )}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <ShellDialogContent ref={contentRef} size="sm">
          <DialogHeader className="shrink-0 space-y-0 border-b px-4 py-3 pr-0 text-left sm:border-b-0 sm:px-0 sm:py-0">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="text-base sm:text-lg">
                {isEditMode ? "Editar trabalho" : "Adicionar trabalho ao portfólio"}
              </DialogTitle>
              <DialogClose asChild>
                <button
                  type="button"
                  aria-label="Fechar"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </DialogClose>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 touch-pan-y overscroll-y-contain [-webkit-overflow-scrolling:touch] sm:px-0 sm:py-4">
            <div>
              <Label htmlFor="portfolio-title">Título</Label>
              <Input
                id="portfolio-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex.: Instalação elétrica residencial"
                disabled={disabled}
                onFocus={scheduleSync}
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
                onFocus={scheduleSync}
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
          <DialogFooter className="relative z-10 shrink-0 flex-row gap-2 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-0 sm:shadow-none sm:backdrop-blur-none sm:supports-[backdrop-filter]:bg-transparent [&>button]:flex-1 sm:[&>button]:flex-none">
            <Button variant="outline" onClick={() => handleCloseDialog(false)}>
              Cancelar
            </Button>
            <Button
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
          </DialogFooter>
        </ShellDialogContent>
      </Dialog>
    </Card>
  );
}
