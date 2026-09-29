import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../api/types';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  { to: '/upload', label: 'Upload', icon: 'upload_file', roles: ['officer'] },
  { to: '/review', label: 'Review', icon: 'rate_review', roles: ['officer', 'reviewer', 'admin'] },
  { to: '/queue', label: 'Queue', icon: 'pending_actions', roles: ['officer', 'reviewer', 'admin'] },
  { to: '/records', label: 'Records', icon: 'inventory_2', roles: ['officer', 'reviewer', 'admin'] },
  { to: '/map', label: 'Map', icon: 'map', roles: ['officer', 'reviewer', 'admin'] },
  { to: '/admin', label: 'Admin', icon: 'admin_panel_settings', roles: ['admin'] },
];

const LOGO_SRC = '/7c8c5500-3a65-4189-b42f-07d6d77a0f26.jpg';

const ROLE_LABELS: Record<UserRole, string> = {
  officer: 'Revenue Officer',
  reviewer: 'Senior Reviewer',
  admin: 'Administrator',
  citizen: 'Citizen',
};

function Brand() {
  return (
    <NavLink
      to="/"
      aria-label="Kaagaz2Code home"
      className="group flex min-w-0 items-center gap-3"
    >
      <img
        src={LOGO_SRC}
        alt="Kaagaz2Code"
        className="h-11 w-11 shrink-0 rounded-lg object-contain"
      />
      <span className="min-w-0">
        <span className="block truncate font-headline text-[19px] font-extrabold leading-tight tracking-tight text-primary">
          Kaagaz2Code
        </span>
        <span className="mt-0.5 block truncate text-[9px] font-bold uppercase tracking-[0.13em] text-on-surface-variant">
          Land Record Verification
        </span>
      </span>
    </NavLink>
  );
}

function UserProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-2.5 py-2 text-left shadow-sm transition-colors hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary"
      aria-label="Sign out"
      title="Click to sign out"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
        <span className="material-symbols-outlined text-[19px] icon-fill">person</span>
      </span>

      <span className="hidden min-w-0 xl:block">
        <span className="block truncate text-xs font-bold text-on-surface">
          {user ? ROLE_LABELS[user.role] : 'Officer'}
        </span>
        <span className="block font-mono text-[10px] text-on-surface-variant">
          {user?.id ?? '—'}
        </span>
      </span>

      <span className="material-symbols-outlined hidden text-[18px] text-outline xl:block">
        logout
      </span>
    </button>
  );
}

function DesktopNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="Officer navigation"
      className="flex items-center gap-1 overflow-x-auto rounded-xl border border-outline-variant/70 bg-[#f4f6f9] p-1 shadow-inner"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            [
              'group flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2',
              'text-xs font-bold transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-primary',
              isActive
                ? 'bg-white text-primary shadow-sm ring-1 ring-primary/10'
                : 'text-on-surface-variant hover:bg-white/80 hover:text-primary',
            ].join(' ')
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={[
                  'material-symbols-outlined text-[18px]',
                  isActive ? 'icon-fill' : '',
                ].join(' ')}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default function OfficerLayout() {
  const { user } = useAuth();

  const visibleNavItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body">
      <div className="h-1 bg-gradient-to-r from-[#f28c28] via-white to-[#168548]" />

      <header className="fixed inset-x-0 top-0 z-50 hidden border-b border-outline-variant/80 bg-white/95 shadow-[0_2px_14px_rgba(11,45,85,0.07)] backdrop-blur md:block">
        <div className="border-b border-outline-variant/50 bg-[#f7f8fa]">
          <div className="mx-auto flex h-7 max-w-[1600px] items-center justify-between px-6 text-[9px] font-bold uppercase tracking-[0.08em] text-on-surface-variant lg:px-8">
            <span>Government Services Prototype</span>
            <span>Land Records · Verification · Digital Registry</span>
          </div>
        </div>

        <div className="mx-auto flex h-[76px] max-w-[1600px] items-center gap-5 px-6 lg:px-8">
          <div className="shrink-0">
            <Brand />
          </div>

          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex justify-center">
              <DesktopNav items={visibleNavItems} />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              aria-label="Notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant bg-white text-on-surface-variant shadow-sm transition-colors hover:bg-surface-container-low hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <span className="material-symbols-outlined text-[21px]">notifications</span>
              <span aria-hidden="true" className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-error" />
            </button>

            <UserProfile />
          </div>
        </div>
      </header>

      <header className="fixed inset-x-0 top-0 z-50 flex h-[68px] items-center justify-between border-b border-outline-variant/80 bg-white/95 px-4 shadow-sm backdrop-blur md:hidden">
        <Brand />
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant bg-white text-primary"
          >
            <span className="material-symbols-outlined text-[21px]">notifications</span>
            <span aria-hidden="true" className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-error" />
          </button>
          <button
            type="button"
            aria-label="Open navigation"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant bg-white text-primary"
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>
        </div>
      </header>

      <main className="mx-auto min-h-screen w-full max-w-[1600px] px-4 pb-24 pt-[126px] sm:px-6 md:px-8 lg:px-10 lg:pb-10">
        <div className="mx-auto w-full max-w-[1480px]">
          <Outlet />
        </div>
      </main>

      <nav
        aria-label="Mobile officer navigation"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-outline-variant bg-white/95 px-2 pb-safe shadow-[0_-4px_18px_rgba(11,45,85,0.08)] backdrop-blur md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 py-2">
          {visibleNavItems.slice(0, 5).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'flex min-h-14 flex-col items-center justify-center rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-primary',
                  isActive
                    ? 'bg-primary-fixed text-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-low',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={[
                      'material-symbols-outlined text-[21px]',
                      isActive ? 'icon-fill' : '',
                    ].join(' ')}
                  >
                    {item.icon}
                  </span>
                  <span className="mt-1 text-[10px] font-bold">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
