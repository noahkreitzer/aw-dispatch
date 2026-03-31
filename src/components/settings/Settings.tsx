import { useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useEmployeeStore } from '@/stores/employeeStore';
import { useTruckStore } from '@/stores/truckStore';
import { useRouteStore } from '@/stores/routeStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Upload, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { defaultDispatchTemplate } from '@/lib/seedData';
import { buildDispatchMessage } from '@/lib/dispatch';
import type { Employee, Truck, Route as RouteType, Assignment } from '@/types';

export default function SettingsPage() {
  const { companyName, dispatchTemplate, setCompanyName, setDispatchTemplate } = useSettingsStore();
  const employees = useEmployeeStore((s) => s.employees);
  const trucks = useTruckStore((s) => s.trucks);
  const routes = useRouteStore((s) => s.routes);
  const scheduleAssignments = useScheduleStore((s) => s.assignments);

  const [localTemplate, setLocalTemplate] = useState(dispatchTemplate);

  const sampleEmployee: Employee = { id: '', name: 'Mike Barletta', role: 'driver', phone: '5705551234', active: true };
  const sampleTruck: Truck = { id: '', number: '101', type: 'rear-load', status: 'active' };
  const sampleRoute: RouteType = { id: '', name: 'Pottsville Trash', municipality: 'Pottsville', day: 'Monday', type: 'residential', stops: 180, active: true };
  const sampleAssignment: Assignment = { id: '', weekKey: '2026-W13', routeId: '', truckId: '', driverId: '', slingerIds: [], status: 'ready', notes: '' };
  const sampleSlingers: Employee[] = [
    { id: '', name: 'Tony Ferris', role: 'slinger', phone: '5705555678', active: true },
  ];

  const previewMessage = buildDispatchMessage(
    sampleEmployee, sampleAssignment, sampleRoute, sampleTruck,
    sampleEmployee, sampleSlingers, localTemplate, 'Monday'
  );

  const saveTemplate = () => {
    setDispatchTemplate(localTemplate);
    toast.success('Template saved');
  };

  const resetTemplate = () => {
    setLocalTemplate(defaultDispatchTemplate);
    setDispatchTemplate(defaultDispatchTemplate);
    toast.success('Reset to default template');
  };

  const exportAllData = () => {
    const data = {
      employees,
      trucks,
      routes,
      assignments: scheduleAssignments,
      settings: { companyName, dispatchTemplate },
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aw-dispatch-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Full backup exported');
  };

  const importAllData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.employees) {
            useEmployeeStore.setState({ employees: data.employees });
          }
          if (data.trucks) {
            useTruckStore.setState({ trucks: data.trucks });
          }
          if (data.routes) {
            useRouteStore.setState({ routes: data.routes });
          }
          if (data.assignments) {
            useScheduleStore.setState({ assignments: data.assignments });
          }
          if (data.settings) {
            if (data.settings.companyName) setCompanyName(data.settings.companyName);
            if (data.settings.dispatchTemplate) setDispatchTemplate(data.settings.dispatchTemplate);
          }
          toast.success('Data imported successfully');
        } catch {
          toast.error('Invalid backup file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const exportCSV = () => {
    const rows: string[] = ['Week,Day,Route,Municipality,Type,Truck,Driver,Slinger 1,Slinger 2,Status'];
    for (const [weekKey, weekAssignments] of Object.entries(scheduleAssignments)) {
      for (const a of weekAssignments) {
        const route = routes.find((r) => r.id === a.routeId);
        const truck = trucks.find((t) => t.id === a.truckId);
        const driver = employees.find((e) => e.id === a.driverId);
        const s1 = a.slingerIds[0] ? employees.find((e) => e.id === a.slingerIds[0]) : null;
        const s2 = a.slingerIds[1] ? employees.find((e) => e.id === a.slingerIds[1]) : null;
        rows.push([
          weekKey,
          route?.day ?? '',
          route?.name ?? '',
          route?.municipality ?? '',
          route?.type ?? '',
          truck ? `#${truck.number}` : '',
          driver?.name ?? '',
          s1?.name ?? '',
          s2?.name ?? '',
          a.status,
        ].map((v) => `"${v}"`).join(','));
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aw-schedule-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Schedule exported as CSV');
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

      {/* Company Info */}
      <Card className="rounded-xl shadow-sm ring-1 ring-gray-200/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px] font-semibold">Company</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-gray-500">Company Name</Label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Dispatch Template */}
      <Card className="rounded-xl shadow-sm ring-1 ring-gray-200/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px] font-semibold">Dispatch Message Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {['{name}', '{day}', '{truckNumber}', '{truckType}', '{routeName}', '{driverName}', '{slingers}'].map((token) => (
              <Badge key={token} variant="outline" className="text-[11px] cursor-pointer hover:bg-gray-100 transition-colors rounded-lg px-2 py-0.5"
                onClick={() => setLocalTemplate((t) => t + token)}>
                {token}
              </Badge>
            ))}
          </div>
          <Textarea
            rows={4}
            value={localTemplate}
            onChange={(e) => setLocalTemplate(e.target.value)}
            className="text-sm"
          />
          <div>
            <Label className="text-xs text-gray-500">Preview</Label>
            <div className="bg-gray-50 rounded-xl p-4 text-[13px] whitespace-pre-wrap mt-1">
              {previewMessage}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveTemplate}>Save Template</Button>
            <Button variant="outline" size="sm" onClick={resetTemplate}>
              <RotateCcw size={14} className="mr-1" /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="rounded-xl shadow-sm ring-1 ring-gray-200/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px] font-semibold">Data Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button variant="outline" size="sm" onClick={exportAllData}>
              <Download size={14} className="mr-1.5" /> Full Backup
            </Button>
            <Button variant="outline" size="sm" onClick={importAllData}>
              <Upload size={14} className="mr-1.5" /> Import Backup
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download size={14} className="mr-1.5" /> Export CSV
            </Button>
          </div>
          <p className="text-[12px] text-gray-400">
            Backup includes all employees, trucks, routes, weekly schedules, and settings.
          </p>
        </CardContent>
      </Card>

      {/* Data Stats */}
      <Card className="rounded-xl shadow-sm ring-1 ring-gray-200/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px] font-semibold">Current Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="bg-gray-50 rounded-xl py-3">
              <p className="text-2xl font-semibold tabular-nums">{employees.length}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Employees</p>
            </div>
            <div className="bg-gray-50 rounded-xl py-3">
              <p className="text-2xl font-semibold tabular-nums">{trucks.length}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Trucks</p>
            </div>
            <div className="bg-gray-50 rounded-xl py-3">
              <p className="text-2xl font-semibold tabular-nums">{routes.length}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Routes</p>
            </div>
            <div className="bg-gray-50 rounded-xl py-3">
              <p className="text-2xl font-semibold tabular-nums">{Object.keys(scheduleAssignments).length}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Weeks</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
