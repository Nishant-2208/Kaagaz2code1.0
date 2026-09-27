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
    to: '/records/REC-8924',
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
      className="flex items-center gap-3"
    >
      <span className="flex h-8 w-8 items-center justify-center bg-[#0d9488] text-white font-bold rounded">
        K2C
      </span>
      <span className="flex flex-col">
        <span className="font-bold text-[#0f172a] text-lg leading-tight">
          Kaagaz2Code
        </span>
        <span className="text-[10px] text-[#334155] uppercase font-semibold tracking-wider">
          Land Record Digitisation & Validation
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
    <div className="flex items-center gap-4">
      <div className="flex flex-col text-right hidden sm:flex">
        <span className="text-sm font-semibold text-[#0f172a]">
          {user ? ROLE_LABELS[user.role] : 'Officer'}
        </span>
        <span className="text-xs text-[#334155]">
          {user?.id ?? '—'}
        </span>
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 px-3 py-1.5 border border-[#cbd5e1] rounded text-sm text-[#0f172a] hover:bg-[#f1f5f9]"
      >
        Sign Out
      </button>
    </div>
  );
}

export default function OfficerLayout() {
  const { user } = useAuth();

  const visibleNavItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-body">
      {/* HEADER */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#cbd5e1] bg-white px-6">
        <Brand />
        <UserProfile />
      </header>

      {/* LAYOUT BODY */}
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <aside className="w-64 shrink-0 border-r border-[#cbd5e1] bg-white overflow-y-auto hidden md:block">
          <nav className="flex flex-col gap-1 p-4">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#e0f2fe] text-[#0284c7]'
                      : 'text-[#334155] hover:bg-[#f1f5f9]'
                  }`
                }
              >
                <span className="material-symbols-outlined text-[20px]">
                  {item.icon}
                </span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto max-w-5xl bg-white border border-[#cbd5e1] shadow-sm rounded-lg p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}