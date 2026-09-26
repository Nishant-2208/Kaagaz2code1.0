import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { mockMultilingualFields } from '../api/mockData';
import type { MultilingualField } from '../api/types';

type ViewMode = 'side' | 'stacked';

export default function MultilingualPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [viewMode, setViewMode] =
    useState<ViewMode>('side');

  const [editing, setEditing] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const [values, setValues] =
    useState<Record<string, string>>(() =>
      Object.fromEntries(
        mockMultilingualFields.map(
          (field) => [
            field.fieldId,
            field.normalizedValue,
          ],
        ),
      ),
    );

  const recordId =
    id ?? 'DOC-992-AKJ';

  const verifiedCount = useMemo(
    () =>
      mockMultilingualFields.filter(
        (field) => field.isVerified,
      ).length,
    [],
  );

  const handleValueChange = (
    fieldId: string,
    value: string,
  ) => {
    setValues((current) => ({
      ...current,
      [fieldId]: value,
    }));

    setSaved(false);
  };

  const handleSave = () => {
    setEditing(false);
    setSaved(true);
  };

  const handleReject = () => {
    setEditing(false);

    setValues(
      Object.fromEntries(
        mockMultilingualFields.map(
          (field) => [
            field.fieldId,
            field.normalizedValue,
          ],
        ),
      ),
    );

    setSaved(false);
  };

  return (
    <div className="mx-auto w-full max-w-[1380px] px-4 py-6 sm:px-6 lg:px-8">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="mb-6">

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

          <div className="min-w-0">

            <div className="flex flex-wrap items-center gap-2 text-xs">

              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/records/${recordId}`,
                  )
                }
                className="font-semibold text-on-surface-variant transition hover:text-primary"
              >
                Record Details
              </button>

              <span className="text-outline">
                /
              </span>

              <span className="font-semibold text-primary">
                Multilingual Data
              </span>

            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">

              <h1 className="font-mono text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
                {recordId}
              </h1>

              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-700">
                Verified
              </span>

            </div>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
              Review preserved source-language values alongside
              their normalized representations.
            </p>

          </div>

          {/* View mode */}

          <div className="flex items-center gap-3">

            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-outline">
              View
            </span>

            <div className="flex rounded-lg border border-outline-variant bg-surface-container-lowest p-1">

              <button
                type="button"
                onClick={() =>
                  setViewMode('side')
                }
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
                onClick={() =>
                  setViewMode('stacked')
                }
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

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <section className="mb-6 overflow-hidden rounded-xl border border-outline-variant/70 bg-surface-container-lowest">

        <div className="grid grid-cols-2 divide-x divide-y divide-outline-variant/70 sm:grid-cols-4 sm:divide-y-0">

          <SummaryItem
            label="Fields"
            value={`${mockMultilingualFields.length}`}
            supporting="Normalized fields"
          />

          <SummaryItem
            label="Verified"
            value={`${verifiedCount}`}
            supporting="Already reviewed"
            positive
          />

          <SummaryItem
            label="Source Language"
            value="Hindi"
            supporting="Devanagari"
          />

          <SummaryItem
            label="Normalization"
            value="English / ISO"
            supporting="Search-ready representation"
          />

        </div>

      </section>

      {/* =====================================================
          MAIN LAYOUT
      ===================================================== */}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(300px,0.75fr)_minmax(0,1.5fr)]">

        {/* ===================================================
            SOURCE COLUMN
        =================================================== */}

        <aside className="space-y-6">

          {/* Source document */}

          <section className="overflow-hidden rounded-xl border border-outline-variant/70 bg-surface-container-lowest">

            <div className="border-b border-outline-variant/70 px-5 py-4">

              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                Source Evidence
              </p>

              <h2 className="mt-1 text-lg font-bold text-on-surface">
                Original Document
              </h2>

              <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                Original text remains preserved exactly as extracted.
              </p>

            </div>

            <div className="bg-surface-container-low p-4 sm:p-5">

              <div className="overflow-hidden rounded-lg border border-outline-variant bg-white">

                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBH0TdirBPXzEPU62V_6sN_0eZOVMLjfWwmoYmQdnw2zPKmt-PDuYfa39LGt1NiRzmh-AGxIGWqQM8MhFge6ADUN5rrtsrJhxciJ7TSVPFcAjUHVIGd8r9F-tLSFEvWBUMz9FXTFWLI-fjZTh87M5aFCuP2bcqJV5FKq0zMeBQKsm57qlQrn-3RaOxYE_AA9SF1pUJKQZhGiwQ8PgAM8OK-yI-upHKCFWaSa_Bk1IZhN5I2NxTwUQVw"
                  alt="Original scanned document"
                  className="block h-auto max-h-[620px] w-full object-contain"
                />

              </div>

            </div>

          </section>

          {/* Processing metrics */}

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
                label="OCR Confidence"
                value="98.4%"
                positive
              />

              <MetricRow
                label="Language Detected"
                value="HI · Devanagari"
              />

              <MetricRow
                label="Processing Time"
                value="1.24s"
              />

              <MetricRow
                label="Fields Extracted"
                value={`${mockMultilingualFields.length}`}
              />

            </div>

          </section>

          {/* Explanation */}

          <section className="rounded-xl border border-primary/15 bg-primary-fixed/20 px-5 py-4">

            <p className="text-sm font-semibold text-on-surface">
              Original text is never replaced
            </p>

            <p className="mt-1 text-xs leading-5 text-on-surface-variant">
              Normalized values are an additional representation used
              for search, matching and cross-language comparison.
            </p>

          </section>

        </aside>

        {/* ===================================================
            NORMALIZED FIELDS
        =================================================== */}

        <main className="min-w-0">

          <section className="overflow-hidden rounded-xl border border-outline-variant/70 bg-surface-container-lowest">

            {/* Section header */}

            <div className="flex flex-col gap-4 border-b border-outline-variant/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">

              <div>

                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                  Normalized Data
                </p>

                <h2 className="mt-1 text-lg font-bold text-on-surface">
                  Language-normalized fields
                </h2>

                <p className="mt-1 text-xs text-on-surface-variant">
                  Compare the original value with its normalized representation.
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setEditing((current) => !current)
                }
                className="min-h-10 rounded-lg border border-outline-variant px-4 text-xs font-semibold text-on-surface transition hover:bg-surface-container"
              >
                {editing
                  ? 'Finish Editing'
                  : 'Edit Fields'}
              </button>

            </div>

            {/* =================================================
                FIELD LIST
            ================================================= */}

            <div className="divide-y divide-outline-variant/60">

              {mockMultilingualFields.map(
                (field) => (
                  <MultilingualFieldRow
                    key={field.fieldId}
                    field={field}
                    value={
                      values[field.fieldId] ??
                      field.normalizedValue
                    }
                    viewMode={viewMode}
                    editing={editing}
                    onChange={(value) =>
                      handleValueChange(
                        field.fieldId,
                        value,
                      )
                    }
                  />
                ),
              )}

            </div>

            {/* =================================================
                FOOTER
            ================================================= */}

            <div className="flex flex-col gap-3 border-t border-outline-variant/70 bg-surface-container-low px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">

              <div>

                {saved ? (
                  <p className="text-xs font-semibold text-emerald-700">
                    Changes saved locally for this review session.
                  </p>
                ) : (
                  <p className="text-xs text-on-surface-variant">
                    Review normalized values before confirming.
                  </p>
                )}

              </div>

              <div className="flex flex-col gap-2 sm:flex-row">

                <button
                  type="button"
                  onClick={handleReject}
                  className="min-h-11 rounded-lg border border-outline-variant px-5 text-xs font-semibold text-on-surface transition hover:bg-surface-container"
                >
                  Reset Changes
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  className="min-h-11 rounded-lg bg-primary px-5 text-xs font-semibold text-on-primary transition hover:bg-primary-container"
                >
                  Confirm & Save
                </button>

              </div>

            </div>

          </section>

          {/* =================================================
              WORKFLOW NOTE
          ================================================= */}

          <section className="mt-6 rounded-xl border border-outline-variant/70 bg-surface-container-lowest px-5 py-4 sm:px-6">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

              <div>

                <p className="text-sm font-semibold text-on-surface">
                  Normalization is an additional representation
                </p>

                <p className="mt-1 max-w-3xl text-xs leading-5 text-on-surface-variant">
                  The Hindi source value remains available for verification.
                  The normalized value supports search, matching and
                  integration without removing the original text.
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/records/${recordId}`,
                  )
                }
                className="min-h-10 shrink-0 rounded-lg border border-outline-variant px-4 text-xs font-semibold text-on-surface hover:bg-surface-container"
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
          'mt-2 truncate font-mono text-lg font-bold sm:text-xl',
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
   MULTILINGUAL FIELD ROW
   ========================================================= */

function MultilingualFieldRow({
  field,
  value,
  viewMode,
  editing,
  onChange,
}: {
  field: MultilingualField;
  value: string;
  viewMode: ViewMode;
  editing: boolean;
  onChange: (value: string) => void;
}) {
  const isSideBySide =
    viewMode === 'side';

  return (
    <article className="px-5 py-5 sm:px-6">

      {/* Field heading */}

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
            {field.sourceLanguage}
          </span>

          <span className="text-xs text-outline">
            →
          </span>

          <span className="rounded-md bg-primary-fixed px-2.5 py-1 text-[10px] font-semibold text-primary">
            {field.normalizedLanguage}
          </span>

          {field.isVerified && (
            <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
              Verified
            </span>
          )}

        </div>

      </div>

      {/* Values */}

      <div
        className={[
          'grid gap-4',
          isSideBySide
            ? 'grid-cols-1 md:grid-cols-2'
            : 'grid-cols-1',
        ].join(' ')}
      >

        {/* Original */}

        <ValuePanel
          label={`Original · ${field.sourceLanguage}`}
          value={field.sourceValue}
          muted
        />

        {/* Normalized */}

        <div>

          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-outline">
            Normalized · {field.normalizedLanguage}
          </p>

          {editing ? (
            <textarea
              value={value}
              onChange={(event) =>
                onChange(event.target.value)
              }
              rows={2}
              className="min-h-[76px] w-full resize-y rounded-lg border border-primary/40 bg-surface-container-lowest px-3 py-3 text-sm leading-6 text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          ) : (
            <div className="min-h-[76px] rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-3 text-sm leading-6 text-on-surface">
              {value}
            </div>
          )}

        </div>

      </div>

    </article>
  );
}

/* =========================================================
   VALUE PANEL
   ========================================================= */

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
        {value}
      </div>

    </div>
  );
}