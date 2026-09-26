import {
  mockAdminStats,
  mockBatches,
  mockOfficers,
} from '../api/mockData';

export default function AdminPage() {
  const stats = mockAdminStats;

  const activeOfficers = mockOfficers.filter(
    (officer) => officer.status === 'active',
  ).length;

  const totalBatchDocuments = mockBatches.reduce(
    (total, batch) => total + batch.totalCount,
    0,
  );

  const processedBatchDocuments = mockBatches.reduce(
    (total, batch) => total + batch.processedCount,
    0,
  );

  const batchProgress =
    totalBatchDocuments > 0
      ? Math.round(
        (processedBatchDocuments / totalBatchDocuments) * 100,
      )
      : 0;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="mb-8">

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">

          <div className="max-w-3xl">

            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Administration
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">
              Digitization Dashboard
            </h1>

            <p className="mt-3 text-sm leading-6 text-on-surface-variant sm:text-base">
              Monitor document processing, verification workload,
              extraction confidence, and operational activity.
            </p>

          </div>

          <span className="w-fit rounded-md border border-outline-variant bg-surface-container-low px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-outline">
            Prototype metrics
          </span>

        </div>

      </header>

      {/* =====================================================
          KEY METRICS
      ===================================================== */}

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <MetricCard
          label="Records processed"
          value={stats.totalRecords.toLocaleString()}
          subtitle={stats.monthlyVolume}
        />

        <MetricCard
          label="Aggregate confidence"
          value={`${stats.accuracyRate}%`}
          subtitle={`Trend +${stats.accuracyTrend}%`}
        />

        <MetricCard
          label="Pending conflicts"
          value={stats.pendingConflicts.toString()}
          subtitle="Action required"
          emphasis
        />

        <MetricCard
          label="Active officers"
          value={activeOfficers.toString()}
          subtitle={`${mockOfficers.length} registered in demo`}
        />

      </section>

      {/* =====================================================
          OVERVIEW
      ===================================================== */}

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">

        {/* CONFIDENCE */}

        <section className="rounded-xl border border-outline-variant/70 bg-surface-container-lowest p-5 sm:p-6">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

            <div>

              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                Processing quality
              </p>

              <h2 className="mt-1 text-xl font-bold text-on-surface">
                Extraction Confidence
              </h2>

              <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                Demonstration trend from the current mock dataset.
              </p>

            </div>

            <div className="rounded-lg bg-emerald-50 px-3 py-2">

              <p className="font-mono text-sm font-bold text-emerald-700">
                +{stats.accuracyTrend}%
              </p>

              <p className="mt-0.5 text-[10px] text-emerald-700">
                Current trend
              </p>

            </div>

          </div>

          {/* SIMPLE BAR CHART */}

          <div className="mt-8">

            <div className="flex h-[220px] items-end gap-2 border-b border-outline-variant/70 px-1 sm:gap-3">

              {stats.trendData.map((value, index) => {

                const isLatest =
                  index === stats.trendData.length - 1;

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
                      style={{
                        height: `${Math.max(
                          0,
                          Math.min(100, value),
                        )}%`,
                      }}
                      title={`Confidence trend: ${value}%`}
                    />

                  </div>
                );
              })}

            </div>

            <div className="mt-3 flex justify-between text-[10px] font-semibold uppercase tracking-[0.08em] text-outline">
              <span>Earlier</span>
              <span>Latest</span>
            </div>

          </div>

        </section>

        {/* CONFLICTS */}

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
              Records with detected conflicts should be reviewed
              before any verified record is changed.
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

      {/* =====================================================
          PROCESSING BATCHES
      ===================================================== */}

      <section className="mb-6 rounded-xl border border-outline-variant/70 bg-surface-container-lowest">

        <div className="border-b border-outline-variant/70 px-5 py-5 sm:px-6">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

            <div>

              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                Document intake
              </p>

              <h2 className="mt-1 text-xl font-bold text-on-surface">
                Recent Processing Batches
              </h2>

              <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                Current document intake and processing status.
              </p>

            </div>

            <div className="rounded-lg bg-surface-container-low px-4 py-3 sm:text-right">

              <p className="font-mono text-sm font-bold text-on-surface">
                {processedBatchDocuments.toLocaleString()}
                {' / '}
                {totalBatchDocuments.toLocaleString()}
              </p>

              <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-outline">
                {batchProgress}% processed
              </p>

            </div>

          </div>

        </div>

        <div className="space-y-4 p-5 sm:p-6">

          {mockBatches.map((batch) => {

            const progress =
              batch.totalCount > 0
                ? Math.round(
                  (batch.processedCount / batch.totalCount) * 100,
                )
                : 0;

            const statusLabel =
              batch.status === 'completed'
                ? 'Completed'
                : batch.status === 'processing'
                  ? 'Processing'
                  : batch.status === 'failed'
                    ? 'Failed'
                    : 'Uploading';

            return (
              <div
                key={batch.id}
                className="rounded-lg border border-outline-variant/70 bg-surface-container-low p-4 sm:p-5"
              >

                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-3">

                      <h3 className="text-sm font-bold text-on-surface">
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
                      {batch.id} · {batch.documentCount} documents
                    </p>

                  </div>

                  <div className="w-full lg:max-w-md">

                    <div className="flex items-center justify-between gap-3">

                      <span className="text-xs text-on-surface-variant">
                        Progress
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
                        style={{
                          width: `${progress}%`,
                        }}
                      />

                    </div>

                  </div>

                </div>

              </div>
            );
          })}

        </div>

      </section>

      {/* =====================================================
          OFFICER ACTIVITY
      ===================================================== */}

      <section className="mb-6 rounded-xl border border-outline-variant/70 bg-surface-container-lowest">

        <div className="border-b border-outline-variant/70 px-5 py-5 sm:px-6">

          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
            Operations
          </p>

          <h2 className="mt-1 text-xl font-bold text-on-surface">
            Officer Activity
          </h2>

          <p className="mt-1 text-xs leading-5 text-on-surface-variant">
            Current prototype assignment and throughput information.
          </p>

        </div>

        {/* DESKTOP TABLE */}

        <div className="hidden overflow-x-auto md:block">

          <table className="w-full min-w-[700px] text-left">

            <thead>
              <tr className="border-b border-outline-variant/70 bg-surface-container-low">

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

              {mockOfficers.map((officer) => (

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

        {/* MOBILE CARDS */}

        <div className="space-y-3 p-4 md:hidden">

          {mockOfficers.map((officer) => (

            <div
              key={officer.id}
              className="rounded-lg border border-outline-variant/70 bg-surface-container-low p-4"
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

      </section>

      {/* =====================================================
          ADMIN PRINCIPLE
      ===================================================== */}

      <section className="rounded-lg border border-outline-variant/70 bg-surface-container-low px-5 py-4 sm:px-6">

        <p className="text-sm font-semibold text-on-surface">
          Administrative monitoring
        </p>

        <p className="mt-1 max-w-4xl text-xs leading-5 text-on-surface-variant">
          This dashboard surfaces processing and verification activity.
          Record changes should continue through the review and audit
          workflow rather than being silently modified here.
        </p>

      </section>

    </div>
  );
}

/* =========================================================
   METRIC CARD
   ========================================================= */

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
    <article className="rounded-xl border border-outline-variant/70 bg-surface-container-lowest p-5">

      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
        {label}
      </p>

      <p
        className={[
          'mt-4 font-mono text-3xl font-bold tracking-tight',
          emphasis
            ? 'text-error'
            : 'text-on-surface',
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

/* =========================================================
   OFFICER STATUS
   ========================================================= */

function OfficerStatus({
  status,
}: {
  status: 'active' | 'idle' | 'offline';
}) {
  const config = {
    active: {
      label: 'Active',
      classes:
        'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    idle: {
      label: 'Idle',
      classes:
        'border-amber-200 bg-amber-50 text-amber-700',
    },
    offline: {
      label: 'Offline',
      classes:
        'border-outline-variant bg-surface-container text-outline',
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