import { useEffect, useMemo, useState } from 'react';

import {
  getAdminStats,
  getBatches,
  getOfficers,
} from '../api/services';
import type {
  AdminStats,
  Batch,
  Officer,
} from '../api/types';

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  async function loadDashboard() {
    setIsLoading(true);
    setLoadError('');

    try {
      const [liveStats, liveBatches, liveOfficers] = await Promise.all([
        getAdminStats(),
        getBatches(),
        getOfficers(),
      ]);

      setStats(liveStats);
      setBatches(liveBatches);
      setOfficers(liveOfficers);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Could not load the administration dashboard.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const activeOfficers = useMemo(
    () => officers.filter((officer) => officer.status === 'active').length,
    [officers],
  );

  const totalBatchDocuments = batches.reduce(
    (total, batch) => total + batch.totalCount,
    0,
  );

  const processedBatchDocuments = batches.reduce(
    (total, batch) => total + batch.processedCount,
    0,
  );

  const batchProgress =
    totalBatchDocuments > 0
      ? Math.round((processedBatchDocuments / totalBatchDocuments) * 100)
      : 0;

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-sm text-on-surface-variant">
        Loading administration dashboard from FastAPI…
      </div>
    );
  }

  if (loadError || !stats) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
        <span className="material-symbols-outlined text-4xl text-error">
          dashboard
        </span>
        <p className="mt-4 text-sm font-semibold text-error">
          Could not load administration dashboard
        </p>
        <p className="mt-2 text-sm text-on-surface-variant">
          {loadError || 'The backend did not return dashboard data.'}
        </p>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="mt-5 rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
        >
          Retry
        </button>
      </div>
    );
  }

  const trend = stats.trendData.length > 0
    ? stats.trendData
    : [0];

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">

      <header className="mb-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary">
              Administration
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">
              Digitization Dashboard
            </h1>

            <p className="mt-3 text-sm leading-6 text-on-surface-variant sm:text-base">
              Live monitoring of document processing, verification workload,
              extraction confidence, and officer activity.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="w-fit rounded-xl border border-outline-variant/70 bg-[#f4f6f9] px-4 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container"
          >
            Refresh dashboard
          </button>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Records processed"
          value={stats.totalRecords.toLocaleString()}
          subtitle={`${stats.monthlyVolume} uploaded this month`}
        />

        <MetricCard
          label="Average confidence"
          value={`${stats.accuracyRate}%`}
          subtitle="From completed AI/OCR jobs"
        />

        <MetricCard
          label="Pending conflicts"
          value={stats.pendingConflicts.toString()}
          subtitle="Unresolved discrepancy records"
          emphasis
        />

        <MetricCard
          label="Active officers"
          value={activeOfficers.toString()}
          subtitle={`${officers.length} officer accounts`}
        />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">

        <section className="rounded-2xl border border-outline-variant/70 bg-white shadow-[0_8px_26px_rgba(11,45,85,0.055)] p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-primary">
                Processing quality
              </p>

              <h2 className="mt-1 text-xl font-bold text-on-surface">
                Extraction Confidence
              </h2>

              <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                Latest completed processing jobs reported by the AI service.
              </p>
            </div>

            <div className="rounded-lg bg-surface-container-low px-3 py-2">
              <p className="font-mono text-sm font-bold text-on-surface">
                {stats.accuracyRate}%
              </p>
              <p className="mt-0.5 text-[10px] text-on-surface-variant">
                Average
              </p>
            </div>
          </div>

          <div className="mt-8">
            <div className="flex h-[220px] items-end gap-2 border-b border-outline-variant/70 px-1 sm:gap-3">
              {trend.map((value, index) => {
                const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
                const isLatest = index === trend.length - 1;

                return (
                  <div
                    key={`trend-${index}`}
                    className="group flex h-full flex-1 items-end"
                  >
                    <div
                      className={[
                        'w-full rounded-t-md transition-all',
                        isLatest
                          ? 'bg-primary'
                          : 'bg-primary/30 group-hover:bg-primary/55',
                      ].join(' ')}
                      style={{ height: `${safeValue}%` }}
                      title={`Confidence: ${safeValue}%`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex justify-between text-[10px] font-semibold uppercase tracking-[0.08em] text-outline">
              <span>Earlier jobs</span>
              <span>Latest job</span>
            </div>
          </div>
        </section>

        <section className="flex flex-col justify-between rounded-xl border border-error/40 bg-error-container p-5 sm:p-6">
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-error">
                Action required
              </p>

              <span className="rounded-full bg-white/60 px-2.5 py-1 font-mono text-[10px] font-bold text-error">
                {stats.pendingConflicts}
              </span>
            </div>

            <h2 className="mt-6 text-xl font-bold text-on-error-container">
              Pending Conflicts
            </h2>

            <p className="mt-3 text-sm leading-6 text-on-error-container/80">
              Unresolved discrepancy records currently stored in MongoDB.
            </p>
          </div>

          <div className="mt-8 border-t border-error/20 pt-5">
            <p className="font-mono text-4xl font-bold text-error">
              {stats.pendingConflicts}
            </p>

            <p className="mt-1 text-xs text-on-error-container/70">
              Records currently requiring attention.
            </p>
          </div>
        </section>
      </section>

      <section className="mb-6 rounded-2xl border border-outline-variant/70 bg-white shadow-[0_8px_26px_rgba(11,45,85,0.055)]">
        <div className="border-b border-outline-variant/70 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-primary">
                Document processing
              </p>

              <h2 className="mt-1 text-xl font-bold text-on-surface">
                Recent Processing Jobs
              </h2>

              <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                Live processing jobs currently stored in MongoDB.
              </p>
            </div>

            <div className="rounded-lg bg-surface-container-low px-4 py-3 sm:text-right">
              <p className="font-mono text-sm font-bold text-on-surface">
                {processedBatchDocuments.toLocaleString()} / {totalBatchDocuments.toLocaleString()}
              </p>

              <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-outline">
                {batchProgress}% completed
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          {batches.length === 0 ? (
            <div className="rounded-xl border border-outline-variant/70 bg-[#f4f6f9] p-8 text-center text-sm text-on-surface-variant">
              No processing jobs found.
            </div>
          ) : (
            batches.slice(0, 10).map((batch) => {
              const progress =
                batch.totalCount > 0
                  ? Math.round((batch.processedCount / batch.totalCount) * 100)
                  : 0;

              const statusLabel =
                batch.status === 'completed'
                  ? 'Completed'
                  : batch.status === 'processing'
                    ? 'Processing'
                    : batch.status === 'failed'
                      ? 'Failed'
                      : 'Queued';

              return (
                <div
                  key={batch.id}
                  className="rounded-xl border border-outline-variant/70 bg-[#f4f6f9] p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="break-all text-sm font-bold text-on-surface">
                          {batch.name}
                        </h3>

                        <span
                          className={[
                            'rounded-md border px-2.5 py-1',
                            'text-[10px] font-bold uppercase tracking-[0.08em]',
                            batch.status === 'completed'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : batch.status === 'failed'
                                ? 'border-error/30 bg-error-container text-error'
                                : 'border-amber-200 bg-amber-50 text-amber-700',
                          ].join(' ')}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      <p className="mt-1 font-mono text-[10px] text-outline">
                        {batch.id} · {batch.documentCount} document
                      </p>
                    </div>

                    <div className="w-full lg:max-w-md">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-on-surface-variant">
                          Processing
                        </span>

                        <span className="font-mono text-xs font-semibold text-on-surface">
                          {batch.processedCount}/{batch.totalCount}
                        </span>
                      </div>

                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-container-high">
                        <div
                          className={[
                            'h-full rounded-full transition-all',
                            batch.status === 'failed'
                              ? 'bg-error'
                              : 'bg-primary',
                          ].join(' ')}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-outline-variant/70 bg-white shadow-[0_8px_26px_rgba(11,45,85,0.055)]">
        <div className="border-b border-outline-variant/70 px-5 py-5 sm:px-6">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-primary">
            Operations
          </p>

          <h2 className="mt-1 text-xl font-bold text-on-surface">
            Officer Activity
          </h2>

          <p className="mt-1 text-xs leading-5 text-on-surface-variant">
            Officer accounts currently registered in the system.
          </p>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[700px] text-left">
            <thead>
              <tr className="border-b border-outline-variant/70 bg-[#eef1f4]-low">
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
                  Officer ID
                </th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
                  Name
                </th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
                  Status
                </th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
                  Throughput
                </th>
              </tr>
            </thead>

            <tbody>
              {officers.map((officer) => (
                <tr
                  key={officer.id}
                  className="border-b border-outline-variant/60 last:border-0 hover:bg-surface-container-low"
                >
                  <td className="px-5 py-4 font-mono text-xs text-outline">
                    {officer.id}
                  </td>

                  <td className="px-5 py-4 text-sm font-medium text-on-surface">
                    {officer.name}
                  </td>

                  <td className="px-5 py-4">
                    <OfficerStatus status={officer.status} />
                  </td>

                  <td className="px-5 py-4 text-right font-mono text-xs text-on-surface-variant">
                    {officer.throughput}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-4 md:hidden">
          {officers.map((officer) => (
            <div
              key={officer.id}
              className="rounded-xl border border-outline-variant/70 bg-[#f4f6f9] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-on-surface">
                    {officer.name}
                  </p>

                  <p className="mt-1 font-mono text-[10px] text-outline">
                    {officer.id}
                  </p>
                </div>

                <OfficerStatus status={officer.status} />
              </div>

              <div className="mt-4 border-t border-outline-variant/60 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-outline">
                  Throughput
                </p>

                <p className="mt-1 font-mono text-sm font-semibold text-on-surface">
                  {officer.throughput}
                </p>
              </div>
            </div>
          ))}
        </div>

        {officers.length === 0 && (
          <div className="p-8 text-center text-sm text-on-surface-variant">
            No officer accounts found.
          </div>
        )}
      </section>

      <section className="rounded-xl border border-outline-variant/70 bg-[#f4f6f9] px-5 py-4 sm:px-6">
        <p className="text-sm font-semibold text-on-surface">
          Administrative monitoring
        </p>

        <p className="mt-1 max-w-4xl text-xs leading-5 text-on-surface-variant">
          Dashboard values are read from the live FastAPI and MongoDB
          services. Record changes continue through the review and audit
          workflow.
        </p>
      </section>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  subtitle: string;
  emphasis?: boolean;
}

function MetricCard({
  label,
  value,
  subtitle,
  emphasis = false,
}: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-outline-variant/70 bg-white shadow-[0_8px_26px_rgba(11,45,85,0.055)] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
        {label}
      </p>

      <p
        className={[
          'mt-4 font-mono text-3xl font-bold tracking-tight',
          emphasis ? 'text-error' : 'text-on-surface',
        ].join(' ')}
      >
        {value}
      </p>

      <p className="mt-2 text-xs text-on-surface-variant">
        {subtitle}
      </p>
    </article>
  );
}

function OfficerStatus({
  status,
}: {
  status: 'active' | 'idle' | 'offline';
}) {
  const config = {
    active: {
      label: 'Active',
      classes: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    idle: {
      label: 'Idle',
      classes: 'border-amber-200 bg-amber-50 text-amber-700',
    },
    offline: {
      label: 'Offline',
      classes: 'border-outline-variant bg-surface-container text-outline',
    },
  }[status];

  return (
    <span
      className={[
        'inline-flex rounded-md border px-2.5 py-1',
        'text-[10px] font-bold uppercase tracking-[0.08em]',
        config.classes,
      ].join(' ')}
    >
      {config.label}
    </span>
  );
}
