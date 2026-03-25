import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import AppShell from '@/components/layout/AppShell';
import DispatchBoard from '@/components/board/DispatchBoard';
import EmployeeManager from '@/components/managers/EmployeeManager';
import TruckManager from '@/components/managers/TruckManager';
import RouteManager from '@/components/managers/RouteManager';
import SettingsPage from '@/components/settings/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<DispatchBoard />} />
            <Route path="/employees" element={<EmployeeManager />} />
            <Route path="/trucks" element={<TruckManager />} />
            <Route path="/routes" element={<RouteManager />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </BrowserRouter>
  );
}
