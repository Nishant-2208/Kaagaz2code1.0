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
  {
    to: '/upload',
    label: 'Upload',
    icon: 'upload_file',
    roles: ['officer'],
  },
  {
    to: '/review',
    label: 'Review',
    icon: 'rate_review',
    roles: ['officer', 'reviewer', 'admin'],
  },
  {
    to: '/queue',
    label: 'Queue',
    icon: 'pending_actions',
    roles: ['officer', 'reviewer', 'admin'],
  },
  {
    to: '/records',
    label: 'Records',
    icon: 'inventory_2',
    roles: ['officer', 'reviewer', 'admin'],
  },
  {
    to: '/map',
    label: 'Map',
    icon: 'map',
    roles: ['officer', 'reviewer', 'admin'],
  },
  {
    to: '/admin',
    label: 'Admin',
    icon: 'admin_panel_settings',
    roles: ['admin'],
  },
];

function Brand() {
  return (
    <NavLink
      to="/"
      aria-label="Kaagaz2Code home"
      className="group flex min-w-0 items-center gap-3"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary shadow-sm">
        <span className="material-symbols-outlined text-[22px] icon-fill">
          account_balance
        </span>
      </span>

      <span className="min-w-0">
        <span className="block truncate font-headline text-[20px] font-bold leading-tight tracking-tight text-primary">
          Kaagaz2Code
        </span>

        <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
          Land Record Verification
        </span>
      </span>
    </NavLink>
  );
}

const ROLE_LABELS: Record<UserRole, string> = {
  officer: 'Revenue Officer',
  reviewer: 'Senior Reviewer',
  admin: 'Administrator',
  citizen: 'Citizen',
};

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
      className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-2.5 py-2 text-left transition-colors hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary"
      aria-label="Sign out"
      title="Click to sign out"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
        <span className="material-symbols-outlined text-[19px] icon-fill">
          person
        </span>
      </span>

      <span className="hidden xl:block min-w-0">
        <span className="block truncate text-xs font-semibold text-on-surface">
          {user ? ROLE_LABELS[user.role] : 'Officer'}
        </span>

        <span className="block font-mono text-[10px] text-on-surface-variant">
          {user?.id ?? '—'}
        </span>
      </span>

      <span className="material-symbols-outlined hidden xl:block text-[18px] text-outline">
        logout
      </span>
    </button>
  );
}

function DesktopNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="Officer navigation"
      className="flex items-center gap-1 rounded-xl border border-outline-variant bg-surface-container-low p-1"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            [
              'group flex items-center gap-2 rounded-lg px-3 py-2',
              'text-xs font-semibold',
              'transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-primary',
              isActive
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-lowest/70 hover:text-primary',
            ].join(' ')
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={[
                  'material-symbols-outlined text-[19px]',
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
      {/* =====================================================
          DESKTOP HEADER
          ===================================================== */}
      <header className="fixed inset-x-0 top-0 z-50 hidden border-b border-outline-variant/80 bg-surface/95 backdrop-blur md:block">
        <div className="mx-auto flex h-[76px] max-w-[1600px] items-center gap-6 px-6 lg:px-8">
          {/* Brand */}
          <div className="shrink-0">
            <Brand />
          </div>

          {/* Navigation */}
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex justify-center">
              <DesktopNav items={visibleNavItems} />
            </div>
          </div>

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              aria-label="Notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <span className="material-symbols-outlined text-[21px]">
                notifications
              </span>

              <span
                aria-hidden="true"
                className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-error"
              />
            </button>

            <UserProfile />
          </div>
        </div>
      </header>

      {/* =====================================================
          MOBILE HEADER
          ===================================================== */}
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-outline-variant/80 bg-surface/95 px-4 backdrop-blur md:hidden">
        <Brand />

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest text-primary"
          >
            <span className="material-symbols-outlined text-[21px]">
              notifications
            </span>

            <span
              aria-hidden="true"
              className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-error"
            />
          </button>

          <button
            type="button"
            aria-label="Open navigation"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest text-primary"
          >
            <span className="material-symbols-outlined text-[22px]">
              menu
            </span>
          </button>
        </div>
      </header>

      {/* =====================================================
          MAIN CONTENT
          ===================================================== */}
      <main className="mx-auto min-h-screen w-full max-w-[1600px] px-4 pb-24 pt-24 sm:px-6 md:px-8 lg:px-10 lg:pb-10">
        <div className="mx-auto w-full max-w-[1480px]">
          <Outlet />
        </div>
      </main>

      {/* =====================================================
          MOBILE BOTTOM NAV
          ===================================================== */}
      <nav
        aria-label="Mobile officer navigation"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-outline-variant bg-surface/95 px-2 pb-safe backdrop-blur md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 py-2">
          {visibleNavItems.slice(0, 5).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'flex min-h-14 flex-col items-center justify-center rounded-xl',
                  'transition-colors focus:outline-none focus:ring-2 focus:ring-primary',
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

                  <span className="mt-1 text-[10px] font-semibold">
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}