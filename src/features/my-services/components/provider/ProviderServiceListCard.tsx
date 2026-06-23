import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Eye, MapPin, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUrgencyConfig, type ServiceModel } from "@/features/view-services";
import { usePublicProfileImageUrl } from "@/features/provider-profile/hooks/usePublicProfileImageUrl";
import {
  getProviderServiceCardPresentation,
  type ProviderCardAction,
  type ProviderCardActionIntent,
  type ProviderServiceCardPresentation,
} from "../../utils/providerServiceCardPresentation";
import { getProviderCardTheme } from "../../utils/providerServiceCardTheme";
import { initialsFromName } from "@/lib/utils/initialsFromName";
import {
  ProviderCardHighlightIcon,
  ProviderCardInfoIcon,
} from "./ProviderServiceCardIcons";

export interface ProviderServiceListCardProps {
  model: ServiceModel;
  onOpenDetails?: (model: ServiceModel) => void;
  onOpenChat?: (model: ServiceModel) => void;
  onOpenMap?: (model: ServiceModel) => void;
  onReviseProposal?: (model: ServiceModel) => void;
  onViewProposal?: (model: ServiceModel) => void;
  className?: string;
}

function ClientAvatar({
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

interface ProviderCardActionsProps {
  model: ServiceModel;
  primaryAction: ProviderCardAction;
  secondaryAction: ProviderCardAction | null;
  onOpenDetails?: (model: ServiceModel) => void;
  onOpenChat?: (model: ServiceModel) => void;
  onOpenMap?: (model: ServiceModel) => void;
  onReviseProposal?: (model: ServiceModel) => void;
  onViewProposal?: (model: ServiceModel) => void;
}

function ProviderCardActions({
  model,
  primaryAction,
  secondaryAction,
  onOpenDetails,
  onOpenChat,
  onOpenMap,
  onReviseProposal,
  onViewProposal,
}: ProviderCardActionsProps) {
  const handleAction = (action: ProviderCardAction) => {
    const intent: ProviderCardActionIntent | "details" | "chat" = action.intent;
    if (intent === "chat") {
      onOpenChat?.(model);
      return;
    }
    if (intent === "open_map") {
      onOpenMap?.(model);
      return;
    }
    if (intent === "revise_proposal") {
      onReviseProposal?.(model);
      return;
    }
    if (intent === "view_proposal") {
      onViewProposal?.(model);
      return;
    }
    if (intent === "details") {
      onOpenDetails?.(model);
    }
  };

  const renderButton = (action: ProviderCardAction, variant: "default" | "outline") => {
    const buttonIcon =
      action.intent === "chat" ? (
        <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
      ) : action.intent === "open_map" ? (
        <MapPin className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <Eye className="h-4 w-4 shrink-0" aria-hidden />
      );

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
        disabled={action.disabled}
        onClick={() => handleAction(action)}
      >
        {buttonIcon}
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
  highlight: ProviderServiceCardPresentation["highlight"];
  theme: ReturnType<typeof getProviderCardTheme>;
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
          <ProviderCardHighlightIcon
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
        <ProviderCardHighlightIcon
          icon={highlight.icon}
          iconBoxClassName={cn(theme.highlight.iconBox, iconRowSpanClass, "self-center")}
          iconClassName={theme.highlight.icon}
        />
        <p className={cn("text-sm font-semibold leading-snug", theme.highlight.title)}>
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
          <p className={cn("text-xs leading-snug", theme.highlight.detail)}>
            {highlight.detail}
          </p>
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

export function ProviderServiceListCard({
  model,
  onOpenDetails,
  onOpenChat,
  onOpenMap,
  onReviseProposal,
  onViewProposal,
  className,
}: ProviderServiceListCardProps) {
  const presentation = getProviderServiceCardPresentation(model);
  const theme = getProviderCardTheme(model.listPhase, presentation.highlight.emphasis, {
    isTodayService: presentation.isTodayService,
  });
  const urgencyConfig = presentation.showUrgency ? getUrgencyConfig(model.urgency) : null;
  const clientName =
    model.counterparty?.displayName?.trim() || model.counterpartyName?.trim() || "Cliente";
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
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <ClientAvatar
            name={clientName}
            profileImagePath={model.counterparty?.profileImagePath ?? null}
          />
          <p className="truncate text-sm font-semibold text-foreground">{clientName}</p>
        </div>
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
                  <ProviderCardInfoIcon icon={item.icon} className={theme.infoIcon} />
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

      <div className="mt-auto border-t border-border/60 px-4 pb-4 pt-3">
        <ProviderCardActions
          model={model}
          primaryAction={presentation.primaryAction}
          secondaryAction={presentation.secondaryAction}
          onOpenDetails={onOpenDetails}
          onOpenChat={onOpenChat}
          onOpenMap={onOpenMap}
          onReviseProposal={onReviseProposal}
          onViewProposal={onViewProposal}
        />
      </div>
    </Card>
  );
}
