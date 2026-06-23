import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Eye, MessageSquare, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getServiceCardStyle } from "@/features/request-quote";
import { getUrgencyConfig, type ServiceModel } from "@/features/view-services";
import { usePublicProfileImageUrl } from "@/features/provider-profile/hooks/usePublicProfileImageUrl";
import {
  getClientServiceCardPresentation,
  type ClientCardAction,
  type ClientCardActionIntent,
  type ClientServiceCardPresentation,
} from "../../utils/clientServiceCardPresentation";
import { getClientCardTheme } from "../../utils/clientServiceCardTheme";
import { initialsFromName } from "@/lib/utils/initialsFromName";
import {
  ClientCardHighlightIcon,
  ClientCardInfoIcon,
  clientBudgetActionIcon,
} from "./ClientServiceCardIcons";

export interface ClientServiceListCardProps {
  model: ServiceModel;
  onOpenDetails?: (model: ServiceModel) => void;
  onOpenBudgets?: (model: ServiceModel) => void;
  onOpenMessages?: (model: ServiceModel) => void;
  onOpenChat?: (model: ServiceModel) => void;
  onCancel?: (id: string) => void;
  isCancelling?: boolean;
  className?: string;
}

function ProviderAvatar({
  name,
  profileImagePath,
}: {
  name: string;
  profileImagePath: string | null;
}) {
  const { url } = usePublicProfileImageUrl(profileImagePath);

  return (
    <Avatar className="h-9 w-9 shrink-0 ring-2 ring-background">
      {url ? <AvatarImage src={url} alt="" /> : null}
      <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
        {initialsFromName(name)}
      </AvatarFallback>
    </Avatar>
  );
}

function ServiceCategoryBadge({ model }: { model: ServiceModel }) {
  const { Icon, color } = getServiceCardStyle(model.service ?? undefined);
  const categoryLabel = model.service?.title?.trim() || "Serviço";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
          color,
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className="truncate text-sm font-semibold text-foreground">{categoryLabel}</p>
    </div>
  );
}

interface ClientCardActionsProps {
  model: ServiceModel;
  primaryAction: ClientCardAction;
  secondaryAction: ClientCardAction | null;
  onOpenDetails?: (model: ServiceModel) => void;
  onOpenBudgets?: (model: ServiceModel) => void;
  onOpenMessages?: (model: ServiceModel) => void;
  onOpenChat?: (model: ServiceModel) => void;
  onCancel?: (id: string) => void;
  isCancelling?: boolean;
}

function ClientCardActions({
  model,
  primaryAction,
  secondaryAction,
  onOpenDetails,
  onOpenBudgets,
  onOpenMessages,
  onOpenChat,
  onCancel,
  isCancelling,
}: ClientCardActionsProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const handleAction = (action: ClientCardAction) => {
    if (action.intent === "budgets") {
      onOpenBudgets?.(model);
      return;
    }
    if (action.intent === "messages") {
      onOpenMessages?.(model);
      return;
    }
    if (action.intent === "chat") {
      onOpenChat?.(model);
      return;
    }
    if (action.intent === "cancel") {
      setCancelDialogOpen(true);
      return;
    }
    onOpenDetails?.(model);
  };

  const renderIcon = (intent: ClientCardActionIntent) => {
    if (intent === "budgets") {
      const Icon = clientBudgetActionIcon(model.listPhase === "negotiation");
      return <Icon className="h-4 w-4 shrink-0" aria-hidden />;
    }
    if (intent === "messages" || intent === "chat") {
      return <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />;
    }
    if (intent === "cancel") {
      return <Trash2 className="h-4 w-4 shrink-0" aria-hidden />;
    }
    return <Eye className="h-4 w-4 shrink-0" aria-hidden />;
  };

  const renderButton = (action: ClientCardAction, variant: "default" | "outline") => {
    const buttonElement = (
      <Button
        variant={variant}
        size="sm"
        className={cn(
          "h-10 min-h-10 w-full rounded-full px-4 font-medium gap-1.5 transition-transform duration-150 ease-out active:scale-[0.97] sm:h-9 sm:min-h-9 sm:w-auto",
          variant === "default"
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "border-border/80 bg-background text-foreground hover:bg-muted/60",
        )}
        disabled={action.disabled || (action.intent === "cancel" && isCancelling)}
        onClick={() => handleAction(action)}
      >
        {renderIcon(action.intent)}
        <span className="truncate">{action.label}</span>
      </Button>
    );

    if (action.disabled && action.disabledReason) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex w-full min-w-0">{buttonElement}</span>
            </TooltipTrigger>
            <TooltipContent>{action.disabledReason}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    if (action.intent === "cancel") {
      return (
        <AlertDialog key={action.label} open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          {buttonElement}
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar pedido?</AlertDialogTitle>
              <AlertDialogDescription>
                Ao cancelar, o pedido não receberá mais orçamentos. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Fechar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onCancel?.(model.id);
                  setCancelDialogOpen(false);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isCancelling ? "Cancelando…" : "Cancelar pedido"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    }

    return buttonElement;
  };

  const hasTwoActions = Boolean(secondaryAction);
  const actionSlotClass = (paired: boolean) =>
    cn("min-w-0", paired ? "flex-1 sm:flex-none" : "w-full sm:w-auto");

  return (
    <div className="flex w-full min-w-0 flex-row items-stretch gap-2 sm:justify-end">
      {secondaryAction ? (
        <div className={actionSlotClass(true)}>{renderButton(secondaryAction, "outline")}</div>
      ) : null}
      <div className={actionSlotClass(hasTwoActions)}>
        {renderButton(primaryAction, "default")}
      </div>
    </div>
  );
}

function HighlightBlock({
  highlight,
  theme,
}: {
  highlight: ClientServiceCardPresentation["highlight"];
  theme: ReturnType<typeof getClientCardTheme>;
}) {
  const lineCount =
    1 +
    (highlight.messagePreview ? 1 : 0) +
    (highlight.detail ? 1 : 0) +
    (highlight.subdetail ? 1 : 0);

  if (lineCount === 1) {
    return (
      <div className={cn("rounded-lg px-3 py-2.5", theme.highlight.box)}>
        <div className="flex items-center gap-2.5">
          <ClientCardHighlightIcon
            icon={highlight.icon}
            iconBoxClassName={theme.highlight.iconBox}
            iconClassName={theme.highlight.icon}
          />
          <p className={cn("min-w-0 text-sm font-semibold leading-snug", theme.highlight.title)}>
            {highlight.title}
          </p>
        </div>
      </div>
    );
  }

  const iconRowSpanClass =
    lineCount === 2 ? "row-span-2" : lineCount === 3 ? "row-span-3" : "row-span-4";

  return (
    <div className={cn("rounded-lg px-3 py-2.5", theme.highlight.box)}>
      <div className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5">
        <ClientCardHighlightIcon
          icon={highlight.icon}
          iconBoxClassName={cn(theme.highlight.iconBox, iconRowSpanClass, "self-center")}
          iconClassName={theme.highlight.icon}
        />
        <p className={cn("min-w-0 text-sm font-semibold leading-snug", theme.highlight.title)}>
          {highlight.title}
        </p>
        {highlight.messagePreview ? (
          <p
            className={cn(
              "text-sm leading-snug line-clamp-2 min-w-0",
              theme.highlight.detail,
            )}
          >
            &ldquo;{highlight.messagePreview}&rdquo;
          </p>
        ) : null}
        {highlight.detail ? (
          <p className={cn("text-xs leading-snug", theme.highlight.detail)}>{highlight.detail}</p>
        ) : null}
        {highlight.subdetail ? (
          <p className={cn("text-xs leading-snug", theme.highlight.detail)}>
            {highlight.subdetail}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ClientServiceListCard({
  model,
  onOpenDetails,
  onOpenBudgets,
  onOpenMessages,
  onOpenChat,
  onCancel,
  isCancelling,
  className,
}: ClientServiceListCardProps) {
  const presentation = getClientServiceCardPresentation(model);
  const theme = getClientCardTheme(model.listPhase, presentation.highlight.emphasis, {
    isTodayService: presentation.isTodayService,
  });
  const urgencyConfig = presentation.showUrgency ? getUrgencyConfig(model.urgency) : null;
  const providerName =
    model.counterparty?.displayName?.trim() ||
    model.contracted?.provider?.displayName?.trim() ||
    model.counterpartyName?.trim() ||
    "Profissional";
  const canOpenDetails = Boolean(onOpenDetails);
  const CardBody = canOpenDetails ? "button" : "div";

  return (
    <Card
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card p-0 shadow-sm transition-[box-shadow,border-color] duration-150",
        theme.card,
        !presentation.isTodayService && "hover:shadow-md hover:border-border",
        className,
      )}
    >
      <CardBody
        type={canOpenDetails ? "button" : undefined}
        className={cn(
          "flex w-full min-w-0 flex-col gap-3 p-4 text-left",
          canOpenDetails &&
            "cursor-pointer rounded-t-xl transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
        onClick={canOpenDetails ? () => onOpenDetails?.(model) : undefined}
        aria-label={canOpenDetails ? `Ver detalhes de ${model.title}` : undefined}
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          {presentation.showProviderHeader ? (
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <ProviderAvatar
                name={providerName}
                profileImagePath={model.counterparty?.profileImagePath ?? null}
              />
              <p className="truncate text-sm font-semibold text-foreground">{providerName}</p>
            </div>
          ) : (
            <ServiceCategoryBadge model={model} />
          )}
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {presentation.showUrgency && urgencyConfig ? (
              <Badge variant={urgencyConfig.variant} className="text-[10px] px-1.5 py-0.5">
                {urgencyConfig.label}
              </Badge>
            ) : null}
            <Badge
              className={cn(
                "shrink-0 border text-[10px] font-semibold px-1.5 py-0.5",
                theme.phaseBadge,
              )}
            >
              {presentation.phaseLabel}
            </Badge>
          </div>
        </div>

        <h2 className="text-base font-semibold leading-snug text-foreground line-clamp-2">
          {model.title}
        </h2>

        <HighlightBlock highlight={presentation.highlight} theme={theme} />

        {presentation.secondaryInfo.length > 0 ? (
          <div className="flex flex-col gap-1.5 rounded-md border border-border/40 bg-background/60 px-2.5 py-2">
            {presentation.secondaryInfo.map((item, index) => (
              <div key={index} className="flex gap-2 min-w-0">
                {item.icon ? (
                  <span className="flex h-5 shrink-0 items-center">
                    <ClientCardInfoIcon icon={item.icon} className={theme.infoIcon} />
                  </span>
                ) : (
                  <span className="w-3.5 shrink-0" aria-hidden />
                )}
                <p
                  className={cn(
                    "min-w-0 flex-1 text-sm leading-snug line-clamp-2",
                    item.icon ? theme.infoText : "text-foreground/75 italic",
                  )}
                >
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </CardBody>

      <div className="mt-auto min-w-0 border-t border-border/60 px-4 pb-4 pt-3">
        <ClientCardActions
          model={model}
          primaryAction={presentation.primaryAction}
          secondaryAction={presentation.secondaryAction}
          onOpenDetails={onOpenDetails}
          onOpenBudgets={onOpenBudgets}
          onOpenMessages={onOpenMessages}
          onOpenChat={onOpenChat}
          onCancel={onCancel}
          isCancelling={isCancelling}
        />
      </div>
    </Card>
  );
}
