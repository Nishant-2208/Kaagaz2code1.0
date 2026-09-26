import type { ConfidenceLevel } from '../../api/types';

interface ConfidenceBadgeProps {
  confidence: number;
  level?: ConfidenceLevel;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

const CONFIDENCE_LEVELS: Record<
  ConfidenceLevel,
  {
    label: string;
    icon: string;
    classes: string;
  }
> = {
  high: {
    label: 'High confidence',
    icon: 'check_circle',
    classes:
      'bg-success-container text-on-success-container border-success',
  },
  medium: {
    label: 'Review recommended',
    icon: 'warning',
    classes:
      'bg-warning-container text-on-warning-container border-warning',
  },
  low: {
    label: 'Review required',
    icon: 'error',
    classes:
      'bg-error-container text-on-error-container border-error',
  },
};

function resolveLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 90) {
    return 'high';
  }

  if (confidence >= 60) {
    return 'medium';
  }

  return 'low';
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

export default function ConfidenceBadge({
  confidence,
  level,
  size = 'sm',
  showLabel = false,
}: ConfidenceBadgeProps) {
  const safeConfidence = clampConfidence(confidence);
  const resolvedLevel = level ?? resolveLevel(safeConfidence);
  const config = CONFIDENCE_LEVELS[resolvedLevel];

  const sizeClasses =
    size === 'sm'
      ? 'text-[11px] px-2 py-1'
      : 'text-[13px] px-3 py-1.5';

  return (
    <span
      title={`${config.label}: ${safeConfidence}%`}
      aria-label={`${config.label}: ${safeConfidence}%`}
      className={[
        'inline-flex items-center gap-1.5',
        'rounded-sm border',
        'font-mono text-data-mono',
        'whitespace-nowrap',
        sizeClasses,
        config.classes,
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className="material-symbols-outlined text-[14px]"
      >
        {config.icon}
      </span>

      <span>{safeConfidence}%</span>

      {showLabel && (
        <span className="hidden sm:inline font-body font-medium">
          {config.label}
        </span>
      )}
    </span>
  );
}