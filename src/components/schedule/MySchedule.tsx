import { useState, useMemo, useEffect } from 'react';
import { useEmployeeStore } from '@/stores/employeeStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useRouteStore } from '@/stores/routeStore';
import { useTruckStore } from '@/stores/truckStore';
import { getISOWeekKey, getWeekDateRange, navigateWeek, getWeekDays, formatDate, getWeekPhase } from '@/lib/weekUtils';
import { DAYS } from '@/types';
import { ChevronLeft, ChevronRight, Truck, MapPin, Users, UserCheck } from 'lucide-react';

const STORAGE_KEY = 'aw-dispatch-my-employee';

export default function MySchedule() {
  const [selectedId, setSelectedId] = useState<string>(() => localStorage.getItem(STORAGE_KEY) || '');
  const [currentWeek, setCurrentWeek] = useState(() => getISOWeekKey(new Date()));

  const employees = useEmployeeStore((s) => s.employees);
  const allAssignments = useScheduleStore((s) => s.assignments);
  const allVacations = useScheduleStore((s) => s.vacationSlots);
  const fetchWeek = useScheduleStore((s) => s.fetchWeek);
  const routes = useRouteStore((s) => s.routes);
  const trucks = useTruckStore((s) => s.trucks);

  const activeEmployees = useMemo(() => employees.filter((e) => e.active).sort((a, b) => a.name.localeCompare(b.name)), [employees]);
  const assignments = useMemo(() => allAssignments[currentWeek] ?? [], [allAssignments, currentWeek]);
  const vacations = useMemo(() => allVacations[currentWeek] ?? [], [allVacations, currentWeek]);
  const weekDays = useMemo(() => getWeekDays(currentWeek), [currentWeek]);
  const weekPhase = useMemo(() => getWeekPhase(currentWeek), [currentWeek]);

  // Fetch week data
  useEffect(() => {
    fetchWeek(currentWeek);
  }, [currentWeek, fetchWeek]);

  // Save selection
  useEffect(() => {
    if (selectedId) localStorage.setItem(STORAGE_KEY, selectedId);
  }, [selectedId]);

  const selectedEmployee = useMemo(() => employees.find((e) => e.id === selectedId), [employees, selectedId]);

  // Find this employee's assignments for the week
  const myWeek = useMemo(() => {
    if (!selectedId) return [];
    return DAYS.filter(d => d !== 'Saturday').map((day, i) => {
      const date = weekDays[i] ? formatDate(weekDays[i]) : '';

      // Check vacation
      const vac = vacations.find((v) => v.day === day);
      if (vac?.employeeIds.includes(selectedId)) {
        return { day, date, type: 'off' as const, route: null, truck: null, role: null, coworkers: [] };
      }

      // Find assignment where this employee is driver or slinger
      const match = assignments.find((a) => {
        const route = routes.find((r) => r.id === a.routeId);
        if (route?.day !== day) return false;
        return a.driverId === selectedId || a.slingerIds.includes(selectedId);
      });

      if (!match) {
        return { day, date, type: 'unassigned' as const, route: null, truck: null, role: null, coworkers: [] };
      }

      const route = routes.find((r) => r.id === match.routeId);
      const truck = match.truckId ? trucks.find((t) => t.id === match.truckId) : null;
      const role = match.driverId === selectedId ? 'Driver' : 'Slinger';

      // Coworkers
      const coworkers: string[] = [];
      if (match.driverId && match.driverId !== selectedId) {
        const d = employees.find((e) => e.id === match.driverId);
        if (d) coworkers.push(`${d.name} (driver)`);
      }
      for (const sid of match.slingerIds) {
        if (sid === selectedId) continue;
        const s = employees.find((e) => e.id === sid);
        if (s) coworkers.push(s.name);
      }

      return { day, date, type: 'assigned' as const, route, truck, role, coworkers };
    });
  }, [selectedId, assignments, vacations, routes, trucks, employees, weekDays]);

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-lg font-bold">My Schedule</h1>
        <p className="text-xs text-gray-400">Select your name to see your assignments</p>
      </div>

      {/* Employee picker */}
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm font-medium bg-white focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400 outline-none mb-4"
      >
        <option value="">Choose your name...</option>
        {activeEmployees.map((e) => (
          <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
        ))}
      </select>

      {/* Week nav */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <button onClick={() => setCurrentWeek(navigateWeek(currentWeek, -1))} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold">{getWeekDateRange(currentWeek)}</p>
          <div className="flex items-center justify-center gap-2 mt-0.5">
            <span className="text-[9px] text-gray-400 font-mono">{currentWeek}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white ${weekPhase === 'even' ? 'bg-blue-500' : 'bg-emerald-500'}`}>
              {weekPhase === 'even' ? 'Pottsville' : 'Orwigsburg'}
            </span>
          </div>
        </div>
        <button onClick={() => setCurrentWeek(navigateWeek(currentWeek, 1))} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Schedule cards */}
      {selectedId && (
        <div className="space-y-2">
          {myWeek.map((entry) => (
            <div
              key={entry.day}
              className={`rounded-lg border p-3 ${
                entry.type === 'assigned'
                  ? 'border-green-200 bg-green-50/50'
                  : entry.type === 'off'
                  ? 'border-red-200 bg-red-50/50'
                  : 'border-gray-200 bg-gray-50/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm">{entry.day}</span>
                <span className="text-[10px] text-gray-400 font-mono">{entry.date}</span>
              </div>

              {entry.type === 'off' && (
                <span className="text-xs font-medium text-red-500">Off / Vacation</span>
              )}

              {entry.type === 'unassigned' && (
                <span className="text-xs text-gray-400">Not assigned</span>
              )}

              {entry.type === 'assigned' && entry.route && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <MapPin size={12} className="text-gray-400 shrink-0" />
                    <span className="text-sm font-medium">{entry.route.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold text-white ml-auto ${
                      entry.role === 'Driver' ? 'bg-blue-500' : 'bg-slate-500'
                    }`}>
                      {entry.role}
                    </span>
                  </div>

                  {entry.truck && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Truck size={12} className="shrink-0" />
                      <span>Truck #{entry.truck.number} ({entry.truck.type})</span>
                    </div>
                  )}

                  {entry.coworkers.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Users size={12} className="shrink-0" />
                      <span>{entry.coworkers.join(', ')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!selectedId && (
        <div className="text-center py-12 text-gray-300">
          <UserCheck size={40} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Pick your name above</p>
        </div>
      )}
    </div>
  );
}
