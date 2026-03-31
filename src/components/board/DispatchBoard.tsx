import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { useTruckStore } from '@/stores/truckStore';
import { useUndoStore } from '@/stores/undoStore';
import { DAYS } from '@/types';
import { getISOWeekKey, getWeekDateRange, navigateWeek, getWeekDays, formatDate, getWeekPhase } from '@/lib/weekUtils';
import { detectConflicts } from '@/lib/conflicts';
import { autoAssign } from '@/lib/autoAssign';
import DayColumn from './DayColumn';
import EmployeePool from './EmployeePool';
import ConflictBanner from './ConflictBanner';
import AutoAssignModal from './AutoAssignModal';
import { ChevronLeft, ChevronRight, Copy, Upload, Undo2, Redo2, Wand2, MoreHorizontal, Users, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import WeekUploadModal from './WeekUploadModal';
import ActivityLog from './ActivityLog';

export default function DispatchBoard() {
  const [currentWeek, setCurrentWeek] = useState(() => getISOWeekKey(new Date()));
  const [activeEmployeeId, setActiveEmployeeId] = useState<string | null>(null);
  const [poolOpen, setPoolOpen] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [autoAssignOpen, setAutoAssignOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [mobileDay, setMobileDay] = useState<typeof DAYS[number]>(() => {
    const today = new Date().getDay();
    // 0=Sun,1=Mon,...6=Sat → map to DAYS index
    return DAYS[Math.max(0, Math.min(today - 1, 5))] ?? 'Monday';
  });
  const moreRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<HTMLDivElement>(null);

  const allAssignments = useScheduleStore((s) => s.assignments);
  const allSpares = useScheduleStore((s) => s.spareSlots);
  const allVacations = useScheduleStore((s) => s.vacationSlots);
  const initWeekFromRoutes = useScheduleStore((s) => s.initWeekFromRoutes);
  const updateAssignment = useScheduleStore((s) => s.updateAssignment);
  const setWeekAssignments = useScheduleStore((s) => s.setWeekAssignments);
  const copyWeek = useScheduleStore((s) => s.copyWeek);
  const addToSpare = useScheduleStore((s) => s.addToSpare);
  const removeFromSpare = useScheduleStore((s) => s.removeFromSpare);
  const addToVacation = useScheduleStore((s) => s.addToVacation);
  const removeFromVacation = useScheduleStore((s) => s.removeFromVacation);
  const routes = useRouteStore((s) => s.routes);
  const employees = useEmployeeStore((s) => s.employees);
  const trucks = useTruckStore((s) => s.trucks);
  const { pushSnapshot, undo, redo, canUndo, canRedo } = useUndoStore();
  const assignments = useMemo(() => allAssignments[currentWeek] ?? [], [allAssignments, currentWeek]);
  const spareSlots = useMemo(() => allSpares[currentWeek] ?? [], [allSpares, currentWeek]);
  const vacationSlots = useMemo(() => allVacations[currentWeek] ?? [], [allVacations, currentWeek]);
  const weekDays = useMemo(() => getWeekDays(currentWeek), [currentWeek]);
  const weekPhase = useMemo(() => getWeekPhase(currentWeek), [currentWeek]);

  // Close popover menus on outside click
  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moreOpen]);

  useEffect(() => {
    if (!activityOpen) return;
    const handler = (e: MouseEvent) => {
      if (activityRef.current && !activityRef.current.contains(e.target as Node)) setActivityOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activityOpen]);

  // Init week from routes if empty — store handles DB lookup for auto-copy
  useEffect(() => {
    let cancelled = false;
    if (assignments.length === 0 && routes.length > 0) {
      const activeRouteIds = routes
        .filter((r) => {
          if (!r.active) return false;
          if (r.day === 'Saturday') return false;
          if (r.biweekly && r.biweeklyPhase !== weekPhase) return false;
          return true;
        })
        .map((r) => r.id);
      if (!cancelled) {
        initWeekFromRoutes(currentWeek, activeRouteIds);
      }
    }
    return () => { cancelled = true; };
  }, [currentWeek, assignments.length, routes, initWeekFromRoutes, weekPhase]);

  // Conflict detection
  const conflicts = useMemo(
    () => detectConflicts(assignments, routes, employees, trucks),
    [assignments, routes, employees, trucks]
  );

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.active),
    [employees]
  );

  const saveSnapshot = useCallback((label: string) => {
    pushSnapshot({
      weekKey: currentWeek,
      assignments: JSON.parse(JSON.stringify(assignments)),
      spareSlots: JSON.parse(JSON.stringify(spareSlots)),
      vacationSlots: JSON.parse(JSON.stringify(vacationSlots)),
      label,
      timestamp: Date.now(),
    });
  }, [currentWeek, assignments, spareSlots, vacationSlots, pushSnapshot]);

  const handleUndo = useCallback(() => {
    const snapshot = undo();
    if (!snapshot) return;
    setWeekAssignments(snapshot.weekKey, snapshot.assignments);
    for (const a of snapshot.assignments) {
      useScheduleStore.getState().updateAssignment(snapshot.weekKey, a.id, a);
    }
    toast.success(`Undo: ${snapshot.label}`);
  }, [undo, setWeekAssignments]);

  const handleRedo = useCallback(() => {
    const snapshot = redo();
    if (!snapshot) return;
    setWeekAssignments(snapshot.weekKey, snapshot.assignments);
    for (const a of snapshot.assignments) {
      useScheduleStore.getState().updateAssignment(snapshot.weekKey, a.id, a);
    }
    toast.success(`Redo: ${snapshot.label}`);
  }, [redo, setWeekAssignments]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (isMeta && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'ArrowLeft' && !isMeta && !e.shiftKey && document.activeElement === document.body) {
        setCurrentWeek(navigateWeek(currentWeek, -1));
      } else if (e.key === 'ArrowRight' && !isMeta && !e.shiftKey && document.activeElement === document.body) {
        setCurrentWeek(navigateWeek(currentWeek, 1));
      } else if (isMeta && e.key === 't') {
        e.preventDefault();
        setCurrentWeek(getISOWeekKey(new Date()));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo, currentWeek]);

  const handleAutoAssignPreview = useCallback(async () => {
    const store = useScheduleStore.getState();
    const prevWeekKey = navigateWeek(currentWeek, -1);
    await store.fetchWeek(prevWeekKey);
    const samePhaseWeekKey = navigateWeek(currentWeek, -2);
    await store.fetchWeek(samePhaseWeekKey);
    const freshState = useScheduleStore.getState();
    const prevWeekAssignments = freshState.assignments[prevWeekKey] ?? [];
    const prevSamePhaseAssignments = freshState.assignments[samePhaseWeekKey] ?? [];

    return autoAssign({
      weekKey: currentWeek,
      weekPhase,
      assignments,
      routes,
      employees,
      trucks,
      vacationSlots,
      spareSlots,
      prevSamePhaseAssignments,
      prevWeekAssignments,
    });
  }, [currentWeek, weekPhase, assignments, routes, employees, trucks, vacationSlots, spareSlots]);

  const handleAutoAssignConfirm = useCallback((result: ReturnType<typeof autoAssign>) => {
    saveSnapshot('Auto-assign');
    for (const a of result.assignments) {
      const existing = assignments.find((e) => e.id === a.id);
      if (!existing) continue;
      if (
        a.driverId !== existing.driverId ||
        a.truckId !== existing.truckId ||
        JSON.stringify(a.slingerIds) !== JSON.stringify(existing.slingerIds) ||
        a.status !== existing.status
      ) {
        updateAssignment(currentWeek, a.id, {
          driverId: a.driverId,
          truckId: a.truckId,
          slingerIds: a.slingerIds,
        });
      }
    }
    toast.success(`Applied ${result.changes.length} auto-assignments`);
  }, [assignments, currentWeek, updateAssignment, saveSnapshot]);

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
    saveSnapshot('Drag assignment');

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
    const targetDay = dropData.day;

    const sourceData = active.data.current as { employeeId?: string; assignmentId?: string; type?: string } | undefined;
    const isFromPool = !sourceData?.type;

    let sourceDay: string | undefined;
    if (sourceData?.type === 'assigned' && sourceData.assignmentId) {
      const srcAssignment = assignments.find((a) => a.id === sourceData.assignmentId);
      if (srcAssignment) {
        const srcRoute = routes.find((r) => r.id === srcAssignment.routeId);
        sourceDay = srcRoute?.day;
      }
    } else if (sourceData?.type === 'spare') {
      const parts = (active.id as string).split('-');
      sourceDay = parts[1];
    }

    if (!isFromPool) {
      const dayToRemoveFrom = sourceDay || targetDay;
      for (const a of assignments) {
        const aRoute = routes.find((r) => r.id === a.routeId);
        if (aRoute?.day !== dayToRemoveFrom) continue;
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
        if (s.day === dayToRemoveFrom && s.employeeIds.includes(employeeId)) {
          removeFromSpare(currentWeek, s.day, employeeId);
        }
      }
      for (const v of vacationSlots) {
        if (v.day === dayToRemoveFrom && v.employeeIds.includes(employeeId)) {
          removeFromVacation(currentWeek, v.day, employeeId);
        }
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
      if (employee.role !== 'driver' && !employee.canDrive) {
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
    setMoreOpen(false);
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
  const readyCount = useMemo(() => assignments.filter((a) => a.status === 'ready').length, [assignments]);

  // Helpers for day tab abbreviations
  const DAY_SHORT: Record<string, string> = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat' };

  // Build day data once
  const dayData = useMemo(() => DAYS.map((day, i) => {
    const dayAssignments = assignments.filter((a) => {
      const route = routes.find((r) => r.id === a.routeId);
      return route?.day === day;
    });
    return {
      day,
      date: weekDays[i] ? formatDate(weekDays[i]) : '',
      assignments: dayAssignments,
      spare: spareSlots.find((s) => s.day === day),
      vacation: vacationSlots.find((v) => v.day === day),
      conflicts: conflicts.filter((c) => c.day === day),
      readyCount: dayAssignments.filter((a) => a.status === 'ready').length,
    };
  }), [assignments, routes, weekDays, spareSlots, vacationSlots, conflicts]);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-[calc(100vh-48px)]">
        {/* Toolbar */}
        <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200/60 px-3 md:px-4 py-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            {/* Left: nav + week info */}
            <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
              <button
                onClick={() => setCurrentWeek(navigateWeek(currentWeek, -1))}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="text-center whitespace-nowrap">
                <p className="font-semibold text-[12px] md:text-[13px] leading-tight">{getWeekDateRange(currentWeek)}</p>
                <p className="text-[9px] text-gray-400">{currentWeek}</p>
              </div>
              <button
                onClick={() => setCurrentWeek(navigateWeek(currentWeek, 1))}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
              >
                <ChevronRight size={16} />
              </button>

              {!isCurrentWeek && (
                <button
                  onClick={() => setCurrentWeek(getISOWeekKey(new Date()))}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors shrink-0 hidden sm:block"
                >
                  Today
                </button>
              )}

              <span className={`text-[10px] md:text-[11px] font-semibold px-2.5 py-0.5 rounded-full text-white shrink-0 ${weekPhase === 'even' ? 'bg-blue-500' : 'bg-emerald-500'}`}>
                {weekPhase === 'even' ? 'Potts' : 'Orwig'}<span className="hidden sm:inline">{weekPhase === 'even' ? 'ville' : 'sburg'}</span>
              </span>

              <span className="text-[11px] shrink-0 tabular-nums">
                <span className="text-green-600 font-semibold">{readyCount}</span>
                <span className="text-gray-300">/{assignments.length}</span>
              </span>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
              <button onClick={handleUndo} disabled={!canUndo()} title="Undo (Ctrl+Z)"
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-20 hidden sm:block">
                <Undo2 size={14} />
              </button>
              <button onClick={handleRedo} disabled={!canRedo()} title="Redo (Ctrl+Shift+Z)"
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-20 hidden sm:block">
                <Redo2 size={14} />
              </button>

              {/* Activity log */}
              <div className="relative hidden sm:block" ref={activityRef}>
                <button onClick={() => setActivityOpen(!activityOpen)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Recent activity">
                  <Clock size={14} className="text-gray-400" />
                </button>
                {activityOpen && (
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg ring-1 ring-gray-200/60 z-50 w-[280px] overflow-hidden">
                    <div className="px-4 py-2.5 border-b text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Activity</div>
                    <ActivityLog />
                  </div>
                )}
              </div>

              <div className="h-5 w-px bg-gray-200 mx-1 hidden sm:block" />

              <button onClick={() => setAutoAssignOpen(true)}
                className="text-[11px] md:text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center gap-1 shadow-sm">
                <Wand2 size={12} /><span className="hidden xs:inline">Auto-</span>Fill
              </button>

              {/* More menu */}
              <div className="relative" ref={moreRef}>
                <button onClick={() => setMoreOpen(!moreOpen)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <MoreHorizontal size={16} />
                </button>
                {moreOpen && (
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg ring-1 ring-gray-200/60 py-1 z-50 min-w-[180px] overflow-hidden">
                    <button onClick={() => { setUploadOpen(true); setMoreOpen(false); }} className="w-full text-left px-4 py-2.5 text-[12px] hover:bg-gray-50 flex items-center gap-2.5 transition-colors">
                      <Upload size={14} className="text-gray-400" />Upload Excel
                    </button>
                    <button onClick={handleCopyPrevWeek} className="w-full text-left px-4 py-2.5 text-[12px] hover:bg-gray-50 flex items-center gap-2.5 transition-colors">
                      <Copy size={14} className="text-gray-400" />Copy Prev Week
                    </button>
                    <Link to="/employees" onClick={() => setMoreOpen(false)} className="block px-4 py-2.5 text-[12px] hover:bg-gray-50 flex items-center gap-2.5 transition-colors">
                      <Users size={14} className="text-gray-400" />Manage Crew
                    </Link>
                  </div>
                )}
              </div>

              <button
                onClick={() => setPoolOpen(!poolOpen)}
                className={`text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors hidden md:block ${
                  poolOpen ? 'bg-gray-900 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Pool ({activeEmployees.length})
              </button>
            </div>
          </div>
        </div>

        {/* Mobile day tabs */}
        <div className="md:hidden bg-white/90 backdrop-blur-sm border-b border-gray-200/60 flex shrink-0 px-2 gap-1 py-1.5">
          {dayData.map((d) => {
            const isActive = d.day === mobileDay;
            const allReady = d.readyCount === d.assignments.length && d.assignments.length > 0;
            return (
              <button
                key={d.day}
                onClick={() => setMobileDay(d.day)}
                className={`flex-1 min-w-0 py-1.5 px-1 text-center transition-all duration-200 rounded-lg relative
                  ${isActive ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`}
              >
                <span className="text-[11px] font-medium block">{DAY_SHORT[d.day]}</span>
                <span className="text-[9px] block tabular-nums">
                  {allReady ? '✓' : `${d.readyCount}/${d.assignments.length}`}
                </span>
                {d.conflicts.length > 0 && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-red-500" />}
              </button>
            );
          })}
        </div>

        {/* Conflict Banner */}
        <ConflictBanner conflicts={conflicts} />

        {/* Board — desktop: multi-column, mobile: single day */}
        <div className="flex-1 flex overflow-hidden">
          {/* Desktop columns */}
          <div className="flex-1 hidden md:flex overflow-x-auto">
            {dayData.map((d) => (
              <DayColumn
                key={d.day}
                day={d.day}
                date={d.date}
                assignments={d.assignments}
                weekKey={currentWeek}
                spareSlot={d.spare}
                vacationSlot={d.vacation}
                conflicts={d.conflicts}
              />
            ))}
          </div>

          {/* Mobile single day */}
          <div className="flex-1 md:hidden overflow-y-auto">
            {dayData.filter((d) => d.day === mobileDay).map((d) => (
              <DayColumn
                key={d.day}
                day={d.day}
                date={d.date}
                assignments={d.assignments}
                weekKey={currentWeek}
                spareSlot={d.spare}
                vacationSlot={d.vacation}
                conflicts={d.conflicts}
              />
            ))}
          </div>

          {poolOpen && (
            <div className="hidden md:block">
              <EmployeePool employees={activeEmployees} />
            </div>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeEmployee && (
          <div className="px-3.5 py-2 bg-white rounded-xl shadow-xl ring-1 ring-gray-200 text-[13px] font-semibold cursor-grabbing">
            {activeEmployee.name}
            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">{activeEmployee.role}</span>
          </div>
        )}
      </DragOverlay>

      <WeekUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSynced={(weekKey) => setCurrentWeek(weekKey)}
      />

      <AutoAssignModal
        open={autoAssignOpen}
        onClose={() => setAutoAssignOpen(false)}
        onPreview={handleAutoAssignPreview}
        onConfirm={handleAutoAssignConfirm}
      />
    </DndContext>
  );
}
