import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Truck, MapPin, Settings } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dispatch Board', icon: LayoutDashboard },
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/trucks', label: 'Trucks', icon: Truck },
  { to: '/routes', label: 'Routes', icon: MapPin },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function AppShell() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-[#1A1A1A] text-white px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Anthracite Waste Services" className="h-8 w-8 rounded" />
          <span className="font-heading text-base font-bold tracking-wide text-[#F5C400]">
            AW DISPATCH
          </span>
        </div>
        <nav className="flex items-center gap-0.5">
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
              <span className="hidden md:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
