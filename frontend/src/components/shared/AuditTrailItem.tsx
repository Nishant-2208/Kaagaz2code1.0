import type {
  AuditTrailEntry,
} from '../../api/types';

interface AuditTrailItemProps {
  entry: AuditTrailEntry;
  isLast?: boolean;
}

export default function AuditTrailItem({
  entry,
  isLast = false,
}: AuditTrailItemProps) {
  const date = new Date(
    entry.timestamp,
  );

  const formattedDate =
    date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const formattedTime =
    date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  const actorLabel =
    entry.actorRole === 'officer'
      ? 'Officer'
      : entry.actorRole === 'admin'
        ? 'Administrator'
        : entry.actorRole === 'citizen'
          ? 'Citizen'
          : 'System';

  return (
    <div className="flex gap-md">

      {/* =====================================================
          TIMELINE
      ===================================================== */}

      <div className="flex flex-col items-center">

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-fixed">

          <span className="material-symbols-outlined text-xl text-on-primary-fixed-variant">
            {entry.icon}
          </span>

        </div>

        {!isLast && (
          <div className="mt-xs w-px flex-1 bg-outline-variant" />
        )}

      </div>

      {/* =====================================================
          CONTENT
      ===================================================== */}

      <div
        className={`flex-1 ${!isLast ? 'pb-lg' : ''
          }`}
      >

        {/* Header */}

        <div className="flex flex-col gap-xs sm:flex-row sm:items-start sm:justify-between">

          <div>

            <h4 className="text-[16px] font-semibold text-on-surface">
              {entry.action}
            </h4>

            <p className="mt-xs font-mono text-xs text-outline">
              {entry.actor} · {actorLabel}
            </p>

          </div>

          <div className="shrink-0 font-mono text-xs text-outline">

            <div>
              {formattedDate}
            </div>

            <div className="text-[11px]">
              {formattedTime}
            </div>

          </div>

        </div>

        {/* Details */}

        {entry.details && (
          <p className="mt-sm text-sm leading-6 text-on-surface-variant">
            {entry.details}
          </p>
        )}

        {/* ===================================================
            FIELD CHANGE
        =================================================== */}

        {entry.fieldChanged && (
          <div className="mt-sm rounded-lg border border-outline-variant bg-surface-container p-sm">

            <span className="mb-xs block text-[10px] font-semibold uppercase tracking-[0.08em] text-outline">
              Field Changed: {entry.fieldChanged}
            </span>

            <div className="flex flex-wrap items-center gap-sm">

              {entry.oldValue && (
                <span className="font-mono text-xs text-error line-through">
                  {entry.oldValue}
                </span>
              )}

              {entry.oldValue &&
                entry.newValue && (
                  <span className="material-symbols-outlined text-[16px] text-outline">
                    arrow_forward
                  </span>
                )}

              {entry.newValue && (
                <span className="font-mono text-xs font-semibold text-success">
                  {entry.newValue}
                </span>
              )}

            </div>

          </div>
        )}

        {/* ===================================================
            AUDIT METADATA
        =================================================== */}

        {(entry.sourceDocumentId ||
          entry.reason ||
          entry.confidence !== undefined ||
          entry.modelVersion) && (
            <div className="mt-sm grid grid-cols-1 gap-2 sm:grid-cols-2">

              {entry.sourceDocumentId && (
                <AuditMetadata
                  label="Source Document"
                  value={
                    entry.sourceDocumentId
                  }
                />
              )}

              {entry.reason && (
                <AuditMetadata
                  label="Reason"
                  value={entry.reason}
                />
              )}

              {entry.confidence !==
                undefined && (
                  <AuditMetadata
                    label="Confidence"
                    value={`${entry.confidence}%`}
                  />
                )}

              {entry.modelVersion && (
                <AuditMetadata
                  label="Model Version"
                  value={
                    entry.modelVersion
                  }
                />
              )}

            </div>
          )}

      </div>

    </div>
  );
}

/* =========================================================
   AUDIT METADATA
   ========================================================= */

function AuditMetadata({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-outline-variant bg-surface-container-low px-3 py-2">

      <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-outline">
        {label}
      </p>

      <p className="mt-1 truncate font-mono text-[10px] text-on-surface">
        {value}
      </p>

    </div>
  );
}