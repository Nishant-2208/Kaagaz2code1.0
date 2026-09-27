import { NavLink, Outlet } from 'react-router-dom';

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-body flex flex-col">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-[#cbd5e1] bg-white">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
          <NavLink
            to="/lookup"
            className="flex items-center gap-3"
            aria-label="Kaagaz2Code home"
          >
            <span className="flex h-8 w-8 items-center justify-center bg-[#0d9488] text-white font-bold rounded">
              K2C
            </span>
            <span className="flex flex-col">
              <span className="font-bold text-[#0f172a] text-lg leading-tight">
                Kaagaz2Code
              </span>
              <span className="hidden sm:block text-[10px] text-[#334155] uppercase font-semibold tracking-wider">
                Land Record Digitisation & Validation
              </span>
            </span>
          </NavLink>

          <div className="flex items-center gap-3">
            <NavLink
              to="/lookup"
              className={({ isActive }) =>
                `hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#e0f2fe] text-[#0284c7]'
                    : 'text-[#334155] hover:bg-[#f1f5f9]'
                }`
              }
            >
              <span className="material-symbols-outlined text-[18px]">public</span>
              Citizen Portal
            </NavLink>

            <NavLink
              to="/login"
              className="inline-flex items-center gap-2 rounded border border-[#cbd5e1] bg-white px-3 py-1.5 text-sm font-semibold text-[#0f172a] hover:bg-[#f1f5f9]"
            >
              <span className="material-symbols-outlined text-[18px]">lock</span>
              Officer Login
            </NavLink>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 py-8">
        <div className="mx-auto w-full max-w-5xl px-6">
          <Outlet />
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#cbd5e1] bg-white py-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-6 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-semibold text-[#334155] uppercase tracking-wider">
            Kaagaz2Code · Citizen Verification Portal
          </span>
          <span className="text-xs text-[#64748b]">
            Verify the status of digitized land records.
          </span>
        </div>
      </footer>
    </div>
  );
}