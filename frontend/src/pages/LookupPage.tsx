import { useState } from 'react';
import { getLookupResults } from '../api/services';
import type { LookupResult } from '../api/types';

type SearchType = 'khasra' | 'owner' | 'village';

function StatusIcon({ status }: { status: LookupResult['status'] }) {
  const config = {
    approved: {
      icon: 'verified',
      label: 'Approved',
      className: 'bg-secondary-fixed text-on-secondary-fixed',
    },
    verified: {
      icon: 'verified',
      label: 'Verified',
      className: 'bg-secondary-fixed text-on-secondary-fixed',
    },
    pending_review: {
      icon: 'schedule',
      label: 'Pending Review',
      className: 'bg-surface-container-high text-on-surface-variant',
    },
    in_review: {
      icon: 'rate_review',
      label: 'In Review',
      className: 'bg-amber-50 text-amber-700',
    },
    flagged: {
      icon: 'flag',
      label: 'Flagged',
      className: 'bg-error-container text-on-error-container',
    },
    discrepancy: {
      icon: 'warning',
      label: 'Discrepancy',
      className: 'bg-error-container text-on-error-container',
    },
    locked: {
      icon: 'lock',
      label: 'Locked',
      className: 'bg-surface-container-high text-on-surface-variant',
    },
  }[status];

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5',
        'text-xs font-semibold',
        config.className,
      ].join(' ')}
    >
      <span className="material-symbols-outlined text-[17px] icon-fill">
        {config.icon}
      </span>

      {config.label}
    </span>
  );
}

function ResultCard({ result }: { result: LookupResult }) {
  return (
    <article className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5 sm:p-6 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_6px_20px_rgba(15,23,42,0.07)]">

      {/* Top row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
            Khasra / Survey Number
          </p>

          <h2 className="mt-2 font-mono text-xl font-bold tracking-tight text-on-surface">
            {result.khasraNo}
          </h2>
        </div>

        <StatusIcon status={result.status} />

      </div>

      {/* Main information */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

        <div className="rounded-xl bg-surface-container-low p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
            Owner
          </p>

          <p className="mt-2 text-sm font-semibold text-on-surface">
            {result.ownerName}
          </p>
        </div>

        <div className="rounded-xl bg-surface-container-low p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
            Area
          </p>

          <p className="mt-2 font-mono text-sm font-semibold text-on-surface">
            {result.area} hectares
          </p>
        </div>

        <div className="rounded-xl bg-surface-container-low p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
            Village
          </p>

          <p className="mt-2 text-sm font-semibold text-on-surface">
            {result.village}
          </p>
        </div>

        <div className="rounded-xl bg-surface-container-low p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
            Land Type
          </p>

          <p className="mt-2 text-sm font-semibold text-on-surface">
            {result.landType}
          </p>
        </div>

      </div>

      {/* Location */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-outline-variant/60 pt-4 text-xs text-on-surface-variant">

        <span className="inline-flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[17px] text-primary">
            location_city
          </span>

          Tehsil: <strong className="text-on-surface">{result.tehsil}</strong>
        </span>

        <span className="inline-flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[17px] text-primary">
            map
          </span>

          District: <strong className="text-on-surface">{result.district}</strong>
        </span>

      </div>

      {/* Verification note */}
      <div className="mt-4 flex items-start gap-3 rounded-xl bg-primary-fixed/35 p-4">

        <span className="material-symbols-outlined shrink-0 text-[20px] text-primary icon-fill">
          verified_user
        </span>

        <div>
          <p className="text-sm font-semibold text-on-surface">
            Public verification status
          </p>

          <p className="mt-1 text-xs leading-5 text-on-surface-variant">
            This record is displayed from the digitization and
            verification system. Technical OCR and processing details
            remain part of the authorized officer workflow.
          </p>
        </div>

      </div>
    </article>
  );
}

export default function LookupPage() {
  const [searchType, setSearchType] = useState<SearchType>('khasra');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LookupResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!query.trim()) return;

    setError('');
    setIsSearching(true);

    try {
      const matches = await getLookupResults({
        type: searchType,
        query: query.trim(),
      });
      setResults(matches);
    } catch {
      setError(
        'The record lookup service is unavailable right now. Please try again shortly.',
      );
      setResults(null);
    } finally {
      setIsSearching(false);
    }
  }

  function handleSearchTypeChange(type: SearchType) {
    setSearchType(type);
    setQuery('');
    setResults(null);
    setError('');
  }

  const searchConfig: Record<
    SearchType,
    {
      label: string;
      placeholder: string;
      icon: string;
    }
  > = {
    khasra: {
      label: 'Khasra / Survey Number',
      placeholder: 'Enter Khasra or Survey number, e.g. 452/1A',
      icon: 'tag',
    },
    owner: {
      label: 'Owner Name',
      placeholder: 'Enter registered owner name',
      icon: 'person',
    },
    village: {
      label: 'Village',
      placeholder: 'Enter village name, e.g. Rampur',
      icon: 'location_on',
    },
  };

  const activeSearch = searchConfig[searchType];
  const hasResults = results !== null && results.length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl py-8 sm:py-12 lg:py-16">

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="mx-auto max-w-4xl text-center">

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-fixed text-primary shadow-sm">
          <span className="material-symbols-outlined text-[28px] icon-fill">
            verified
          </span>
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Public Verification Service
        </p>

        <h1 className="mt-3 font-headline text-4xl font-bold tracking-tight text-primary sm:text-5xl">
          Public Record Lookup
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-on-surface-variant sm:text-lg">
          Search digitally verified land-record information using a
          Khasra number, registered owner name, or village.
        </p>

      </section>

      {/* =====================================================
          SEARCH PANEL
      ===================================================== */}

      <section className="mx-auto mt-10 max-w-5xl rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)] sm:p-7 lg:p-8">

        {/* Search modes */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
            Search records by
          </p>

          <div
            className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3"
            role="tablist"
            aria-label="Search method"
          >
            {(Object.keys(searchConfig) as SearchType[]).map((type) => {
              const active = searchType === type;

              return (
                <button
                  key={type}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleSearchTypeChange(type)}
                  className={[
                    'flex min-h-12 items-center justify-center gap-2 rounded-xl px-4',
                    'text-sm font-semibold',
                    'transition-all duration-150',
                    'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                    active
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'border border-outline-variant bg-surface text-on-surface-variant hover:border-primary/40 hover:bg-surface-container-low hover:text-primary',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'material-symbols-outlined text-[20px]',
                      active ? 'icon-fill' : '',
                    ].join(' ')}
                  >
                    {searchConfig[type].icon}
                  </span>

                  {searchConfig[type].label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search form */}
        <form
          onSubmit={handleSearch}
          className="mt-7"
        >
          <label
            htmlFor="search-input"
            className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-on-surface-variant"
          >
            {activeSearch.label}
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">

            <div className="relative flex-1">

              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                <span className="material-symbols-outlined text-[22px]">
                  {activeSearch.icon}
                </span>
              </span>

              <input
                id="search-input"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={activeSearch.placeholder}
                required
                className="h-14 w-full rounded-xl border border-outline-variant bg-surface px-12 text-sm text-on-surface placeholder:text-outline-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />

            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-primary px-7 text-sm font-semibold uppercase tracking-[0.05em] text-on-primary shadow-sm transition-all hover:bg-primary-container hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 sm:min-w-[150px]"
            >
              <span
                className={[
                  'material-symbols-outlined text-[21px]',
                  isSearching ? 'animate-spin' : '',
                ].join(' ')}
              >
                {isSearching ? 'progress_activity' : 'search'}
              </span>

              {isSearching ? 'Searching…' : 'Search Records'}
            </button>

          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-[17px] text-primary">
              info
            </span>

            Example:
            <span className="font-mono text-on-surface">
              {searchType === 'khasra'
                ? '452/1A'
                : searchType === 'owner'
                  ? 'Rajesh Kumar Sharma'
                  : 'Rampur'}
            </span>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-center gap-2 rounded-lg border border-error bg-error-container px-4 py-3 text-xs font-medium text-on-error-container"
            >
              <span className="material-symbols-outlined text-base">error</span>
              {error}
            </div>
          )}
        </form>

      </section>

      {/* =====================================================
          RESULTS
      ===================================================== */}

      {results && (
        <section className="mx-auto mt-10 max-w-5xl">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                Search Results
              </p>

              <h2 className="mt-1 font-headline text-2xl font-bold text-on-surface">
                {results.length} matching records
              </h2>

              <p className="mt-1 text-sm text-on-surface-variant">
                Review the verification status and essential public information.
              </p>
            </div>

            {hasResults && (
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary-fixed px-3 py-2 text-xs font-semibold text-on-secondary-fixed">
                <span className="material-symbols-outlined text-[17px] icon-fill">
                  verified
                </span>

                Approved records available
              </span>
            )}

          </div>

          {hasResults ? (
            <div className="mt-5 space-y-4">
              {results.map((result) => (
                <ResultCard
                  key={`${result.khasraNo}-${result.ownerName}-${result.village}`}
                  result={result}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-outline-variant/70 bg-surface-container-low p-8 text-center">
              <span className="material-symbols-outlined text-4xl text-outline">
                search_off
              </span>

              <p className="mt-3 text-sm font-semibold text-on-surface">
                No approved records found
              </p>

              <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                Try another search value for this search method.
              </p>
            </div>
          )}

        </section>
      )}

      {/* =====================================================
          EMPTY STATE
      ===================================================== */}

      {!results && (
        <section className="mx-auto mt-10 max-w-5xl">

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

            <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-low p-5">
              <span className="material-symbols-outlined text-[24px] text-primary icon-fill">
                search
              </span>

              <h3 className="mt-4 text-sm font-semibold text-on-surface">
                Search a record
              </h3>

              <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                Use a Khasra number, owner name, or village.
              </p>
            </div>

            <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-low p-5">
              <span className="material-symbols-outlined text-[24px] text-primary icon-fill">
                fact_check
              </span>

              <h3 className="mt-4 text-sm font-semibold text-on-surface">
                Check verification
              </h3>

              <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                See whether the record has been verified.
              </p>
            </div>

            <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-low p-5">
              <span className="material-symbols-outlined text-[24px] text-primary icon-fill">
                visibility
              </span>

              <h3 className="mt-4 text-sm font-semibold text-on-surface">
                View essential details
              </h3>

              <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                Public users see only essential record information.
              </p>
            </div>

          </div>

        </section>
      )}

      {/* =====================================================
          DISCLAIMER
      ===================================================== */}

      <section className="mx-auto mt-10 max-w-5xl rounded-2xl border border-outline-variant/70 bg-surface-container-low p-5 sm:p-6">

        <div className="flex items-start gap-3">

          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary">
            <span className="material-symbols-outlined text-[20px] icon-fill">
              shield
            </span>
          </span>

          <div>
            <h2 className="text-sm font-semibold text-on-surface">
              Public verification, not legal adjudication
            </h2>

            <p className="mt-1 text-xs leading-5 text-on-surface-variant">
              Kaagaz2Code provides a clear view of the digitization and
              verification status available in the system. It does not
              independently determine legal ownership or resolve land disputes.
            </p>
          </div>

        </div>

      </section>

    </div>
  );
}