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

  useEffect(() => {
    fetchWeek(currentWeek);
  }, [currentWeek, fetchWeek]);

  useEffect(() => {
    if (selectedId) localStorage.setItem(STORAGE_KEY, selectedId);
  }, [selectedId]);

  const myWeek = useMemo(() => {
    if (!selectedId) return [];
    return DAYS.filter(d => d !== 'Saturday').map((day, i) => {
      const date = weekDays[i] ? formatDate(weekDays[i]) : '';

      const vac = vacations.find((v) => v.day === day);
      if (vac?.employeeIds.includes(selectedId)) {
        return { day, date, type: 'off' as const, route: null, truck: null, role: null, coworkers: [] };
      }

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
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <div className="text-center mb-5">
        <h1 className="text-xl font-semibold tracking-tight">My Schedule</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">Select your name to see your week</p>
      </div>

      {/* Employee picker */}
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-white text-[14px] font-medium shadow-sm ring-1 ring-gray-200/60 focus:ring-2 focus:ring-blue-300 outline-none mb-5 appearance-none"
      >
        <option value="">Choose your name...</option>
        {activeEmployees.map((e) => (
          <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
        ))}
      </select>

      {/* Week nav */}
      <div className="flex items-center justify-center gap-4 mb-5">
        <button onClick={() => setCurrentWeek(navigateWeek(currentWeek, -1))} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-[14px] font-semibold">{getWeekDateRange(currentWeek)}</p>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-[10px] text-gray-400">{currentWeek}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full text-white ${weekPhase === 'even' ? 'bg-blue-500' : 'bg-emerald-500'}`}>
              {weekPhase === 'even' ? 'Pottsville' : 'Orwigsburg'}
            </span>
          </div>
        </div>
        <button onClick={() => setCurrentWeek(navigateWeek(currentWeek, 1))} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Schedule cards */}
      {selectedId && (
        <div className="space-y-2.5">
          {myWeek.map((entry) => (
            <div
              key={entry.day}
              className={`rounded-xl p-4 shadow-sm transition-colors ${
                entry.type === 'assigned'
                  ? 'bg-white ring-1 ring-green-200'
                  : entry.type === 'off'
                  ? 'bg-red-50/80 ring-1 ring-red-200'
                  : 'bg-gray-50 ring-1 ring-gray-100'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-[14px]">{entry.day}</span>
                <span className="text-[11px] text-gray-400">{entry.date}</span>
              </div>

              {entry.type === 'off' && (
                <span className="text-[13px] font-medium text-red-500">Off / Vacation</span>
              )}

              {entry.type === 'unassigned' && (
                <span className="text-[13px] text-gray-400">Not assigned</span>
              )}

              {entry.type === 'assigned' && entry.route && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <MapPin size={14} className="text-gray-400 shrink-0" />
                    <span className="text-[14px] font-medium">{entry.route.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold text-white ml-auto ${
                      entry.role === 'Driver' ? 'bg-blue-500' : 'bg-gray-500'
                    }`}>
                      {entry.role}
                    </span>
                  </div>

                  {entry.truck && (
                    <div className="flex items-center gap-2.5 text-[13px] text-gray-500">
                      <Truck size={14} className="shrink-0" />
                      <span>Truck #{entry.truck.number} ({entry.truck.type})</span>
                    </div>
                  )}

                  {entry.coworkers.length > 0 && (
                    <div className="flex items-center gap-2.5 text-[13px] text-gray-500">
                      <Users size={14} className="shrink-0" />
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
        <div className="text-center py-16 text-gray-300">
          <UserCheck size={44} className="mx-auto mb-3 opacity-20" />
          <p className="text-[14px]">Pick your name above</p>
        </div>
      )}
    </div>
  );
}
