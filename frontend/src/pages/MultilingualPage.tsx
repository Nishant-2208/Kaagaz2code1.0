import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  downloadDocument,
  getExtractedFields,
  getRecordById,
  submitRecordReview,
} from '../api/services';
import type { ExtractedField, LandRecord } from '../api/types';
import { useAuth } from '../contexts/AuthContext';

type ViewMode = 'side' | 'stacked';

type ReviewField = ExtractedField & {
  editedValue: string;
  normalizedLanguage: string;
};

function detectLanguage(value: string): string {
  if (!value) return 'Unknown';
  if (/[\u0900-\u097F]/.test(value)) return 'Hindi · Devanagari';
  if (/[A-Za-z]/.test(value)) return 'English / Latin';
  return 'Numeric / Structured';
}

function normalizeDigits(value: string): string {
  const devanagariDigits = '०१२३४५६७८९';
  return value.replace(/[०-९]/g, (digit) => {
    const index = devanagariDigits.indexOf(digit);
    return index >= 0 ? String(index) : digit;
  });
}

function structuredValue(value: string): string {
  return normalizeDigits(value).trim();
}

function statusLabel(status: LandRecord['status']): string {
  return status.replaceAll('_', ' ');
}

export default function MultilingualPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();

  const recordId = id ?? '';

  const [record, setRecord] = useState<LandRecord | null>(null);
  const [fields, setFields] = useState<ReviewField[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('side');

  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');

  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
  const [sourcePreviewType, setSourcePreviewType] = useState('');

  const canEdit =
    (user?.role === 'reviewer' || user?.role === 'admin') &&
    (record?.status === 'needs_review' ||
      record?.status === 'pending_review' ||
      record?.status === 'in_review');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!recordId) {
        setLoadError('No record ID was supplied.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError('');

      try {
        const resolvedRecord = await getRecordById(recordId);

        if (!resolvedRecord) {
          throw new Error('Record not found.');
        }

        const extracted = await getExtractedFields(recordId);

        if (cancelled) return;

        const reviewFields = extracted.map((field) => ({
          ...field,
          sourceLanguage:
            field.sourceLanguage ??
            field.language ??
            detectLanguage(field.value),
          sourceValue: field.sourceValue ?? field.value,
          normalizedLanguage:
            field.normalizedLanguage ?? 'Structured / Search',
          normalizedValue:
            field.normalizedValue ?? structuredValue(field.value),
          editedValue: field.editedValue ?? field.value,
        }));

        setRecord(resolvedRecord);
        setFields(reviewFields);

        try {
          const sourceBlob = await downloadDocument(recordId);
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
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Could not load multilingual review data.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

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

  const verifiedCount = useMemo(
    () =>
      fields.filter(
        (field) =>
          field.verificationStatus === 'verified' ||
          record?.status === 'verified' ||
          record?.status === 'approved',
      ).length,
    [fields, record?.status],
  );

  const language = useMemo(() => {
    const languages = fields
      .map((field) => field.sourceLanguage)
      .filter(Boolean);

    if (languages.length === 0) return 'Not detected';

    const unique = [...new Set(languages)];
    return unique.length === 1 ? unique[0] : 'Mixed';
  }, [fields]);

  function handleValueChange(fieldId: string, value: string) {
    setFields((current) =>
      current.map((field) =>
        field.fieldId === fieldId
          ? {
              ...field,
              editedValue: value,
              normalizedValue: structuredValue(value),
              verificationStatus: 'corrected',
            }
          : field,
      ),
    );

    setSaved(false);
    setSaveError('');
  }

  async function handleSave() {
    if (!record || !canEdit) return;

    setIsSaving(true);
    setSaveError('');

    try {
      await submitRecordReview(
        record.id,
        fields.map((field) => ({
          ...field,
          value: field.value,
          editedValue: field.editedValue,
        })),
        'Reviewed multilingual/source-language field values.',
      );

      const refreshed = await getRecordById(record.id);
      const refreshedFields = await getExtractedFields(record.id);

      setRecord(refreshed ?? record);
      setFields(
        refreshedFields.map((field) => ({
          ...field,
          sourceLanguage:
            field.sourceLanguage ??
            field.language ??
            detectLanguage(field.value),
          sourceValue: field.sourceValue ?? field.value,
          normalizedLanguage:
            field.normalizedLanguage ?? 'Structured / Search',
          normalizedValue:
            field.normalizedValue ?? structuredValue(field.value),
          editedValue: field.editedValue ?? field.value,
        })),
      );

      setEditing(false);
      setSaved(true);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'Could not save multilingual review changes.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleReset() {
    setFields((current) =>
      current.map((field) => ({
        ...field,
        editedValue: field.value,
        normalizedValue: structuredValue(field.value),
      })),
    );

    setSaved(false);
    setSaveError('');
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center text-sm text-on-surface-variant">
        Loading multilingual review data…
      </div>
    );
  }

  if (loadError || !record) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="text-sm font-semibold text-on-surface">
          {loadError || 'Record is unavailable.'}
        </p>

        <button
          type="button"
          onClick={() => navigate(recordId ? `/records/${recordId}` : '/records')}
          className="mt-4 rounded-lg border border-outline-variant px-4 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container"
        >
          Back to Record
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1380px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => navigate(`/records/${record.id}`)}
                className="font-semibold text-on-surface-variant transition hover:text-primary"
              >
                Record Details
              </button>

              <span className="text-outline">/</span>

              <span className="font-semibold text-primary">
                Multilingual Data
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
                {record.id}
              </h1>

              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-700">
                {statusLabel(record.status)}
              </span>
            </div>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
              Review source-language values against the live extracted record.
              The original document remains the authoritative evidence.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-outline">
              View
            </span>

            <div className="flex rounded-lg border border-outline-variant bg-surface-container-lowest p-1">
              <button
                type="button"
                onClick={() => setViewMode('side')}
                className={[
                  'min-h-9 rounded-md px-3 text-xs font-semibold transition',
                  viewMode === 'side'
                    ? 'bg-primary-fixed text-primary'
                    : 'text-on-surface-variant hover:bg-surface-container',
                ].join(' ')}
              >
                Side by side
              </button>

              <button
                type="button"
                onClick={() => setViewMode('stacked')}
                className={[
                  'min-h-9 rounded-md px-3 text-xs font-semibold transition',
                  viewMode === 'stacked'
                    ? 'bg-primary-fixed text-primary'
                    : 'text-on-surface-variant hover:bg-surface-container',
                ].join(' ')}
              >
                Stacked
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="mb-6 overflow-hidden rounded-xl border border-outline-variant/70 bg-surface-container-lowest">
        <div className="grid grid-cols-2 divide-x divide-y divide-outline-variant/70 sm:grid-cols-4 sm:divide-y-0">
          <SummaryItem
            label="Fields"
            value={String(fields.length)}
            supporting="Live extracted fields"
          />

          <SummaryItem
            label="Verified"
            value={String(verifiedCount)}
            supporting="Fields available for review"
            positive
          />

          <SummaryItem
            label="Source Language"
            value={language}
            supporting="Detected from extracted values"
          />

          <SummaryItem
            label="Record Status"
            value={statusLabel(record.status)}
            supporting="Current backend status"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(300px,0.75fr)_minmax(0,1.5fr)]">
        <aside className="space-y-6">
          <section className="overflow-hidden rounded-xl border border-outline-variant/70 bg-surface-container-lowest">
            <div className="border-b border-outline-variant/70 px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                Source Evidence
              </p>

              <h2 className="mt-1 text-lg font-bold text-on-surface">
                Original Document
              </h2>

              <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                Loaded from protected backend document storage.
              </p>
            </div>

            <div className="bg-surface-container-low p-4 sm:p-5">
              <div className="overflow-hidden rounded-lg border border-outline-variant bg-white">
                {sourcePreviewUrl ? (
                  sourcePreviewType.includes('pdf') ? (
                    <iframe
                      src={sourcePreviewUrl}
                      title="Original scanned land record"
                      className="block h-[620px] w-full border-0 bg-white"
                    />
                  ) : (
                    <img
                      src={sourcePreviewUrl}
                      alt="Original scanned land record"
                      className="block h-auto max-h-[620px] w-full object-contain"
                    />
                  )
                ) : (
                  <div className="flex min-h-[320px] items-center justify-center px-6 text-center">
                    <div>
                      <span className="material-symbols-outlined text-4xl text-outline">
                        image_not_supported
                      </span>

                      <p className="mt-3 text-sm font-semibold text-on-surface">
                        Source preview unavailable
                      </p>

                      <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                        The record is available, but the protected source file
                        could not be previewed.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-outline-variant/70 bg-surface-container-lowest">
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
                label="Overall Confidence"
                value={`${record.overallConfidence}%`}
                positive={record.overallConfidence >= 90}
              />

              <MetricRow
                label="Language Detected"
                value={language}
              />

              <MetricRow
                label="Fields Extracted"
                value={String(fields.length)}
              />

              <MetricRow
                label="Review Role"
                value={user?.role ?? 'unknown'}
              />
            </div>
          </section>

          <section className="rounded-xl border border-primary/15 bg-primary-fixed/20 px-5 py-4">
            <p className="text-sm font-semibold text-on-surface">
              Source values are preserved
            </p>

            <p className="mt-1 text-xs leading-5 text-on-surface-variant">
              This page now reads the live FastAPI record instead of the old
              mock multilingual dataset. Numeric normalization converts
              Devanagari digits to Latin digits; linguistic transliteration is
              not fabricated when the backend has not produced it.
            </p>
          </section>
        </aside>

        <main className="min-w-0">
          <section className="overflow-hidden rounded-xl border border-outline-variant/70 bg-surface-container-lowest">
            <div className="flex flex-col gap-4 border-b border-outline-variant/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                  Multilingual Review
                </p>

                <h2 className="mt-1 text-lg font-bold text-on-surface">
                  Source and structured values
                </h2>

                <p className="mt-1 text-xs text-on-surface-variant">
                  Compare the extracted source value with its structured
                  search representation before saving corrections.
                </p>
              </div>

              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setEditing((current) => !current)}
                  disabled={isSaving}
                  className="min-h-10 rounded-lg border border-outline-variant px-4 text-xs font-semibold text-on-surface transition hover:bg-surface-container disabled:opacity-50"
                >
                  {editing ? 'Finish Editing' : 'Edit Fields'}
                </button>
              ) : (
                <span className="rounded-md bg-surface-container px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                  Read only
                </span>
              )}
            </div>

            <div className="divide-y divide-outline-variant/60">
              {fields.map((field) => (
                <MultilingualFieldRow
                  key={field.fieldId}
                  field={field}
                  value={field.editedValue}
                  viewMode={viewMode}
                  editing={editing && canEdit}
                  onChange={(value) =>
                    handleValueChange(field.fieldId, value)
                  }
                />
              ))}
            </div>

            {fields.length === 0 && (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-semibold text-on-surface">
                  No multilingual fields are available
                </p>

                <p className="mt-1 text-xs text-on-surface-variant">
                  The backend record does not contain structured extraction
                  values for this document.
                </p>
              </div>
            )}

            {canEdit && (
              <div className="flex flex-col gap-3 border-t border-outline-variant/70 bg-surface-container-low px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  {saveError ? (
                    <p className="text-xs font-semibold text-error">
                      {saveError}
                    </p>
                  ) : saved ? (
                    <p className="text-xs font-semibold text-emerald-700">
                      Changes saved to the reviewer workflow.
                    </p>
                  ) : (
                    <p className="text-xs text-on-surface-variant">
                      Corrections are persisted through the same review
                      endpoint used by the main reviewer page.
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={isSaving}
                    className="min-h-11 rounded-lg border border-outline-variant px-5 text-xs font-semibold text-on-surface transition hover:bg-surface-container disabled:opacity-50"
                  >
                    Reset Changes
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={!editing || !canEdit || isSaving}
                    className="min-h-11 rounded-lg bg-primary px-5 text-xs font-semibold text-on-primary transition hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? 'Saving…' : 'Save Review Changes'}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="mt-6 rounded-xl border border-outline-variant/70 bg-surface-container-lowest px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-on-surface">
                  Backend integration status
                </p>

                <p className="mt-1 max-w-3xl text-xs leading-5 text-on-surface-variant">
                  The previous page was entirely mock-driven. It now loads the
                  selected record, extracted fields, and protected source
                  document from the FastAPI backend. A dedicated translation
                  or transliteration API is not currently exposed by the
                  backend, so the UI does not invent translated values.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/records/${record.id}`)}
                className="min-h-10 shrink-0 rounded-lg border border-outline-variant px-4 text-xs font-semibold text-on-surface transition hover:bg-surface-container"
              >
                Back to Record
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

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
          'mt-2 truncate font-mono text-lg font-bold sm:text-xl',
          positive ? 'text-emerald-700' : 'text-on-surface',
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
      <span className="text-xs text-on-surface-variant">{label}</span>

      <span
        className={[
          'shrink-0 font-mono text-xs font-semibold',
          positive ? 'text-emerald-700' : 'text-on-surface',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}

function MultilingualFieldRow({
  field,
  value,
  viewMode,
  editing,
  onChange,
}: {
  field: ReviewField;
  value: string;
  viewMode: ViewMode;
  editing: boolean;
  onChange: (value: string) => void;
}) {
  const isSideBySide = viewMode === 'side';

  const sourceValue = field.sourceValue ?? field.value;
  const normalizedValue =
    field.normalizedValue ?? structuredValue(value);

  return (
    <article className="px-5 py-5 sm:px-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-on-surface">
            {field.label}
          </p>

          <p className="mt-1 font-mono text-[10px] text-outline">
            {field.fieldId}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-md bg-surface-container px-2.5 py-1 text-[10px] font-semibold text-on-surface-variant">
            {field.sourceLanguage ?? detectLanguage(sourceValue)}
          </span>

          <span className="text-xs text-outline">→</span>

          <span className="rounded-md bg-primary-fixed px-2.5 py-1 text-[10px] font-semibold text-primary">
            {field.normalizedLanguage ?? 'Structured / Search'}
          </span>

          {field.verificationStatus === 'verified' && (
            <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
              Verified
            </span>
          )}

          {field.verificationStatus === 'corrected' && (
            <span className="rounded-md bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800">
              Corrected
            </span>
          )}
        </div>
      </div>

      <div
        className={[
          'grid gap-4',
          isSideBySide
            ? 'grid-cols-1 md:grid-cols-2'
            : 'grid-cols-1',
        ].join(' ')}
      >
        <ValuePanel
          label={`Source · ${field.sourceLanguage ?? detectLanguage(sourceValue)}`}
          value={sourceValue}
          muted
        />

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-outline">
            Structured · {field.normalizedLanguage ?? 'Search'}
          </p>

          {editing ? (
            <textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              rows={2}
              className="min-h-[76px] w-full resize-y rounded-lg border border-primary/40 bg-surface-container-lowest px-3 py-3 text-sm leading-6 text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          ) : (
            <div className="min-h-[76px] rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-3 text-sm leading-6 text-on-surface">
              {normalizedValue || value || '—'}
            </div>
          )}

          <p className="mt-2 text-[10px] leading-4 text-on-surface-variant">
            {/[\u0900-\u097F]/.test(value)
              ? 'Hindi text is preserved; numeric normalization is applied where possible.'
              : 'Value is shown from the live structured extraction.'}
          </p>
        </div>
      </div>
    </article>
  );
}

function ValuePanel({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-outline">
        {label}
      </p>

      <div
        className={[
          'min-h-[76px] rounded-lg border px-3 py-3 text-sm leading-6',
          muted
            ? 'border-outline-variant bg-surface-container-low text-on-surface'
            : 'border-outline-variant bg-surface-container-lowest text-on-surface',
        ].join(' ')}
      >
        {value || '—'}
      </div>
    </div>
  );
}
