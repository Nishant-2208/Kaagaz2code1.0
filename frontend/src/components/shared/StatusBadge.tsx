import type { RecordStatus } from '../../api/types';

interface StatusBadgeProps {
  status: RecordStatus;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

const STATUS_CONFIG: Record<
  RecordStatus,
  {
    label: string;
    icon: string;
    classes: string;
  }
> = {
  pending_review: {
    label: 'Pending Review',
    icon: 'schedule',
    classes:
      'bg-surface-variant text-on-surface-variant border-outline-variant',
  },

  in_review: {
    label: 'In Review',
    icon: 'rate_review',
    classes:
      'bg-warning-container text-on-warning-container border-warning',
  },

  verified: {
    label: 'Verified',
    icon: 'verified',
    classes:
      'bg-secondary-fixed text-on-secondary-fixed border-secondary',
  },

  flagged: {
    label: 'Flagged',
    icon: 'flag',
    classes:
      'bg-error-container text-on-error-container border-error',
  },

  discrepancy: {
    label: 'Discrepancy',
    icon: 'warning',
    classes:
      'bg-error-container text-on-error-container border-error',
  },

  locked: {
    label: 'Locked',
    icon: 'lock',
    classes:
      'bg-surface-container-high text-on-surface-variant border-outline-variant',
  },
};

export default function StatusBadge({
  status,
  size = 'sm',
  showIcon = true,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  const sizeClasses =
    size === 'sm'
      ? 'text-[11px] px-2 py-1'
      : 'text-[13px] px-3 py-1.5';

  return (
    <span
      title={config.label}
      aria-label={`Status: ${config.label}`}
      className={[
        'inline-flex items-center justify-center',
        'gap-1.5',
        'rounded-sm',
        'border',
        'font-medium',
        'whitespace-nowrap',
        'transition-colors',
        sizeClasses,
        config.classes,
      ].join(' ')}
    >
      {showIcon && (
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-[15px]"
        >
          {config.icon}
        </span>
      )}

      <span>{config.label}</span>
    </span>
  );
}