import { NavLink, Outlet } from 'react-router-dom';

const LOGO_SRC = '/7c8c5500-3a65-4189-b42f-07d6d77a0f26.jpg';

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-surface text-on-surface font-body">
      <div className="h-1 bg-gradient-to-r from-[#f28c28] via-white to-[#168548]" />

      <header className="sticky top-0 z-50 border-b border-outline-variant/70 bg-white/95 shadow-[0_2px_14px_rgba(11,45,85,0.06)] backdrop-blur">
        <div className="border-b border-outline-variant/50 bg-[#f7f8fa]">
          <div className="mx-auto flex min-h-8 w-full max-w-[1600px] items-center justify-between px-5 text-[10px] font-semibold text-on-surface-variant sm:px-8 lg:px-10">
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[15px] text-primary icon-fill">
                account_balance
              </span>
              Government Services Prototype
            </span>
            <span className="hidden sm:inline">Digital Land Records & Verification</span>
          </div>
        </div>

        <div className="mx-auto flex min-h-[78px] w-full max-w-[1600px] items-center justify-between gap-5 px-5 sm:px-8 lg:px-10">
          <NavLink
            to="/login"
            className="flex min-w-0 items-center gap-3.5"
            aria-label="Kaagaz2Code home"
          >
            <img
              src={LOGO_SRC}
              alt="Kaagaz2Code"
              className="h-12 w-12 shrink-0 rounded-lg object-contain"
            />

            <span className="min-w-0">
              <span className="block truncate font-headline text-xl font-extrabold tracking-tight text-primary sm:text-[22px]">
                Kaagaz2Code
              </span>
              <span className="mt-0.5 hidden text-[10px] font-semibold uppercase tracking-[0.13em] text-on-surface-variant sm:block">
                Land Record Verification System
              </span>
            </span>
          </NavLink>

          <div className="flex items-center gap-2 sm:gap-3">
            <NavLink
              to="/lookup"
              className={({ isActive }) =>
                [
                  'inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-bold transition-all',
                  isActive
                    ? 'bg-primary-fixed text-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary',
                ].join(' ')
              }
            >
              <span className="material-symbols-outlined text-[18px] icon-fill">search</span>
              <span className="hidden sm:inline">Citizen Portal</span>
              <span className="sm:hidden">Search</span>
            </NavLink>

            <NavLink
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-[#0b2d55] px-3.5 py-2.5 text-xs font-bold !text-white shadow-sm transition-all hover:bg-[#123f73] hover:shadow-md" style={{ color: '#ffffff' }}
            >
              <span className="material-symbols-outlined text-[18px]">lock</span>
              <span className="hidden sm:inline">Officer Login</span>
              <span className="sm:hidden">Login</span>
            </NavLink>
          </div>
        </div>
      </header>

      <main className="min-h-[calc(100vh-110px)] bg-[radial-gradient(circle_at_top,#eef4fb_0%,#fbfaf7_38%,#fbfaf7_100%)]">
        <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-outline-variant/70 bg-[#0b2d55] text-white">
        <div className="mx-auto grid w-full max-w-[1600px] gap-4 px-5 py-6 sm:px-8 lg:grid-cols-[1fr_auto] lg:px-10">
          <div>
            <p className="text-sm font-bold">Kaagaz2Code</p>
            <p className="mt-1 text-xs text-white/70">
              Digital land-record verification and public lookup prototype.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/70">
            <span className="h-2 w-2 rounded-full bg-[#168548]" />
            Verification status is shown from the available digitized records.
          </div>
        </div>
      </footer>
    </div>
  );
}
