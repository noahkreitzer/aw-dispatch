import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Truck, MapPin, Settings, UserCheck } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Board', icon: LayoutDashboard },
  { to: '/my-schedule', label: 'My Schedule', icon: UserCheck },
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/trucks', label: 'Trucks', icon: Truck },
  { to: '/routes', label: 'Routes', icon: MapPin },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function AppShell() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f7]">
      {/* Header — desktop */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/60 px-5 py-2.5 flex items-center justify-between shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Anthracite Waste Services" className="h-8 w-8 rounded-lg" />
          <span className="font-semibold text-[15px] tracking-tight text-gray-900">
            AW Dispatch
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`
              }
            >
              <Icon size={15} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-200/60 flex justify-around py-2 z-50 safe-area-bottom">
        {navItems.filter(n => ['/', '/my-schedule', '/employees', '/settings'].includes(n.to)).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-200 min-w-[60px]
              ${isActive ? 'text-blue-500' : 'text-gray-400'}`
            }
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
