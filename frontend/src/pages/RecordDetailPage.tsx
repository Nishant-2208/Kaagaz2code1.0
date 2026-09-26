import { useNavigate, useParams } from 'react-router-dom';
import { mockAuditTrail, mockRecords } from '../api/mockData';
import type { AuditTrailEntry } from '../api/types';

export default function RecordDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const record =
    mockRecords.find((item) => item.id === id) ??
    mockRecords[0];

  const verified =
    record.status === 'verified' ||
    record.status === 'locked';

  const formattedUpdatedAt = new Date(
    record.updatedAt,
  ).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const recordFields = [
    {
      label: 'Khasra / Survey No.',
      value: record.khasraNo,
    },
    {
      label: 'Owner',
      value: record.ownerName,
    },
    {
      label: 'Area',
      value: `${record.area} ${record.areaUnit}`,
    },
    {
      label: 'Village',
      value: record.village,
    },
    {
      label: 'Tehsil',
      value: record.tehsil,
    },
    {
      label: 'District',
      value: record.district,
    },
    {
      label: 'Registration Date',
      value: record.registrationDate,
    },
    {
      label: 'Land Type',
      value: record.landType ?? 'Agricultural',
    },
  ];

  const auditEntries: AuditTrailEntry[] =
    mockAuditTrail;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="mb-6">

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div className="min-w-0">

            <div className="flex flex-wrap items-center gap-2 text-xs">

              <span className="font-semibold uppercase tracking-[0.12em] text-primary">
                Record Details
              </span>

              <span className="text-outline">
                /
              </span>

              <span className="font-mono text-on-surface-variant">
                {record.id}
              </span>

            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">

              <h1 className="text-3xl font-bold tracking-tight text-on-surface">
                {record.id}
              </h1>

              <StatusBadge
                verified={verified}
              />

            </div>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
              Land record with source evidence,
              extracted values, and processing history.
            </p>

          </div>

          <div className="flex flex-wrap gap-2">

            <button
              type="button"
              onClick={() =>
                navigate(
                  `/records/${record.id}/multilingual`,
                )
              }
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-xs font-semibold text-on-surface transition hover:bg-surface-container"
            >
              Multilingual View
            </button>

            <button
              type="button"
              onClick={() =>
                navigate('/review')
              }
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-xs font-semibold text-on-primary transition hover:bg-primary-container"
            >
              Open Review
            </button>

          </div>

        </div>

      </header>

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <section className="mb-6 overflow-hidden rounded-xl border border-outline-variant/70 bg-surface-container-lowest">

        <div className="grid grid-cols-2 divide-x divide-y divide-outline-variant/70 lg:grid-cols-4 lg:divide-y-0">

          <SummaryItem
            label="Overall Confidence"
            value={`${record.overallConfidence}%`}
            supporting="Extraction confidence"
            positive
          />

          <SummaryItem
            label="Khasra / Survey"
            value={record.khasraNo}
            supporting="Land identifier"
          />

          <SummaryItem
            label="Village"
            value={record.village}
            supporting={record.district}
          />

          <SummaryItem
            label="Record Version"
            value="v1"
            supporting={`Updated ${formattedUpdatedAt}`}
          />

        </div>

      </section>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.4fr)]">

        {/* ===================================================
            SOURCE COLUMN
        =================================================== */}

        <section className="min-w-0">

          <div className="overflow-hidden rounded-xl border border-outline-variant/70 bg-surface-container-lowest">

            {/* Section header */}

            <div className="border-b border-outline-variant/70 px-5 py-4">

              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                Source Evidence
              </p>

              <h2 className="mt-1 text-lg font-bold text-on-surface">
                Original Document
              </h2>

              <p className="mt-1 text-xs text-on-surface-variant">
                Original scanned source preserved with this record.
              </p>

            </div>

            {/* Document */}

            <div className="bg-surface-container-low p-4 sm:p-6">

              <div className="overflow-hidden rounded-lg border border-outline-variant bg-white">

                <img
                  src={record.sourceImageUrl}
                  alt="Original scanned land record"
                  className="block h-auto w-full object-contain"
                />

              </div>

            </div>

            {/* Source note */}

            <div className="border-t border-outline-variant/70 px-5 py-4">

              <p className="text-xs font-semibold text-on-surface">
                Source preserved
              </p>

              <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                The original document remains linked
                to the structured record.
              </p>

            </div>

          </div>

          {/* =================================================
              PROCESSING
          ================================================= */}

          <div className="mt-6 rounded-xl border border-outline-variant/70 bg-surface-container-lowest">

            <div className="border-b border-outline-variant/70 px-5 py-4">

              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                Processing
              </p>

              <h2 className="mt-1 text-lg font-bold text-on-surface">
                Extraction Metrics
              </h2>

            </div>

            <div className="divide-y divide-outline-variant/60">

              <MetricRow
                label="OCR Confidence"
                value="98.4%"
                positive
              />

              <MetricRow
                label="Extraction Confidence"
                value={`${record.overallConfidence}%`}
                positive
              />

              <MetricRow
                label="Language Detected"
                value="Hindi · Devanagari"
              />

              <MetricRow
                label="Processing Time"
                value="1.24s"
              />

              <MetricRow
                label="Processing Model"
                value="OCR Engine v3.1"
              />

            </div>

          </div>

        </section>

        {/* ===================================================
            DATA COLUMN
        =================================================== */}

        <section className="min-w-0 space-y-6">

          {/* =================================================
              RECORD DATA
          ================================================= */}

          <div className="overflow-hidden rounded-xl border border-outline-variant/70 bg-surface-container-lowest">

            <div className="flex flex-col gap-3 border-b border-outline-variant/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                  Structured Record
                </p>

                <h2 className="mt-1 text-lg font-bold text-on-surface">
                  Record Data
                </h2>

                <p className="mt-1 text-xs text-on-surface-variant">
                  Current structured values associated with this record.
                </p>

              </div>

              <StatusBadge
                verified={verified}
              />

            </div>

            <div className="grid grid-cols-1 divide-y divide-outline-variant/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0">

              <div className="divide-y divide-outline-variant/60">

                {recordFields
                  .filter(
                    (_, index) =>
                      index % 2 === 0,
                  )
                  .map((field) => (
                    <RecordField
                      key={field.label}
                      label={field.label}
                      value={field.value}
                    />
                  ))}

              </div>

              <div className="divide-y divide-outline-variant/60">

                {recordFields
                  .filter(
                    (_, index) =>
                      index % 2 !== 0,
                  )
                  .map((field) => (
                    <RecordField
                      key={field.label}
                      label={field.label}
                      value={field.value}
                    />
                  ))}

              </div>

            </div>

            <div className="border-t border-outline-variant/70 bg-surface-container-low px-5 py-4">

              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

                <span className="text-xs font-semibold text-on-surface">
                  Record integrity
                </span>

                <span className="text-xs text-on-surface-variant">
                  Changes require human verification.
                </span>

              </div>

            </div>

          </div>

          {/* =================================================
              AUDIT TRAIL
          ================================================= */}

          <div className="overflow-hidden rounded-xl border border-outline-variant/70 bg-surface-container-lowest">

            <div className="flex flex-col gap-3 border-b border-outline-variant/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                  Traceability
                </p>

                <h2 className="mt-1 text-lg font-bold text-on-surface">
                  Processing Audit Trail
                </h2>

                <p className="mt-1 text-xs text-on-surface-variant">
                  Processing and verification history for this record.
                </p>

              </div>

              <span className="font-mono text-xs text-on-surface-variant">
                {auditEntries.length} events
              </span>

            </div>

            <div className="p-5 sm:p-6">

              {auditEntries.length > 0 ? (
                <div>

                  {auditEntries.map(
                    (entry, index) => (
                      <AuditEvent
                        key={entry.id}
                        entry={entry}
                        isLast={
                          index ===
                          auditEntries.length - 1
                        }
                      />
                    ),
                  )}

                </div>
              ) : (
                <div className="py-10 text-center">

                  <p className="text-sm font-semibold text-on-surface">
                    No audit events available
                  </p>

                  <p className="mt-1 text-xs text-on-surface-variant">
                    Processing history will appear here.
                  </p>

                </div>
              )}

            </div>

          </div>

          {/* =================================================
              TRUST NOTE
          ================================================= */}

          <div className="rounded-xl border border-primary/15 bg-primary-fixed/20 px-5 py-4">

            <p className="text-sm font-semibold text-on-surface">
              Traceable digitization
            </p>

            <p className="mt-1 text-xs leading-5 text-on-surface-variant">
              The source document, extracted values,
              confidence information, and verification
              actions remain connected throughout the
              record lifecycle.
            </p>

          </div>

        </section>

      </div>

      {/* =====================================================
          ACTIONS
      ===================================================== */}

      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-outline-variant/70 bg-surface-container-lowest p-4 sm:flex-row sm:items-center sm:justify-between">

        <div>

          <p className="text-sm font-semibold text-on-surface">
            {record.id}
          </p>

          <p className="mt-1 text-xs text-on-surface-variant">
            Last updated {formattedUpdatedAt}
          </p>

        </div>

        <div className="flex flex-col gap-2 sm:flex-row">

          <button
            type="button"
            onClick={() =>
              navigate('/queue')
            }
            className="min-h-10 rounded-lg border border-outline-variant px-4 text-xs font-semibold text-on-surface transition hover:bg-surface-container"
          >
            Back to Queue
          </button>

          <button
            type="button"
            onClick={() =>
              navigate(
                `/records/${record.id}/multilingual`,
              )
            }
            className="min-h-10 rounded-lg bg-primary px-4 text-xs font-semibold text-on-primary transition hover:bg-primary-container"
          >
            View Normalized Data
          </button>

        </div>

      </div>

    </div>
  );
}

/* =========================================================
   STATUS BADGE
   ========================================================= */

function StatusBadge({
  verified,
}: {
  verified: boolean;
}) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-3 py-1.5',
        'text-[10px] font-bold uppercase tracking-[0.08em]',
        verified
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-amber-50 text-amber-800',
      ].join(' ')}
    >
      {verified
        ? 'Verified'
        : 'Pending Review'}
    </span>
  );
}

/* =========================================================
   SUMMARY ITEM
   ========================================================= */

function SummaryItem({
  label,
  value,
  supporting,
  positive = false,
}: {
  label: string;
  value: string;
  supporting: string;
  positive?: boolean;
}) {
  return (
    <div className="min-w-0 p-4 sm:p-5">

      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
        {label}
      </p>

      <p
        className={[
          'mt-2 truncate font-mono text-xl font-bold',
          positive
            ? 'text-emerald-700'
            : 'text-on-surface',
        ].join(' ')}
      >
        {value}
      </p>

      <p className="mt-1 truncate text-xs text-on-surface-variant">
        {supporting}
      </p>

    </div>
  );
}

/* =========================================================
   RECORD FIELD
   ========================================================= */

function RecordField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="px-5 py-4">

      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-outline">
        {label}
      </p>

      <p className="mt-1.5 break-words text-sm font-semibold text-on-surface">
        {value}
      </p>

    </div>
  );
}

/* =========================================================
   METRIC ROW
   ========================================================= */

function MetricRow({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">

      <span className="text-xs text-on-surface-variant">
        {label}
      </span>

      <span
        className={[
          'shrink-0 font-mono text-xs font-semibold',
          positive
            ? 'text-emerald-700'
            : 'text-on-surface',
        ].join(' ')}
      >
        {value}
      </span>

    </div>
  );
}

/* =========================================================
   AUDIT EVENT
   ========================================================= */

function AuditEvent({
  entry,
  isLast,
}: {
  entry: AuditTrailEntry;
  isLast: boolean;
}) {
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
    });

  const isVerified =
    entry.action
      .toLowerCase()
      .includes('verified');

  const isCorrection =
    entry.action
      .toLowerCase()
      .includes('correction');

  return (
    <div className="flex gap-4">

      {/* Timeline */}

      <div className="flex w-3 shrink-0 flex-col items-center">

        <div
          className={[
            'mt-1 h-2.5 w-2.5 rounded-full',
            isVerified
              ? 'bg-emerald-600'
              : isCorrection
                ? 'bg-amber-500'
                : 'bg-primary',
          ].join(' ')}
        />

        {!isLast && (
          <div className="mt-2 w-px flex-1 bg-outline-variant" />
        )}

      </div>

      {/* Content */}

      <div
        className={[
          'min-w-0 flex-1',
          !isLast ? 'pb-6' : '',
        ].join(' ')}
      >

        <div className="rounded-lg border border-outline-variant/70 bg-surface-container-low p-4">

          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">

            <div className="min-w-0">

              <h3 className="text-sm font-semibold text-on-surface">
                {entry.action}
              </h3>

              <p className="mt-1 text-xs text-on-surface-variant">
                {entry.actor}
                {' · '}
                {entry.actorRole === 'officer'
                  ? 'Officer'
                  : entry.actorRole === 'admin'
                    ? 'Administrator'
                    : entry.actorRole === 'citizen'
                      ? 'Citizen'
                      : 'System'}
              </p>

            </div>

            <div className="shrink-0 text-left sm:text-right">

              <p className="font-mono text-[10px] text-on-surface-variant">
                {formattedDate}
              </p>

              <p className="mt-0.5 font-mono text-[10px] text-outline">
                {formattedTime}
              </p>

            </div>

          </div>

          {entry.details && (
            <p className="mt-3 text-xs leading-5 text-on-surface-variant">
              {entry.details}
            </p>
          )}

          {entry.fieldChanged && (
            <div className="mt-3 border-t border-outline-variant/60 pt-3">

              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-outline">
                Field Changed
              </p>

              <p className="mt-1 text-xs font-semibold text-on-surface">
                {entry.fieldChanged}
              </p>

              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">

                <div>

                  <p className="text-[9px] uppercase text-outline">
                    Previous
                  </p>

                  <p className="mt-1 break-words font-mono text-xs text-error line-through">
                    {entry.oldValue ?? '—'}
                  </p>

                </div>

                <div>

                  <p className="text-[9px] uppercase text-outline">
                    Updated
                  </p>

                  <p className="mt-1 break-words font-mono text-xs font-semibold text-emerald-700">
                    {entry.newValue ?? '—'}
                  </p>

                </div>

              </div>

            </div>
          )}

          {entry.reason && (
            <div className="mt-3 border-t border-outline-variant/60 pt-3">

              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-outline">
                Reason
              </p>

              <p className="mt-1 text-xs text-on-surface-variant">
                {entry.reason}
              </p>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}