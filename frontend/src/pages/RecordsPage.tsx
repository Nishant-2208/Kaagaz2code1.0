import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getRecords } from '../api/services';
import {
  ConfidenceBadge,
  DataCard,
  StatusBadge,
} from '../components/shared';
import type { LandRecord, RecordStatus } from '../api/types';

type RecordFilter = 'all' | RecordStatus;

const statusOptions: Array<{ value: RecordFilter; label: string }> = [
  { value: 'all', label: 'All Status' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'verified', label: 'Verified' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function RecordsPage() {
  const navigate = useNavigate();

  const [records, setRecords] = useState<LandRecord[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RecordFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  async function loadRecords() {
    setIsLoading(true);
    setLoadError('');

    try {
      const items = await getRecords();
      setRecords(items);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Could not load land records.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRecords();
  }, []);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchesSearch =
        !query ||
        [
          record.id,
          record.khasraNo,
          record.ownerName,
          record.village,
          record.tehsil,
          record.district,
        ]
          .map((value) => String(value ?? '').toLowerCase())
          .some((value) => value.includes(query));

      const matchesStatus =
        statusFilter === 'all' ||
        record.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [records, search, statusFilter]);

  const needsReview = records.filter(
    (record) => record.status === 'needs_review',
  ).length;

  const verified = records.filter(
    (record) =>
      record.status === 'verified' ||
      record.status === 'approved',
  ).length;

  const rejected = records.filter(
    (record) => record.status === 'rejected',
  ).length;

  function openRecord(record: LandRecord) {
    navigate(`/records/${record.id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 py-6 sm:py-8">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            Verified Land Records
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">
            Records
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
            Structured land records generated from OCR extraction and
            human verification.
          </p>
        </div>

        <div className="font-mono text-xs text-on-surface-variant">
          {records.length} total records
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <RecordSummary
          label="Needs Review"
          value={needsReview}
          description="OCR records awaiting verification"
        />
        <RecordSummary
          label="Verified / Approved"
          value={verified}
          description="Records cleared by review"
          success
        />
        <RecordSummary
          label="Rejected"
          value={rejected}
          description="Records rejected during verification"
          warning
        />
      </section>

      <DataCard className="!rounded-xl !p-4 sm:!p-5">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-outline">
              search
            </span>

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search record ID, Khasra, owner, village..."
              className="min-h-12 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-11 pr-4 text-sm text-on-surface outline-none transition-colors placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as RecordFilter)
            }
            className="min-h-12 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/10 lg:w-56"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void loadRecords()}
            disabled={isLoading}
            className="min-h-12 rounded-lg border border-outline-variant px-5 text-sm font-semibold text-on-surface transition hover:bg-surface-container disabled:opacity-50"
          >
            {isLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </DataCard>

      <DataCard className="!overflow-hidden !rounded-xl !p-0">
        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full border-collapse">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low">
                {[
                  'Record ID',
                  'Khasra / Survey',
                  'Owner',
                  'Village',
                  'Tehsil',
                  'District',
                  'Confidence',
                  'Status',
                  '',
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-5 py-4 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-outline"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-16 text-center text-sm text-on-surface-variant"
                  >
                    Loading records from FastAPI…
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={9} className="px-5 py-16 text-center">
                    <p className="text-sm font-semibold text-error">
                      Could not load records
                    </p>
                    <p className="mt-2 text-xs text-on-surface-variant">
                      {loadError}
                    </p>
                    <button
                      type="button"
                      onClick={() => void loadRecords()}
                      className="mt-4 rounded-lg border border-outline-variant px-4 py-2 text-xs font-semibold"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-16 text-center">
                    <span className="material-symbols-outlined text-4xl text-outline">
                      folder_off
                    </span>
                    <p className="mt-3 text-sm font-semibold text-on-surface">
                      No records found
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Try a different search term or status filter.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    onClick={() => openRecord(record)}
                    className="cursor-pointer border-b border-outline-variant/50 transition hover:bg-surface-container-low"
                  >
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-semibold text-on-surface">
                        {record.id}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-on-surface">
                      {record.khasraNo || '—'}
                    </td>
                    <td className="px-5 py-4 text-sm text-on-surface">
                      {record.ownerName || '—'}
                    </td>
                    <td className="px-5 py-4 text-sm text-on-surface">
                      {record.village || '—'}
                    </td>
                    <td className="px-5 py-4 text-sm text-on-surface">
                      {record.tehsil || '—'}
                    </td>
                    <td className="px-5 py-4 text-sm text-on-surface">
                      {record.district || '—'}
                    </td>
                    <td className="px-5 py-4">
                      <ConfidenceBadge confidence={record.overallConfidence} />
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge
                        status={record.status}
                      />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="material-symbols-outlined text-[20px] text-outline">
                        chevron_right
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && !loadError && filteredRecords.length > 0 && (
          <div className="border-t border-outline-variant bg-surface-container-low px-5 py-3">
            <span className="text-xs text-on-surface-variant">
              Showing {filteredRecords.length} of {records.length} records
            </span>
          </div>
        )}
      </DataCard>
    </div>
  );
}

function RecordSummary({
  label,
  value,
  description,
  success = false,
  warning = false,
}: {
  label: string;
  value: number;
  description: string;
  success?: boolean;
  warning?: boolean;
}) {
  return (
    <DataCard className="!rounded-xl !p-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-outline">
          {label}
        </span>
        <span
          className={[
            'h-2.5 w-2.5 rounded-full',
            success
              ? 'bg-emerald-500'
              : warning
                ? 'bg-amber-500'
                : 'bg-primary',
          ].join(' ')}
        />
      </div>

      <p className="mt-3 text-3xl font-bold tracking-tight text-on-surface">
        {value}
      </p>

      <p className="mt-1 text-xs text-on-surface-variant">
        {description}
      </p>
    </DataCard>
  );
}
