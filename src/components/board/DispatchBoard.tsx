import { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useRouteStore } from '@/stores/routeStore';
import { useEmployeeStore } from '@/stores/employeeStore';
import { DAYS } from '@/types';
import { getISOWeekKey, getWeekDateRange, navigateWeek, getWeekDays, formatDate, getWeekPhase } from '@/lib/weekUtils';
import DayColumn from './DayColumn';
import EmployeePool from './EmployeePool';
import { ChevronLeft, ChevronRight, Copy, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function DispatchBoard() {
  const [currentWeek, setCurrentWeek] = useState(() => getISOWeekKey(new Date()));
  const [activeEmployeeId, setActiveEmployeeId] = useState<string | null>(null);
  const [poolOpen, setPoolOpen] = useState(true);

  const allAssignments = useScheduleStore((s) => s.assignments);
  const allSpares = useScheduleStore((s) => s.spareSlots);
  const allVacations = useScheduleStore((s) => s.vacationSlots);
  const initWeekFromRoutes = useScheduleStore((s) => s.initWeekFromRoutes);
  const updateAssignment = useScheduleStore((s) => s.updateAssignment);
  const copyWeek = useScheduleStore((s) => s.copyWeek);
  const addToSpare = useScheduleStore((s) => s.addToSpare);
  const removeFromSpare = useScheduleStore((s) => s.removeFromSpare);
  const addToVacation = useScheduleStore((s) => s.addToVacation);
  const removeFromVacation = useScheduleStore((s) => s.removeFromVacation);
  const routes = useRouteStore((s) => s.routes);
  const employees = useEmployeeStore((s) => s.employees);
  const assignments = useMemo(() => allAssignments[currentWeek] ?? [], [allAssignments, currentWeek]);
  const spareSlots = useMemo(() => allSpares[currentWeek] ?? [], [allSpares, currentWeek]);
  const vacationSlots = useMemo(() => allVacations[currentWeek] ?? [], [allVacations, currentWeek]);
  const weekDays = useMemo(() => getWeekDays(currentWeek), [currentWeek]);
  const weekPhase = useMemo(() => getWeekPhase(currentWeek), [currentWeek]);

  // Init week from routes if empty — store handles DB lookup for auto-copy
  useEffect(() => {
    if (assignments.length === 0 && routes.length > 0) {
      const activeRouteIds = routes
        .filter((r) => {
          if (!r.active) return false;
          if (r.day === 'Saturday') return false; // Saturday is manual only
          if (r.biweekly && r.biweeklyPhase !== weekPhase) return false;
          return true;
        })
        .map((r) => r.id);
      initWeekFromRoutes(currentWeek, activeRouteIds);
    }
  }, [currentWeek, assignments.length, routes, initWeekFromRoutes, weekPhase]);

  // Find assigned employees across all assignments + spares + vacations this week
  const assignedEmployeeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of assignments) {
      if (a.driverId) ids.add(a.driverId);
      for (const sid of a.slingerIds) ids.add(sid);
    }
    for (const s of spareSlots) {
      for (const eid of s.employeeIds) ids.add(eid);
    }
    for (const v of vacationSlots) {
      for (const eid of v.employeeIds) ids.add(eid);
    }
    return ids;
  }, [assignments, spareSlots, vacationSlots]);

  const unassignedEmployees = useMemo(
    () => employees.filter((e) => e.active && !assignedEmployeeIds.has(e.id)),
    [employees, assignedEmployeeIds]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveEmployeeId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveEmployeeId(null);
    const { active, over } = event;
    if (!over) return;

    const employeeId = active.id as string;
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return;

    const dropData = over.data.current as {
      assignmentId?: string;
      slot: 'driver' | 'slinger' | 'spare' | 'vacation';
      day?: string;
    } | undefined;
    if (!dropData) return;

    const { assignmentId, slot } = dropData;

    // Remove from any current assignment, spare, or vacation first
    for (const a of assignments) {
      if (a.driverId === employeeId) {
        updateAssignment(currentWeek, a.id, { driverId: null });
      }
      if (a.slingerIds.includes(employeeId)) {
        updateAssignment(currentWeek, a.id, {
          slingerIds: a.slingerIds.filter((id) => id !== employeeId),
        });
      }
    }
    for (const s of spareSlots) {
      if (s.employeeIds.includes(employeeId)) {
        removeFromSpare(currentWeek, s.day, employeeId);
      }
    }
    for (const v of vacationSlots) {
      if (v.employeeIds.includes(employeeId)) {
        removeFromVacation(currentWeek, v.day, employeeId);
      }
    }

    if (slot === 'vacation' && dropData.day) {
      addToVacation(currentWeek, dropData.day as typeof DAYS[number], employeeId);
      return;
    }

    if (slot === 'spare' && dropData.day) {
      addToSpare(currentWeek, dropData.day as typeof DAYS[number], employeeId);
      return;
    }

    if (!assignmentId) return;

    if (slot === 'driver') {
      if (employee.role !== 'driver') {
        toast.error(`${employee.name} is a slinger, not a driver`);
        return;
      }
      updateAssignment(currentWeek, assignmentId, { driverId: employeeId });
    } else if (slot === 'slinger') {
      const assignment = assignments.find((a) => a.id === assignmentId);
      if (!assignment) return;
      if (assignment.slingerIds.length >= 2) {
        toast.error('Max 2 slingers per route');
        return;
      }
      if (assignment.slingerIds.includes(employeeId)) return;
      updateAssignment(currentWeek, assignmentId, {
        slingerIds: [...assignment.slingerIds, employeeId],
      });
    }
  };

  const handleCopyPrevWeek = async () => {
    const prevWeek = navigateWeek(currentWeek, -1);
    await useScheduleStore.getState().fetchWeek(prevWeek);
    const prevAssignments = useScheduleStore.getState().getWeekAssignments(prevWeek);
    if (prevAssignments.length === 0) {
      toast.error('No assignments in previous week to copy');
      return;
    }
    const hasCrew = prevAssignments.some((a) => a.driverId || a.slingerIds.length > 0);
    if (!hasCrew) {
      toast.error('Previous week has no crew assigned to copy');
      return;
    }
    copyWeek(prevWeek, currentWeek);
    toast.success('Copied previous week schedule');
  };

  const activeEmployee = activeEmployeeId
    ? employees.find((e) => e.id === activeEmployeeId)
    : null;

  const isCurrentWeek = currentWeek === getISOWeekKey(new Date());

  // Count vacation employees this week
  const vacationCount = useMemo(() => {
    const ids = new Set<string>();
    for (const v of vacationSlots) {
      for (const eid of v.employeeIds) ids.add(eid);
    }
    return ids.size;
  }, [vacationSlots]);

  const readyCount = useMemo(() => assignments.filter((a) => a.status === 'ready').length, [assignments]);
  const incompleteCount = useMemo(() => assignments.filter((a) => a.status === 'incomplete').length, [assignments]);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-[calc(100vh-48px)]">
        {/* Week Navigation Bar */}
        <div className="bg-white border-b px-3 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {/* Nav arrows + week info */}
            <button
              onClick={() => setCurrentWeek(navigateWeek(currentWeek, -1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="text-center whitespace-nowrap">
              <p className="font-bold text-[13px] leading-tight">{getWeekDateRange(currentWeek)}</p>
              <p className="text-[9px] text-gray-400 font-mono">{currentWeek}</p>
            </div>
            <button
              onClick={() => setCurrentWeek(navigateWeek(currentWeek, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronRight size={16} />
            </button>

            {!isCurrentWeek && (
              <button
                onClick={() => setCurrentWeek(getISOWeekKey(new Date()))}
                className="text-[10px] font-bold px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Today
              </button>
            )}

            <div className="h-5 w-px bg-gray-200 mx-1" />

            {/* Phase badge */}
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full text-white ${weekPhase === 'even' ? 'bg-blue-500' : 'bg-emerald-500'}`}>
              {weekPhase === 'even' ? 'Pottsville Recycling' : 'Orwigsburg Recycling'}
            </span>

            {/* Stats inline */}
            <span className="text-[11px] font-mono text-green-600 font-bold">{readyCount}<span className="text-gray-300 font-normal">/{assignments.length}</span></span>
            {vacationCount > 0 && <span className="text-[11px] font-mono text-red-400">{vacationCount} off</span>}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyPrevWeek}
              className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-1"
            >
              <Copy size={11} />Copy
            </button>

            <Link to="/employees">
              <button className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-1">
                <Users size={11} />Crew
              </button>
            </Link>

            <button
              onClick={() => setPoolOpen(!poolOpen)}
              className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
                poolOpen ? 'bg-gray-900 text-white' : 'border border-gray-200 hover:bg-gray-50'
              }`}
            >
              Pool ({unassignedEmployees.length})
            </button>
          </div>
        </div>

        {/* Board */}
        <div className="flex-1 flex overflow-hidden">
          {/* Day Columns */}
          <div className="flex-1 flex overflow-x-auto">
            {DAYS.map((day, i) => {
              const dayAssignments = assignments.filter((a) => {
                const route = routes.find((r) => r.id === a.routeId);
                return route?.day === day;
              });
              const daySpare = spareSlots.find((s) => s.day === day);
              const dayVacation = vacationSlots.find((v) => v.day === day);
              return (
                <DayColumn
                  key={day}
                  day={day}
                  date={weekDays[i] ? formatDate(weekDays[i]) : ''}
                  assignments={dayAssignments}
                  weekKey={currentWeek}
                  spareSlot={daySpare}
                  vacationSlot={dayVacation}
                />
              );
            })}
          </div>

          {/* Employee Pool Sidebar */}
          {poolOpen && (
            <EmployeePool employees={unassignedEmployees} />
          )}
        </div>
      </div>

      <DragOverlay>
        {activeEmployee && (
          <div className="px-3 py-1.5 bg-[#F5C400] text-[#1A1A1A] rounded shadow-lg font-mono text-sm font-semibold cursor-grabbing">
            {activeEmployee.name}
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-white/30 font-bold">{activeEmployee.role}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
