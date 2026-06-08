import React from "react";
import { CATEGORY_LABELS, type Category } from "@/data/readiness";

interface Props {
  category: Category;
  score: number;
  threshold?: number;
}

export function ReadinessScoreBar({ category, score, threshold }: Props) {
  const color =
    score >= 75
      ? "bg-primary"
      : score >= 50
      ? "bg-blue-400"
      : score >= 30
      ? "bg-orange-400"
      : "bg-red-400";

  const textColor =
    score >= 75
      ? "text-primary"
      : score >= 50
      ? "text-blue-400"
      : "text-orange-400";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-sm text-white/75">{CATEGORY_LABELS[category]}</span>
        <span className={`text-sm font-bold tabular-nums ${textColor}`}>{score}%</span>
      </div>
      <div className="relative h-2 bg-white/10 rounded-full overflow-visible">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${score}%` }}
        />
        {threshold !== undefined && (
          <div
            className="absolute -top-0.5 bottom-0 w-px bg-white/50 rounded-full"
            style={{ left: `${threshold}%` }}
            title={`Minimum: ${threshold}%`}
          />
        )}
      </div>
    </div>
  );
}
