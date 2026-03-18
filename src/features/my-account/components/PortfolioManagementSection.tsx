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
import { SectionTitleWithIcon } from "@/components/ui/section-title-with-icon";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ImageIcon, Trash2, Loader2, Paperclip, X, Pencil, GripVertical } from "lucide-react";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
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
  const isDesktop = useBreakpointMd();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollYRef = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
    if (!dialogOpen || isDesktop) return;
    scrollYRef.current = window.scrollY;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyPosition = document.body.style.position;
    const prevBodyTop = document.body.style.top;
    const prevBodyWidth = document.body.style.width;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollYRef.current}px`;
    document.body.style.width = "100%";
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.position = prevBodyPosition;
      document.body.style.top = prevBodyTop;
      document.body.style.width = prevBodyWidth;
      window.scrollTo(0, scrollYRef.current);
    };
  }, [dialogOpen, isDesktop]);

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
    <Card>
      <CardHeader className="pb-3 sm:pb-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitleWithIcon
            title="Portfólio"
            icon={ImageIcon}
            iconGradient="from-rose-500 to-pink-600"
            size="compact"
            className="!mb-0"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
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
      <CardContent className="!pt-4 space-y-4">
        <p className="text-sm">
          Adicione trabalhos realizados para exibir no seu perfil público.
        </p>
        {orderedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 border border-dashed rounded-md text-center">
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
        <DialogContent
          className={
            isDesktop
              ? "max-h-[90vh] flex flex-col"
              : "left-0 top-0 h-[100dvh] w-[100vw] max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-lg flex flex-col max-h-[100dvh]"
          }
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {isEditMode ? "Editar trabalho" : "Adicionar trabalho ao portfólio"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto min-h-0 flex-1">
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
                  JPEG, PNG ou WebP. Até 5 MB cada.
                </span>
              </div>
              <input
                ref={fileInputRef}
                id="portfolio-images"
                type="file"
                accept="image/jpeg,image/png,image/webp"
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
          <DialogFooter className="shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => handleCloseDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={isEditMode ? handleSaveEdit : handleAdd}
              disabled={!newTitle.trim() || isWorking}
            >
              {isWorking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isEditMode ? (
                "Salvar"
              ) : (
                "Adicionar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
