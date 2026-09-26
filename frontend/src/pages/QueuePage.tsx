import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockQueueItems } from '../api/mockData';
import {
  StatusBadge,
  ConfidenceBadge,
  DataCard,
} from '../components/shared';
import type { RecordStatus } from '../api/types';

type QueueFilter = 'all' | RecordStatus;

const statusOptions: Array<{
  value: QueueFilter;
  label: string;
}> = [
    {
      value: 'all',
      label: 'All Status',
    },
    {
      value: 'pending_review',
      label: 'Pending Review',
    },
    {
      value: 'in_review',
      label: 'In Review',
    },
    {
      value: 'flagged',
      label: 'Flagged',
    },
    {
      value: 'discrepancy',
      label: 'Discrepancy',
    },
    {
      value: 'verified',
      label: 'Verified',
    },
    {
      value: 'locked',
      label: 'Locked',
    },
  ];

export default function QueuePage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<QueueFilter>('all');

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return mockQueueItems.filter((item) => {
      const matchesSearch =
        normalizedSearch === '' ||
        item.khasraNo.toLowerCase().includes(normalizedSearch) ||
        item.ownerName.toLowerCase().includes(normalizedSearch) ||
        item.id.toLowerCase().includes(normalizedSearch) ||
        item.village.toLowerCase().includes(normalizedSearch) ||
        item.district.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === 'all' ||
        item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  const awaitingReviewCount = mockQueueItems.filter(
    (item) =>
      item.status === 'pending_review' ||
      item.status === 'in_review',
  ).length;

  const conflictCount = mockQueueItems.filter(
    (item) =>
      item.status === 'flagged' ||
      item.status === 'discrepancy',
  ).length;

  const verifiedCount = mockQueueItems.filter(
    (item) =>
      item.status === 'verified' ||
      item.status === 'locked',
  ).length;

  function handleRecordClick(
    id: string,
    status: RecordStatus,
  ) {
    if (status === 'discrepancy') {
      navigate(`/discrepancy/${id}`);
      return;
    }

    if (status === 'locked' || status === 'verified') {
      navigate(`/records/${id}`);
      return;
    }

    navigate('/review');
  }

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 py-6 sm:py-8">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

        <div>

          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            Human Verification
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">
            Review Queue
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
            Prioritize records that require human verification,
            correction, or discrepancy review.
          </p>

        </div>

        <div className="font-mono text-xs text-on-surface-variant">
          {mockQueueItems.length} total records
        </div>

      </header>

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">

        <QueueSummary
          label="Awaiting Review"
          value={awaitingReviewCount}
          description="Pending or currently being reviewed"
        />

        <QueueSummary
          label="Flagged / Conflicts"
          value={conflictCount}
          description="Records requiring additional attention"
          warning
        />

        <QueueSummary
          label="Verified"
          value={verifiedCount}
          description="Verified or locked records"
          success
        />

      </section>

      {/* =====================================================
          SEARCH + FILTER
      ===================================================== */}

      <DataCard className="!rounded-xl !p-4 sm:!p-5">

        <div className="flex flex-col gap-3 lg:flex-row">

          <div className="relative flex-1">

            <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-outline">
              search
            </span>

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search record ID, Khasra, owner, village..."
              className="min-h-12 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-11 pr-4 text-sm text-on-surface outline-none transition-colors placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/10"
            />

          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as QueueFilter,
              )
            }
            className="min-h-12 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/10 lg:w-56"
          >
            {statusOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>

        </div>

        {(search || statusFilter !== 'all') && (
          <div className="mt-3 flex items-center justify-between border-t border-outline-variant/60 pt-3">

            <p className="text-xs text-on-surface-variant">
              {filtered.length} matching record
              {filtered.length === 1 ? '' : 's'}
            </p>

            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Clear filters
            </button>

          </div>
        )}

      </DataCard>

      {/* =====================================================
          RESULTS
      ===================================================== */}

      <div className="flex items-center justify-between">

        <div>
          <p className="font-mono text-xs text-outline">
            Showing {filtered.length} of {mockQueueItems.length}
          </p>
        </div>

        <p className="hidden text-xs text-on-surface-variant sm:block">
          Select a record to open its workflow.
        </p>

      </div>

      {/* =====================================================
          QUEUE TABLE
      ===================================================== */}

      <DataCard
        padding={false}
        className="!overflow-hidden !rounded-xl"
      >

        {/* Desktop header */}

        <div className="hidden border-b border-outline-variant bg-surface-container-low px-5 py-4 lg:grid lg:grid-cols-12 lg:gap-5">

          <span className="col-span-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
            Record ID
          </span>

          <span className="col-span-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
            Khasra No.
          </span>

          <span className="col-span-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
            Owner Name
          </span>

          <span className="col-span-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
            Village
          </span>

          <span className="col-span-1 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
            Conf.
          </span>

          <span className="col-span-2 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
            Status
          </span>

        </div>

        {/* Records */}

        {filtered.length > 0 ? (

          <div className="divide-y divide-outline-variant">

            {filtered.map((item) => (

              <button
                key={item.id}
                type="button"
                onClick={() =>
                  handleRecordClick(
                    item.id,
                    item.status,
                  )
                }
                className="group w-full text-left transition-colors hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
              >

                {/* =================================================
                    DESKTOP
                    ================================================= */}

                <div className="hidden items-center px-5 py-5 lg:grid lg:grid-cols-12 lg:gap-5">

                  <div className="col-span-2">

                    <p className="font-mono text-xs font-semibold text-on-surface">
                      {item.id}
                    </p>

                    <p className="mt-1 text-[10px] text-outline">
                      {formatDate(item.createdAt)}
                    </p>

                  </div>

                  <div className="col-span-2">

                    <p className="font-mono text-sm font-semibold text-primary">
                      {item.khasraNo}
                    </p>

                  </div>

                  <div className="col-span-3 min-w-0">

                    <p className="truncate text-sm font-semibold text-on-surface">
                      {item.ownerName}
                    </p>

                    {item.assignedTo && (
                      <p className="mt-1 truncate text-[11px] text-on-surface-variant">
                        Assigned: {item.assignedTo}
                      </p>
                    )}

                  </div>

                  <div className="col-span-2 min-w-0">

                    <p className="truncate text-sm text-on-surface">
                      {item.village}
                    </p>

                    <p className="mt-1 text-[11px] text-on-surface-variant">
                      {item.district}
                    </p>

                  </div>

                  <div className="col-span-1 flex justify-end">

                    <ConfidenceBadge
                      confidence={item.confidence}
                    />

                  </div>

                  <div className="col-span-2 flex justify-end">

                    <StatusBadge
                      status={item.status}
                    />

                  </div>

                </div>

                {/* =================================================
                    MOBILE / TABLET
                    ================================================= */}

                <div className="flex flex-col gap-4 p-4 lg:hidden">

                  <div className="flex items-start justify-between gap-4">

                    <div className="min-w-0">

                      <p className="font-mono text-xs font-semibold text-on-surface">
                        {item.id}
                      </p>

                      <p className="mt-1 font-mono text-sm font-semibold text-primary">
                        {item.khasraNo}
                      </p>

                    </div>

                    <StatusBadge
                      status={item.status}
                    />

                  </div>

                  <div>

                    <p className="truncate text-sm font-semibold text-on-surface">
                      {item.ownerName}
                    </p>

                    <p className="mt-1 text-xs text-on-surface-variant">
                      {item.village}, {item.district}
                    </p>

                  </div>

                  <div className="flex items-center justify-between border-t border-outline-variant/60 pt-3">

                    <div className="flex flex-col">

                      <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-outline">
                        Record Date
                      </span>

                      <span className="mt-1 font-mono text-[11px] text-on-surface-variant">
                        {formatDate(item.createdAt)}
                      </span>

                    </div>

                    <ConfidenceBadge
                      confidence={item.confidence}
                    />

                  </div>

                </div>

              </button>

            ))}

          </div>

        ) : (

          /* =====================================================
             EMPTY STATE
             ===================================================== */

          <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container text-outline">

              <span className="material-symbols-outlined text-[24px]">
                search_off
              </span>

            </div>

            <h2 className="mt-4 text-base font-bold text-on-surface">
              No records found
            </h2>

            <p className="mt-1 max-w-md text-xs leading-5 text-on-surface-variant">
              Try a different search term or clear the
              current status filter.
            </p>

            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
              className="mt-4 rounded-lg border border-outline-variant px-4 py-2.5 text-xs font-semibold text-on-surface hover:bg-surface-container"
            >
              Clear filters
            </button>

          </div>

        )}

      </DataCard>

      {/* =====================================================
          FOOTER NOTE
          ===================================================== */}

      <div className="rounded-xl border border-primary/15 bg-primary-fixed/30 px-5 py-4">

        <p className="text-xs leading-5 text-on-surface-variant">
          Low-confidence fields and detected conflicts should be
          checked against the source document before a record is
          approved. Verified records remain traceable through the
          processing audit trail.
        </p>

      </div>

    </div>
  );
}

/* =========================================================
   SUMMARY CARD
   ========================================================= */

function QueueSummary({
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
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">

      <div className="flex items-start justify-between gap-3">

        <div>

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

        </div>

        <span
          className={[
            'h-2.5 w-2.5 rounded-full',
            warning
              ? 'bg-amber-500'
              : success
                ? 'bg-emerald-500'
                : 'bg-primary',
          ].join(' ')}
        />

      </div>

      <p className="mt-2 text-xs leading-5 text-on-surface-variant">
        {description}
      </p>

    </div>
  );
}

/* =========================================================
   DATE FORMATTER
   ========================================================= */

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}