import { Textarea } from "@/components/ui/textarea";
import {
  SCORE_DIMENSION_LABELS,
  ScoreDimensionPicker,
  type ScoreDimensionKey,
} from "./ScoreDimensionPicker";
import type { ServiceRatingScores } from "../api/ratings.api";

export type RatingScoresDraft = {
  quality: number | null;
  punctuality: number | null;
  communication: number | null;
  value: number | null;
  comment: string;
};

export const EMPTY_RATING_SCORES: RatingScoresDraft = {
  quality: null,
  punctuality: null,
  communication: null,
  value: null,
  comment: "",
};

export function isRatingScoresComplete(
  scores: RatingScoresDraft,
): scores is ServiceRatingScores & { comment: string } {
  return (
    typeof scores.quality === "number" &&
    typeof scores.punctuality === "number" &&
    typeof scores.communication === "number" &&
    typeof scores.value === "number"
  );
}

export function toServiceRatingScores(
  scores: RatingScoresDraft,
): ServiceRatingScores | null {
  if (!isRatingScoresComplete(scores)) return null;
  return {
    quality: scores.quality,
    punctuality: scores.punctuality,
    communication: scores.communication,
    value: scores.value,
    comment: scores.comment.trim() || null,
  };
}

export type ServiceRatingFormProps = {
  value: RatingScoresDraft;
  onChange: (next: RatingScoresDraft) => void;
  disabled?: boolean;
  showComment?: boolean;
};

const DIMENSIONS: ScoreDimensionKey[] = [
  "quality",
  "punctuality",
  "communication",
  "value",
];

export function ServiceRatingForm({
  value,
  onChange,
  disabled = false,
  showComment = true,
}: ServiceRatingFormProps) {
  return (
    <div className="space-y-5" data-testid="service-rating-form">
      {DIMENSIONS.map((key) => (
        <ScoreDimensionPicker
          key={key}
          name={key}
          label={SCORE_DIMENSION_LABELS[key]}
          value={value[key]}
          disabled={disabled}
          onChange={(score) => onChange({ ...value, [key]: score })}
        />
      ))}
      {showComment ? (
        <div className="space-y-2">
          <label
            htmlFor="service-rating-comment"
            className="text-sm font-medium text-foreground"
          >
            Comentário (opcional)
          </label>
          <Textarea
            id="service-rating-comment"
            value={value.comment}
            disabled={disabled}
            placeholder="Conte como foi a experiência…"
            className="min-h-[88px]"
            onChange={(e) => onChange({ ...value, comment: e.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}
