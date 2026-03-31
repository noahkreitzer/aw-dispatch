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
    <div className="min-h-screen flex flex-col">
      {/* Header — desktop */}
      <header className="bg-[#1A1A1A] text-white px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Anthracite Waste Services" className="h-8 w-8 rounded" />
          <span className="font-heading text-base font-bold tracking-wide text-[#F5C400]">
            AW DISPATCH
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-0.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono transition-colors ${
                  isActive
                    ? 'bg-[#F5C400] text-[#1A1A1A] font-bold'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`
              }
            >
              <Icon size={14} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto pb-14 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-1 z-50 safe-area-bottom">
        {navItems.filter(n => ['/', '/my-schedule', '/employees', '/settings'].includes(n.to)).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-[56px]
              ${isActive ? 'text-[#1A1A1A]' : 'text-gray-400'}`
            }
          >
            <Icon size={18} />
            <span className="text-[9px] font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
