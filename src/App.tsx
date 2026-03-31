import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import AuthGate from '@/components/auth/AuthGate';
import AppShell from '@/components/layout/AppShell';
import DispatchBoard from '@/components/board/DispatchBoard';
import EmployeeManager from '@/components/managers/EmployeeManager';
import TruckManager from '@/components/managers/TruckManager';
import RouteManager from '@/components/managers/RouteManager';
import SettingsPage from '@/components/settings/Settings';
import MySchedule from '@/components/schedule/MySchedule';
import { useEmployeeStore } from '@/stores/employeeStore';
import { useTruckStore } from '@/stores/truckStore';
import { useRouteStore } from '@/stores/routeStore';

function DataLoader() {
  const fetchEmployees = useEmployeeStore((s) => s.fetchEmployees);
  const fetchTrucks = useTruckStore((s) => s.fetchTrucks);
  const fetchRoutes = useRouteStore((s) => s.fetchRoutes);

  useEffect(() => {
    fetchEmployees();
    fetchTrucks();
    fetchRoutes();
  }, [fetchEmployees, fetchTrucks, fetchRoutes]);

  return null;
}

export default function App() {
  return (
    <AuthGate>
      <DataLoader />
      <BrowserRouter>
        <TooltipProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<DispatchBoard />} />
              <Route path="/my-schedule" element={<MySchedule />} />
              <Route path="/employees" element={<EmployeeManager />} />
              <Route path="/trucks" element={<TruckManager />} />
              <Route path="/routes" element={<RouteManager />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </BrowserRouter>
    </AuthGate>
  );
}
