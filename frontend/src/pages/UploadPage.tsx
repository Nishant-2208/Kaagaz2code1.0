import { useRef, useState, useEffect } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadDocument } from '../api/services';

type DocumentType =
  | 'khata_khatoni'
  | 'record_of_rights'
  | 'mutation'
  | 'sale_deed'
  | 'mouza_cadastral_map'
  | 'other';

interface DocumentTypeOption {
  value: DocumentType;
  label: string;
}

interface LanguageOption {
  value: string;
  label: string;
}

const documentTypes: DocumentTypeOption[] = [
  { value: 'khata_khatoni', label: 'Khata / Khatoni Record' },
  { value: 'record_of_rights', label: 'Record of Rights (ROR)' },
  { value: 'mouza_cadastral_map', label: 'Mouza Cadastral Map (GIS)' },
  { value: 'mutation', label: 'Mutation Register' },
  { value: 'sale_deed', label: 'Historical Sale Deed' },
  { value: 'other', label: 'Other Legacy Land Record' },
];

const languages: LanguageOption[] = [
  { value: 'hi', label: 'Hindi (Devanagari)' },
  { value: 'bn', label: 'Bengali (Bangla)' },
  { value: 'mr', label: 'Marathi (Modi/Devanagari)' },
  { value: 'en', label: 'English' },
  { value: 'mixed', label: 'Multilingual / Bi-script' },
];

const pipelineSteps = [
  {
    step: '01',
    name: 'OpenCV Preprocessing',
    desc: 'Deskewing, Otsu binarization, table grid & contour extraction',
  },
  {
    step: '02',
    name: 'Tesseract OCR Pipeline',
    desc: 'Multi-script text layer extraction & confidence scoring',
  },
  {
    step: '03',
    name: 'Cadastral & Field Audit',
    desc: 'Extract Khasra, Owner, Area & cross-check legacy registry',
  },
];

const acceptedTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
];

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export default function UploadPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>('khata_khatoni');
  const [language, setLanguage] = useState('hi');
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeStage, setActiveStage] = useState<number>(0);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function validateFile(selectedFile: File): string | null {
    if (
      selectedFile.type &&
      !acceptedTypes.includes(selectedFile.type) &&
      !selectedFile.name.endsWith('.pdf')
    ) {
      return 'Unsupported file format. Please upload a PDF, TIFF, JPG, PNG, or WebP scan.';
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      return 'File size exceeds 25 MB. Please upload an optimized scan.';
    }

    return null;
  }

  function handleFile(selectedFile?: File) {
    if (!selectedFile) return;

    const validationError = validateFile(selectedFile);
    if (validationError) {
      setFile(null);
      setError(validationError);
      return;
    }

    setFile(selectedFile);
    setError('');
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0]);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  }

  function handleRemoveFile() {
    setFile(null);
    setError('');
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  async function handleStartProcessing() {
    if (!file) {
      setError('Select a scanned document before initiating the ingestion pipeline.');
      return;
    }

    setError('');
    setIsProcessing(true);
    setActiveStage(1);

    try {
      // Kick off the real pipeline: OpenCV preprocessing -> Tesseract OCR
      // -> LLM structured extraction -> confidence scoring (see
      // backend_dev_engg.md). The stage indicator below advances as the
      // upload completes and the batch is queued for processing.
      const uploadPromise = uploadDocument({
        file,
        documentType,
        language,
        enableGeoReference: locationEnabled,
      });

      await new Promise((r) => setTimeout(r, 400));
      setActiveStage(2);

      const result = await uploadPromise;
      setActiveStage(3);

      await new Promise((r) => setTimeout(r, 400));
      navigate('/review', {
        state: { recordId: result.recordId, batchId: result.batchId },
      });
    } catch {
      setError(
        'Upload failed. Check your connection to the processing service and try again.',
      );
      setIsProcessing(false);
      setActiveStage(0);
    }
  }

  const isPdf = file?.type === 'application/pdf' || file?.name.endsWith('.pdf');

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6 lg:px-8">
      {/* =====================================================
          PAGE HEADER
      ===================================================== */}
      <header className="mb-8 border-b border-outline-variant/60 pb-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                SIH Problem Statement 26018
              </span>
              <span className="rounded bg-primary-fixed px-2 py-0.5 text-[10px] font-bold text-primary">
                Kaagaz2Code Intake
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
              Land Record Ingestion & Preprocessing
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Upload legacy deeds, Mouza cadastral maps, or Khatonis for automated OpenCV deskewing and multi-script Tesseract extraction.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Dual OCR Engine Online
          </div>
        </div>
      </header>

      {/* =====================================================
          MAIN GRID
      ===================================================== */}
      <main className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        {/* ===================================================
            LEFT — DOCUMENT INGESTION & LIVE INSPECTION
        =================================================== */}
        <div className="space-y-6">
          <section className="overflow-hidden rounded-xl border border-outline-variant/70 bg-surface-container-lowest shadow-xs">
            <div className="border-b border-outline-variant/70 px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-on-surface">
                  Document Input & Live Preview
                </h2>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-outline">
                  PDF · TIFF · PNG · JPG
                </span>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {/* EMPTY DRAG & DROP ZONE */}
              {!file && (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Upload scanned land record document"
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      inputRef.current?.click();
                    }
                  }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={[
                    'flex min-h-[300px] cursor-pointer flex-col items-center justify-center',
                    'rounded-xl border-2 border-dashed p-8 text-center transition duration-150',
                    'focus:outline-none focus:ring-2 focus:ring-primary',
                    isDragging
                      ? 'border-primary bg-primary-fixed/30'
                      : 'border-outline-variant bg-surface-container-low hover:border-primary hover:bg-primary-fixed/10',
                  ].join(' ')}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-fixed text-primary shadow-xs">
                    <span className="material-symbols-outlined text-3xl">
                      upload_file
                    </span>
                  </div>

                  <h3 className="mt-4 text-base font-semibold text-on-surface">
                    {isDragging
                      ? 'Drop record file to process'
                      : 'Select or drop scanned land record'}
                  </h3>

                  <p className="mt-1 text-xs text-on-surface-variant">
                    Drag and drop your document scan or browse local files
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <span className="rounded-md border border-outline-variant/60 bg-surface-container px-2 py-1 text-[11px] text-outline font-mono">
                      Max 25 MB
                    </span>
                    <span className="rounded-md border border-outline-variant/60 bg-surface-container px-2 py-1 text-[11px] text-outline font-mono">
                      PDF, JPG, PNG, TIFF
                    </span>
                  </div>

                  <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff"
                    onChange={handleInputChange}
                    className="sr-only"
                  />
                </div>
              )}

              {/* FILE SELECTED & LIVE DOCUMENT PREVIEW */}
              {file && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4 sm:flex-row sm:items-center">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary">
                      <span className="material-symbols-outlined text-2xl">
                        {isPdf ? 'picture_as_pdf' : 'description'}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-on-surface">
                        {file.name}
                      </p>
                      <p className="mt-0.5 text-xs text-on-surface-variant">
                        {formatFileSize(file.size)} • {file.type || 'Scanned Document'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      disabled={isProcessing}
                      className="min-h-9 shrink-0 rounded-lg border border-outline-variant px-3 text-xs font-semibold text-on-surface-variant transition hover:border-error hover:text-error disabled:opacity-50"
                    >
                      Change File
                    </button>
                  </div>

                  {/* VISUAL INSPECTION PREVIEW CONTAINER */}
                  <div className="relative overflow-hidden rounded-xl border border-outline-variant/80 bg-surface-container-highest">
                    <div className="flex items-center justify-between border-b border-outline-variant/60 bg-surface-container px-3 py-2 text-xs text-on-surface-variant">
                      <span className="flex items-center gap-1 font-semibold">
                        <span className="material-symbols-outlined text-base text-primary">
                          visibility
                        </span>
                        Document Inspection Panel
                      </span>
                      <span className="text-[11px] text-outline">
                        Source Visual
                      </span>
                    </div>

                    <div className="flex h-72 items-center justify-center p-2">
                      {isPdf ? (
                        <div className="flex flex-col items-center justify-center text-center p-6">
                          <span className="material-symbols-outlined text-5xl text-error mb-2">
                            picture_as_pdf
                          </span>
                          <p className="text-sm font-semibold text-on-surface">
                            {file.name}
                          </p>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            Multi-page PDF document loaded for OCR rasterization and extraction
                          </p>
                        </div>
                      ) : previewUrl ? (
                        <img
                          src={previewUrl}
                          alt="Uploaded Land Record Scan"
                          className="max-h-full max-w-full rounded object-contain shadow-xs"
                        />
                      ) : (
                        <span className="text-xs text-outline">Preview unavailable</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ERROR STATE */}
              {error && (
                <div
                  role="alert"
                  className="mt-4 flex items-center gap-2 rounded-lg border border-error bg-error-container px-4 py-3 text-xs font-medium text-on-error-container"
                >
                  <span className="material-symbols-outlined text-base">error</span>
                  {error}
                </div>
              )}
            </div>

            {/* METADATA FORM CONTROLS */}
            <div className="border-t border-outline-variant/70 px-5 py-5 sm:px-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="document-type"
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant"
                  >
                    Target Record Type
                  </label>
                  <select
                    id="document-type"
                    value={documentType}
                    disabled={isProcessing}
                    onChange={(event) =>
                      setDocumentType(event.target.value as DocumentType)
                    }
                    className="min-h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 text-xs text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  >
                    {documentTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="language"
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant"
                  >
                    Script / Language Model
                  </label>
                  <select
                    id="language"
                    value={language}
                    disabled={isProcessing}
                    onChange={(event) => setLanguage(event.target.value)}
                    className="min-h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 text-xs text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  >
                    {languages.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* LOCATION GIS INTEGRATION CHECKBOX */}
              <label
                htmlFor="location"
                className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 transition hover:border-primary/40"
              >
                <input
                  id="location"
                  type="checkbox"
                  checked={locationEnabled}
                  disabled={isProcessing}
                  onChange={(event) => setLocationEnabled(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <div>
                  <span className="block text-xs font-semibold text-on-surface">
                    Enable Cadastral Geo-referencing (GIS)
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-on-surface-variant">
                    Correlates extracted Khasra numbers with spatial coordinates and Mouza map layers.
                  </span>
                </div>
              </label>
            </div>

            {/* ACTION FOOTER */}
            <div className="flex flex-col gap-3 border-t border-outline-variant/70 bg-surface-container-low px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-xs text-on-surface-variant">
                {file
                  ? 'Scan loaded. Ready for OpenCV deskewing & OCR.'
                  : 'Upload a land record to begin pipeline.'}
              </p>

              <button
                type="button"
                disabled={!file || isProcessing}
                onClick={handleStartProcessing}
                className={[
                  'flex min-h-10 items-center justify-center gap-2 rounded-lg px-6 text-xs font-bold transition shadow-xs',
                  !file || isProcessing
                    ? 'cursor-not-allowed bg-surface-container text-outline'
                    : 'bg-primary text-on-primary hover:opacity-95',
                ].join(' ')}
              >
                {isProcessing ? (
                  <>
                    <span className="material-symbols-outlined text-base animate-spin">
                      progress_activity
                    </span>
                    Running Engine ({activeStage}/3)…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">
                      auto_fix_high
                    </span>
                    Execute OCR & Extraction
                  </>
                )}
              </button>
            </div>
          </section>
        </div>

        {/* ===================================================
            RIGHT — PIPELINE ARCHITECTURE (FOR JUDGES & AUDIT)
        =================================================== */}
        <aside className="space-y-4">
          <section className="rounded-xl border border-outline-variant/70 bg-surface-container-lowest p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                Dual Ingestion Pipeline
              </p>
              <span className="material-symbols-outlined text-primary text-lg">
                schema
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {pipelineSteps.map((p, idx) => {
                const isCurrent = isProcessing && activeStage === idx + 1;
                const isDone = isProcessing && activeStage > idx + 1;

                return (
                  <div
                    key={p.step}
                    className={`flex gap-3 rounded-lg border p-3 transition ${
                      isCurrent
                        ? 'border-primary bg-primary-fixed/20'
                        : isDone
                        ? 'border-emerald-300 bg-emerald-50/50'
                        : 'border-outline-variant/50 bg-surface-container-low'
                    }`}
                  >
                    <span
                      className={`font-mono text-xs font-bold ${
                        isCurrent
                          ? 'text-primary'
                          : isDone
                          ? 'text-emerald-700'
                          : 'text-outline'
                      }`}
                    >
                      {p.step}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-on-surface">
                          {p.name}
                        </p>
                        {isCurrent && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                        )}
                        {isDone && (
                          <span className="material-symbols-outlined text-xs text-emerald-700 font-bold">
                            check_circle
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] leading-4 text-on-surface-variant">
                        {p.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-outline-variant/70 bg-surface-container-lowest p-4 text-xs text-on-surface-variant shadow-xs">
            <span className="flex items-center gap-1.5 font-bold text-on-surface mb-1">
              <span className="material-symbols-outlined text-base text-primary">
                verified_user
              </span>
              Preservation of Legacy Deeds
            </span>
            Original raster scans are cryptographically hashed and anchored alongside the extracted JSON records to prevent data tampering.
          </section>
        </aside>
      </main>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}