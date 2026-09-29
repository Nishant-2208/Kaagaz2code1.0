import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getExtractedFields,
  getRecordById,
  getRecords,
  downloadDocument,
  submitReviewDecision,
  submitRecordReview,
} from '../api/services';
import type { ExtractedField, LandRecord } from '../api/types';
import { ConfidenceBadge } from '../components/shared';
import { useAuth } from '../contexts/AuthContext';

interface LocationState {
  recordId?: string;
  batchId?: string;
}

export default function ReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { recordId } = (location.state as LocationState) ?? {};
  const { user } = useAuth();
  const canDecide = user?.role === 'reviewer' || user?.role === 'admin';

  const [record, setRecord] = useState<LandRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
  const [sourcePreviewType, setSourcePreviewType] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [fields, setFields] = useState<
    (ExtractedField & { editedValue: string })[]
  >([]);

  const [activeField, setActiveField] =
    useState<string | null>(null);

  const [showLowConfidenceOnly, setShowLowConfidenceOnly] =
    useState(false);

  const [note, setNote] = useState('');

  // Load the record awaiting review — either the one just produced by
  // the upload pipeline, or the next pending record if none was passed.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError('');

      try {
        const resolvedRecord = recordId
          ? await getRecordById(recordId)
          : (await getRecords())[0];

        if (!resolvedRecord) {
          throw new Error('No record found for review.');
        }

        const extracted = await getExtractedFields(resolvedRecord.id);

        if (cancelled) return;

        setRecord(resolvedRecord);
        setFields(
          extracted.map((field) => ({
            ...field,
            editedValue: field.editedValue ?? field.value,
          })),
        );

        try {
          const sourceBlob = await downloadDocument(resolvedRecord.id);
          const sourceUrl = URL.createObjectURL(sourceBlob);

          if (!cancelled) {
            setSourcePreviewUrl((previous) => {
              if (previous) URL.revokeObjectURL(previous);
              return sourceUrl;
            });
            setSourcePreviewType(sourceBlob.type || '');
          } else {
            URL.revokeObjectURL(sourceUrl);
          }
        } catch {
          if (!cancelled) {
            setSourcePreviewUrl(null);
            setSourcePreviewType('');
          }
        }
      } catch {
        if (!cancelled) {
          setLoadError(
            'Could not load the record for review. Confirm the processing service is reachable.',
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [recordId]);

  useEffect(() => {
    return () => {
      if (sourcePreviewUrl) {
        URL.revokeObjectURL(sourcePreviewUrl);
      }
    };
  }, [sourcePreviewUrl]);

  const lowConfidenceCount = fields.filter(
    (field) => field.confidence < 90,
  ).length;

  const visibleFields = useMemo(() => {
    if (!showLowConfidenceOnly) {
      return fields;
    }

    return fields.filter(
      (field) => field.confidence < 90,
    );
  }, [fields, showLowConfidenceOnly]);

  function updateField(
    fieldId: string,
    value: string,
  ) {
    setFields((current) =>
      current.map((field) =>
        field.fieldId === fieldId
          ? {
            ...field,
            editedValue: value,
          }
          : field,
      ),
    );
  }

  // Persist any field edits before recording a review decision, so the
  // audit trail captures the corrected values, not just the raw OCR output.
  async function persistEditedFields() {
    if (!record) return;

    const hasChanges = fields.some(
      (field) => field.editedValue !== field.value,
    );

    if (!hasChanges && !note.trim()) return;

    await submitRecordReview(
      record.id,
      fields,
      note.trim() || undefined,
    );
  }

  async function handleDecision(
    decision: 'approve' | 'reject' | 'request_changes',
  ) {
    if (!record) return;

    setSubmitError('');
    setIsSubmitting(true);

    try {
      await persistEditedFields();
      await submitReviewDecision({
        recordId: record.id,
        decision,
        comment: note || undefined,
      });

      navigate(
        decision === 'approve'
          ? `/records/${record.id}`
          : '/queue',
      );
    } catch {
      setSubmitError(
        'Could not save the review decision. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleApprove() {
    void handleDecision('approve');
  }

  function handleReject() {
    void handleDecision('reject');
  }

  async function handleSaveAndExit() {
    if (!record) {
      navigate('/queue');
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);

    try {
      await persistEditedFields();
      navigate('/queue');
    } catch {
      setSubmitError('Could not save your changes. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-sm text-on-surface-variant">
        Loading record for review…
      </div>
    );
  }

  if (loadError || !record) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="text-sm font-semibold text-on-surface">
          {loadError || 'No record is available for review.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/queue')}
          className="mt-4 rounded-lg border border-outline-variant px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container"
        >
          Back to Queue
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 py-6 sm:py-8">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

        <div>

          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            Human Verification
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-3">

            <h1 className="text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">
              Review Record
            </h1>

            <span className="font-mono text-sm font-semibold text-primary">
              {record.id}
            </span>

          </div>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
            Review extracted values against the source document
            before the record is committed to the institutional database.
          </p>

        </div>

        <div className="flex flex-wrap gap-2">

          <span className="rounded-md bg-amber-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-800">
            Pending Review
          </span>

          <span className="rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 font-mono text-[10px] text-on-surface-variant">
            {lowConfidenceCount} field
            {lowConfidenceCount === 1 ? '' : 's'} below 90%
          </span>

        </div>

      </header>

      {/* =====================================================
          REVIEW SUMMARY
      ===================================================== */}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">

        <SummaryCard
          label="Fields Extracted"
          value={fields.length}
          description="Structured values detected"
        />

        <SummaryCard
          label="High Confidence"
          value={
            fields.filter(
              (field) => field.confidence >= 90,
            ).length
          }
          description="Eligible for straightforward approval"
          success
        />

        <SummaryCard
          label="Needs Attention"
          value={lowConfidenceCount}
          description="Review before approval"
          warning
        />

      </section>

      {/* =====================================================
          REVIEW WORKSPACE
      ===================================================== */}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(480px,0.92fr)]">

        {/* ===================================================
            SOURCE DOCUMENT
            =================================================== */}

        <section className="flex min-h-[760px] flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[0_4px_18px_rgba(15,23,42,0.05)]">

          <div className="flex flex-col gap-3 border-b border-outline-variant bg-surface-container-low px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">

            <div>

              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-outline">
                Source Evidence
              </p>

              <h2 className="mt-1 text-lg font-bold text-on-surface">
                Original Document
              </h2>

            </div>

            <span className="font-mono text-[10px] text-on-surface-variant">
              SOURCE IMAGE
            </span>

          </div>

          <div className="flex-1 overflow-auto bg-[#f3f4f6] p-4 sm:p-6">

            <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-xl border border-outline-variant bg-white shadow-[0_6px_20px_rgba(15,23,42,0.10)]">

              {sourcePreviewUrl ? (
                sourcePreviewType.includes('pdf') ? (
                  <iframe
                    src={sourcePreviewUrl}
                    title="Original scanned land record"
                    className="block h-[calc(100vh-250px)] min-h-[760px] w-full border-0 bg-white"
                  />
                ) : (
                  <img
                    src={sourcePreviewUrl}
                    alt="Original scanned land record"
                    className="block h-auto max-h-[calc(100vh-250px)] min-h-[760px] w-full object-contain"
                  />
                )
              ) : (
                <div className="flex min-h-[420px] items-center justify-center px-6 text-center">
                  <div>
                    <span className="material-symbols-outlined text-4xl text-outline">
                      image_not_supported
                    </span>
                    <p className="mt-3 text-sm font-semibold text-on-surface">
                      Source document preview unavailable
                    </p>
                    <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                      The original file is still stored securely in the backend.
                    </p>
                  </div>
                </div>
              )}

            </div>

          </div>

          <div className="border-t border-outline-variant bg-surface-container-low px-5 py-4 sm:px-6">

            <div className="flex items-start gap-3">

              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" />

              <p className="text-xs leading-5 text-on-surface-variant">
                Use the source document as the authoritative reference
                when correcting extracted values.
              </p>

            </div>

          </div>

        </section>

        {/* ===================================================
            EXTRACTED DATA
            =================================================== */}

        <section className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[0_4px_18px_rgba(15,23,42,0.05)]">

          <div className="border-b border-outline-variant bg-surface-container-low px-5 py-4 sm:px-6">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

              <div>

                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-outline">
                  AI Extraction
                </p>

                <h2 className="mt-1 text-lg font-bold text-on-surface">
                  Extracted Fields
                </h2>

                <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                  Edit only values that require correction.
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setShowLowConfidenceOnly(
                    !showLowConfidenceOnly,
                  )
                }
                className={[
                  'min-h-10 rounded-lg border px-3 text-xs font-semibold transition-colors',
                  showLowConfidenceOnly
                    ? 'border-primary bg-primary-fixed text-primary'
                    : 'border-outline-variant text-on-surface-variant hover:bg-surface-container',
                ].join(' ')}
              >
                {showLowConfidenceOnly
                  ? 'Showing Attention Fields'
                  : 'Show Low Confidence'}
              </button>

            </div>

          </div>

          <div className="flex-1 divide-y divide-outline-variant overflow-auto">

            {visibleFields.map((field) => {

              const isLowConfidence =
                field.confidence < 90;

              const isActive =
                activeField === field.fieldId;

              return (
                <div
                  key={field.fieldId}
                  className={[
                    'p-5 transition-colors sm:p-6',
                    isLowConfidence
                      ? 'bg-amber-50/40'
                      : 'bg-surface-container-lowest',
                  ].join(' ')}
                >

                  {/* Field heading */}

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                    <div>

                      <p className="text-sm font-bold text-on-surface">
                        {field.label}
                      </p>

                      <p className="mt-1 font-mono text-[10px] text-outline">
                        {field.fieldId}
                      </p>

                    </div>

                    <ConfidenceBadge
                      confidence={field.confidence}
                    />

                  </div>

                  {/* Confidence explanation */}

                  {isLowConfidence && (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
                      This field has lower extraction confidence
                      and should be checked against the source.
                    </p>
                  )}

                  {/* Field value */}

                  <div className="mt-4">

                    <label
                      htmlFor={`field-${field.fieldId}`}
                      className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.08em] text-outline"
                    >
                      Extracted Value
                    </label>

                    <div
                      className={[
                        'rounded-lg border bg-surface transition-colors',
                        isActive
                          ? 'border-primary ring-2 ring-primary/10'
                          : isLowConfidence
                            ? 'border-amber-300'
                            : 'border-outline-variant',
                      ].join(' ')}
                    >

                      <input
                        id={`field-${field.fieldId}`}
                        type="text"
                        value={field.editedValue}
                        onFocus={() =>
                          setActiveField(field.fieldId)
                        }
                        onBlur={() =>
                          setActiveField(null)
                        }
                        onChange={(event) =>
                          updateField(
                            field.fieldId,
                            event.target.value,
                          )
                        }
                        className="min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-on-surface outline-none"
                      />

                    </div>

                  </div>

                  {/* Source info */}

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">

                    <FieldMeta
                      label="Source"
                      value="Original document"
                    />

                    <FieldMeta
                      label="Language"
                      value={field.language ?? field.sourceLanguage ?? '—'}
                    />

                    <FieldMeta
                      label="Confidence"
                      value={`${field.confidence}%`}
                    />

                  </div>

                </div>
              );
            })}

            {visibleFields.length === 0 && (
              <div className="flex min-h-[300px] items-center justify-center px-6 text-center">

                <div>

                  <p className="text-sm font-semibold text-on-surface">
                    No low-confidence fields
                  </p>

                  <p className="mt-1 text-xs text-on-surface-variant">
                    All extracted fields currently meet the
                    review threshold.
                  </p>

                </div>

              </div>
            )}

          </div>

        </section>

      </div>

      {/* =====================================================
          REVIEW NOTE
      ===================================================== */}

      <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 sm:p-6">

        <div>

          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
            Verification Note
          </p>

          <h2 className="mt-1 text-lg font-bold text-on-surface">
            Record your review decision
          </h2>

          <p className="mt-1 text-xs leading-5 text-on-surface-variant">
            Add a short reason for the approval, correction, or rejection.
            This note becomes part of the audit history.
          </p>

        </div>

        <textarea
          value={note}
          onChange={(event) =>
            setNote(event.target.value)
          }
          rows={4}
          placeholder="Example: Checked owner name and survey number against the source document."
          className="mt-4 w-full resize-y rounded-xl border border-outline-variant/70 bg-[#f4f6f9] px-4 py-3 text-sm text-on-surface outline-none transition-colors placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/10"
        />

      </section>

      {/* =====================================================
          ACTION BAR
      ===================================================== */}

      <section className="sticky bottom-3 z-20 rounded-2xl border border-outline-variant bg-surface-container-lowest/95 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.12)] backdrop-blur sm:p-5">

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div>

            <p className="text-sm font-semibold text-on-surface">
              Ready to complete review?
            </p>

            <p className="mt-1 text-xs text-on-surface-variant">
              The decision and note will be recorded in the audit trail.
            </p>

          </div>

          <div className={canDecide ? 'grid grid-cols-1 gap-2 sm:grid-cols-3' : 'grid grid-cols-1 gap-2 sm:grid-cols-1 sm:min-w-[240px]'}>
            {canDecide && (
              <button
                type="button"
                onClick={handleReject}
                disabled={isSubmitting}
                className="min-h-11 rounded-lg border border-error/30 px-5 text-xs font-semibold text-error transition-colors hover:bg-error-container disabled:opacity-50"
              >
                Reject
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleSaveAndExit()}
              disabled={isSubmitting}
              className="min-h-11 rounded-lg border border-outline-variant px-5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
            >
              {user?.role === 'officer' ? 'Save Corrections & Exit' : 'Save & Exit'}
            </button>

            {canDecide && (
              <button
                type="button"
                onClick={handleApprove}
                disabled={isSubmitting}
                className="min-h-11 rounded-lg bg-primary px-5 text-xs font-semibold text-on-primary transition-colors hover:bg-primary-container disabled:opacity-50"
              >
                {isSubmitting ? 'Saving…' : 'Approve & Verify'}
              </button>
            )}
          </div>

        </div>

        {submitError && (
          <p
            role="alert"
            className="mt-3 text-right text-xs font-medium text-error"
          >
            {submitError}
          </p>
        )}

      </section>

    </div>
  );
}

/* =========================================================
   SUMMARY CARD
   ========================================================= */

function SummaryCard({
  label,
  value,
  description,
  warning = false,
  success = false,
}: {
  label: string;
  value: number;
  description: string;
  warning?: boolean;
  success?: boolean;
}) {
  return (
    <div className="rounded-xl border border-outline-variant/70 bg-[#f4f6f9]est p-5">

      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-outline">
        {label}
      </p>

      <p
        className={[
          'mt-2 font-mono text-2xl font-bold',
          warning
            ? 'text-amber-700'
            : success
              ? 'text-emerald-700'
              : 'text-on-surface',
        ].join(' ')}
      >
        {value}
      </p>

      <p className="mt-1 text-xs leading-5 text-on-surface-variant">
        {description}
      </p>

    </div>
  );
}

/* =========================================================
   FIELD META
   ========================================================= */

function FieldMeta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>

      <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-outline">
        {label}
      </span>

      <span className="ml-1 text-[10px] text-on-surface-variant">
        {value}
      </span>

    </div>
  );
}