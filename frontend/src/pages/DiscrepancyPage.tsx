import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockDiscrepancy } from '../api/mockData';

const disc = mockDiscrepancy;

type ResolutionChoice =
  | 'recordA'
  | 'recordB'
  | null;

export default function DiscrepancyPage() {
  const navigate = useNavigate();

  const [selectedSource, setSelectedSource] =
    useState<ResolutionChoice>(null);

  const [resolved, setResolved] =
    useState(false);

  const [showEscalation, setShowEscalation] =
    useState(false);

  const [escalationReason, setEscalationReason] =
    useState('');

  const handleResolve = () => {
    if (!selectedSource) {
      return;
    }

    setResolved(true);
  };

  const handleEscalate = () => {
    if (!escalationReason.trim()) {
      return;
    }

    setShowEscalation(false);
    setEscalationReason('');
  };

  if (resolved) {
    return (
      <ResolvedState
        selectedSource={selectedSource}
        taskId={disc.taskId}
        onBack={() => navigate('/queue')}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1380px] px-4 py-6 sm:px-6 lg:px-8">

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <header className="mb-6">

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <div className="flex flex-wrap items-center gap-2 text-xs">

              <button
                type="button"
                onClick={() => navigate('/queue')}
                className="font-semibold text-on-surface-variant transition hover:text-primary"
              >
                Review Queue
              </button>

              <span className="text-outline">
                /
              </span>

              <span className="font-semibold text-primary">
                Discrepancy Resolution
              </span>

            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">

              <h1 className="text-3xl font-bold tracking-tight text-on-surface">
                Resolve Record Conflict
              </h1>

              <span className="rounded-full bg-red-50 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-red-700">
                Human Review Required
              </span>

            </div>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
              Compare the scanned document with the existing
              database record before deciding which source should
              become the verified record.
            </p>

          </div>

          <div className="shrink-0">

            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-outline">
              Task
            </p>

            <p className="mt-1 font-mono text-sm font-semibold text-on-surface">
              {disc.taskId}
            </p>

          </div>

        </div>

      </header>

      {/* =====================================================
          DISCREPANCY SUMMARY
      ===================================================== */}

      <section className="mb-6 rounded-xl border border-red-200 bg-red-50/60">

        <div className="px-5 py-5 sm:px-6">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

            <div className="max-w-4xl">

              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-700">
                Discrepancy Detected
              </p>

              <h2 className="mt-1 text-xl font-bold text-red-900">
                Critical data mismatch
              </h2>

              <p className="mt-2 text-sm leading-6 text-red-800/90">
                {disc.flaggedReason}
              </p>

            </div>

            <div className="flex shrink-0 gap-3">

              <SummaryMetric
                label="Confidence"
                value={`${disc.confidenceScore}%`}
              />

              <SummaryMetric
                label="OCR Engine"
                value={disc.ocrEngine}
              />

            </div>

          </div>

          {/* Flagged fields */}

          <div className="mt-5 border-t border-red-200 pt-4">

            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-red-700">
              Fields requiring comparison
            </p>

            <div className="mt-2 flex flex-wrap gap-2">

              {disc.flaggedFields.map(
                (field) => (
                  <span
                    key={field}
                    className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-800"
                  >
                    {field}
                  </span>
                ),
              )}

            </div>

          </div>

        </div>

      </section>

      {/* =====================================================
          COMPARISON
      ===================================================== */}

      <section>

        <div className="mb-4">

          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
            Evidence Comparison
          </p>

          <h2 className="mt-1 text-xl font-bold text-on-surface">
            Compare both sources
          </h2>

          <p className="mt-1 text-sm text-on-surface-variant">
            Review the conflicting values and select the source
            that should be used for the verified record.
          </p>

        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">

          {/* =================================================
              RECORD A
          ================================================= */}

          <ComparisonCard
            title="Record A"
            source={disc.recordA.source}
            selected={
              selectedSource === 'recordA'
            }
            onSelect={() =>
              setSelectedSource('recordA')
            }
            fields={[
              {
                label: 'Property ID',
                value: disc.recordA.propertyId,
              },
              {
                label: 'Owner Name',
                value: disc.recordA.ownerName,
                flagged: true,
              },
              {
                label: 'Survey No.',
                value: disc.recordA.surveyNo,
                flagged: true,
              },
              {
                label: 'Area',
                value: disc.recordA.area,
              },
            ]}
          >

            <SourceEvidence
              title="Source Document"
              imageUrl={disc.recordA.imageUrl}
            />

          </ComparisonCard>

          {/* =================================================
              RECORD B
          ================================================= */}

          <ComparisonCard
            title="Record B"
            source={disc.recordB.source}
            selected={
              selectedSource === 'recordB'
            }
            onSelect={() =>
              setSelectedSource('recordB')
            }
            fields={[
              {
                label: 'Property ID',
                value: disc.recordB.propertyId,
              },
              {
                label: 'Owner Name',
                value: disc.recordB.ownerName,
                flagged: true,
              },
              {
                label: 'Survey No.',
                value: disc.recordB.surveyNo,
                flagged: true,
              },
              {
                label: 'Area',
                value: disc.recordB.area,
              },
            ]}
          >

            <SystemLineage
              lastUpdated={
                disc.recordB.lastUpdated
              }
              updatedBy={
                disc.recordB.updatedBy
              }
              sourceDb={
                disc.recordB.sourceDb
              }
            />

          </ComparisonCard>

        </div>

      </section>

      {/* =====================================================
          DECISION AREA
      ===================================================== */}

      <section className="mt-6 rounded-xl border border-outline-variant/70 bg-surface-container-lowest">

        <div className="border-b border-outline-variant/70 px-5 py-4 sm:px-6">

          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
            Resolution Decision
          </p>

          <h2 className="mt-1 text-lg font-bold text-on-surface">
            Select the source for the verified record
          </h2>

          <p className="mt-1 text-xs leading-5 text-on-surface-variant">
            Your decision will be recorded in the audit trail.
            The rejected value will not silently overwrite the
            existing record.
          </p>

        </div>

        <div className="px-5 py-5 sm:px-6">

          {/* Selected source */}

          <div className="rounded-lg border border-outline-variant/70 bg-surface-container-low px-4 py-4">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-outline">
                  Selected Source
                </p>

                <p className="mt-1 text-sm font-semibold text-on-surface">

                  {selectedSource === 'recordA'
                    ? 'Record A — Scanned Document'
                    : selectedSource === 'recordB'
                      ? 'Record B — Database Entry'
                      : 'No source selected'}

                </p>

              </div>

              {selectedSource && (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedSource(null)
                  }
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Clear selection
                </button>
              )}

            </div>

          </div>

          {/* Actions */}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">

            <button
              type="button"
              onClick={() =>
                setShowEscalation(true)
              }
              className="min-h-11 rounded-lg border border-outline-variant px-5 text-xs font-semibold text-on-surface transition hover:bg-surface-container"
            >
              Escalate for Review
            </button>

            <button
              type="button"
              disabled={!selectedSource}
              onClick={handleResolve}
              className={[
                'min-h-11 rounded-lg px-5 text-xs font-semibold transition',
                selectedSource
                  ? 'bg-primary text-on-primary hover:bg-primary-container'
                  : 'cursor-not-allowed bg-surface-container text-outline',
              ].join(' ')}
            >
              Confirm Resolution
            </button>

          </div>

        </div>

      </section>

      {/* =====================================================
          SAFETY NOTE
      ===================================================== */}

      <div className="mt-5 rounded-lg border border-outline-variant/70 bg-surface-container-low px-5 py-4">

        <p className="text-xs font-semibold text-on-surface">
          Verification safeguard
        </p>

        <p className="mt-1 text-xs leading-5 text-on-surface-variant">
          Kaagaz2Code identifies and presents discrepancies for
          human review. It does not independently determine legal
          ownership or resolve land disputes.
        </p>

      </div>

      {/* =====================================================
          ESCALATION DIALOG
      ===================================================== */}

      {showEscalation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">

          <div className="w-full max-w-lg rounded-xl border border-outline-variant bg-surface-container-lowest shadow-xl">

            <div className="border-b border-outline-variant px-5 py-4">

              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                Escalation
              </p>

              <h2 className="mt-1 text-lg font-bold text-on-surface">
                Escalate this conflict
              </h2>

            </div>

            <div className="px-5 py-5">

              <label
                htmlFor="escalation-reason"
                className="text-xs font-semibold text-on-surface"
              >
                Reason
              </label>

              <textarea
                id="escalation-reason"
                value={escalationReason}
                onChange={(event) =>
                  setEscalationReason(
                    event.target.value,
                  )
                }
                rows={4}
                placeholder="Explain why this conflict requires further review."
                className="mt-2 w-full resize-none rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
              />

            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-outline-variant px-5 py-4 sm:flex-row sm:justify-end">

              <button
                type="button"
                onClick={() =>
                  setShowEscalation(false)
                }
                className="min-h-10 rounded-lg border border-outline-variant px-4 text-xs font-semibold text-on-surface hover:bg-surface-container"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  !escalationReason.trim()
                }
                onClick={handleEscalate}
                className={[
                  'min-h-10 rounded-lg px-4 text-xs font-semibold',
                  escalationReason.trim()
                    ? 'bg-primary text-on-primary hover:bg-primary-container'
                    : 'cursor-not-allowed bg-surface-container text-outline',
                ].join(' ')}
              >
                Submit Escalation
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

/* =========================================================
   SUMMARY METRIC
   ========================================================= */

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-[110px] rounded-lg border border-red-200 bg-white px-3 py-2.5">

      <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-red-700">
        {label}
      </p>

      <p className="mt-1 font-mono text-xs font-bold text-red-900">
        {value}
      </p>

    </div>
  );
}

/* =========================================================
   COMPARISON CARD
   ========================================================= */

function ComparisonCard({
  title,
  source,
  selected,
  onSelect,
  fields,
  children,
}: {
  title: string;
  source: string;
  selected: boolean;
  onSelect: () => void;
  fields: {
    label: string;
    value: string;
    flagged?: boolean;
  }[];
  children: React.ReactNode;
}) {
  return (
    <article
      className={[
        'overflow-hidden rounded-xl border bg-surface-container-lowest transition',
        selected
          ? 'border-primary ring-2 ring-primary/15'
          : 'border-outline-variant/70',
      ].join(' ')}
    >

      {/* Header */}

      <div className="flex flex-col gap-3 border-b border-outline-variant/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

        <div>

          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
            {title}
          </p>

          <h3 className="mt-1 text-lg font-bold text-on-surface">
            {source}
          </h3>

        </div>

        {selected && (
          <span className="rounded-full bg-primary-fixed px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
            Selected
          </span>
        )}

      </div>

      {/* Fields */}

      <div className="divide-y divide-outline-variant/60">

        {fields.map((field) => (
          <div
            key={field.label}
            className={[
              'grid grid-cols-1 gap-1 px-5 py-4 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4',
              field.flagged
                ? 'bg-red-50/60'
                : '',
            ].join(' ')}
          >

            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-outline">
              {field.label}
            </span>

            <span
              className={[
                'break-words text-sm font-semibold',
                field.flagged
                  ? 'text-red-800'
                  : 'text-on-surface',
              ].join(' ')}
            >
              {field.value}
            </span>

          </div>
        ))}

      </div>

      {/* Evidence */}

      <div className="border-t border-outline-variant/70 px-5 py-5">

        {children}

      </div>

      {/* Select */}

      <div className="border-t border-outline-variant/70 px-5 py-4">

        <button
          type="button"
          onClick={onSelect}
          className={[
            'w-full min-h-11 rounded-lg border px-4 text-xs font-semibold transition',
            selected
              ? 'border-primary bg-primary text-on-primary'
              : 'border-outline-variant text-on-surface hover:border-primary hover:bg-primary-fixed',
          ].join(' ')}
        >
          {selected
            ? 'Selected as Verified Source'
            : `Use ${title} as Source`}
        </button>

      </div>

    </article>
  );
}

/* =========================================================
   SOURCE EVIDENCE
   ========================================================= */

function SourceEvidence({
  title,
  imageUrl,
}: {
  title: string;
  imageUrl?: string;
}) {
  return (
    <div>

      <div className="flex items-center justify-between">

        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-outline">
          {title}
        </p>

        <span className="text-[10px] text-on-surface-variant">
          Scanned evidence
        </span>

      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-low">

        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Relevant region from scanned land record"
            className="block h-56 w-full object-cover grayscale"
          />
        ) : (
          <div className="flex h-56 items-center justify-center px-5 text-center">

            <p className="text-xs text-on-surface-variant">
              Source image unavailable.
            </p>

          </div>
        )}

      </div>

      <p className="mt-2 text-[11px] leading-5 text-on-surface-variant">
        Review the scanned evidence before selecting this source.
      </p>

    </div>
  );
}

/* =========================================================
   SYSTEM LINEAGE
   ========================================================= */

function SystemLineage({
  lastUpdated,
  updatedBy,
  sourceDb,
}: {
  lastUpdated?: string;
  updatedBy?: string;
  sourceDb?: string;
}) {
  return (
    <div>

      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-outline">
        System Lineage
      </p>

      <div className="mt-3 divide-y divide-outline-variant/60 rounded-lg border border-outline-variant/70">

        <LineageRow
          label="Last Updated"
          value={lastUpdated ?? 'Not available'}
        />

        <LineageRow
          label="Updated By"
          value={updatedBy ?? 'Not available'}
        />

        <LineageRow
          label="Source Database"
          value={sourceDb ?? 'Not available'}
        />

      </div>

      <p className="mt-2 text-[11px] leading-5 text-on-surface-variant">
        Existing database lineage is shown for comparison
        and must not be treated as independent proof of ownership.
      </p>

    </div>
  );
}

/* =========================================================
   LINEAGE ROW
   ========================================================= */

function LineageRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 px-3 py-2.5 sm:grid-cols-[120px_1fr] sm:items-center sm:gap-3">

      <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-outline">
        {label}
      </span>

      <span className="break-words font-mono text-[10px] text-on-surface-variant">
        {value}
      </span>

    </div>
  );
}

/* =========================================================
   RESOLVED STATE
   ========================================================= */

function ResolvedState({
  selectedSource,
  taskId,
  onBack,
}: {
  selectedSource: ResolutionChoice;
  taskId: string;
  onBack: () => void;
}) {
  const sourceLabel =
    selectedSource === 'recordA'
      ? 'Record A — Scanned Document'
      : 'Record B — Database Entry';

  return (
    <div className="mx-auto flex min-h-[65vh] w-full max-w-2xl items-center justify-center px-4 py-10">

      <div className="w-full rounded-xl border border-outline-variant/70 bg-surface-container-lowest p-6 text-center sm:p-8">

        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">

          <span className="h-3 w-3 rounded-full bg-emerald-600" />

        </div>

        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
          Resolution Recorded
        </p>

        <h1 className="mt-2 text-2xl font-bold text-on-surface">
          Conflict resolution completed
        </h1>

        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-on-surface-variant">
          {sourceLabel} was selected for task{' '}
          <span className="font-mono">
            {taskId}
          </span>
          . The decision should be preserved in the record's
          audit history.
        </p>

        <button
          type="button"
          onClick={onBack}
          className="mt-6 min-h-11 rounded-lg bg-primary px-5 text-xs font-semibold text-on-primary hover:bg-primary-container"
        >
          Return to Review Queue
        </button>

      </div>

    </div>
  );
}