import { NavLink, Outlet } from 'react-router-dom';

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-surface text-on-surface font-body">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="sticky top-0 z-50 border-b border-outline-variant/70 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-[76px] w-full max-w-[1600px] items-center justify-between px-5 sm:px-8 lg:px-10">

          <NavLink
            to="/login"
            className="flex items-center gap-3"
            aria-label="Kaagaz2Code home"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-on-primary shadow-sm">
              <span className="material-symbols-outlined text-[22px] icon-fill">
                account_balance
              </span>
            </span>

            <span>
              <span className="block font-headline text-xl font-bold tracking-tight text-primary">
                Kaagaz2Code
              </span>

              <span className="hidden sm:block text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                Land Record Verification
              </span>
            </span>
          </NavLink>

          <div className="flex items-center gap-2 sm:gap-3">

            <NavLink
              to="/lookup"
              className={({ isActive }) =>
                [
                  'hidden sm:inline-flex items-center gap-2 rounded-lg px-4 py-2.5',
                  'text-xs font-semibold uppercase tracking-[0.05em]',
                  'transition-colors',
                  isActive
                    ? 'bg-primary-fixed text-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary',
                ].join(' ')
              }
            >
              <span className="material-symbols-outlined text-[18px]">
                public
              </span>

              Citizen Portal
            </NavLink>

            <NavLink
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.05em] text-primary hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined text-[18px]">
                lock
              </span>

              Officer Login
            </NavLink>

          </div>
        </div>
      </header>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="min-h-[calc(100vh-76px)]">
        <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10">
          <Outlet />
        </div>
      </main>

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer className="border-t border-outline-variant/60 bg-surface-container-low">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Kaagaz2Code · Citizen Verification Portal
          </span>

          <span className="text-xs text-outline">
            Verify the status of digitized land records.
          </span>
        </div>
      </footer>

    </div>
  );
}