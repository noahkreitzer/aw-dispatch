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

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-[calc(100vh-48px)]">
        {/* Toolbar */}
        <div className="bg-white border-b px-3 py-1.5 flex items-center justify-between shrink-0">
          {/* Left: nav + week info */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentWeek(navigateWeek(currentWeek, -1))}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <div className="text-center whitespace-nowrap min-w-[140px]">
              <p className="font-bold text-[12px] leading-tight">{getWeekDateRange(currentWeek)}</p>
              <p className="text-[8px] text-gray-400 font-mono">{currentWeek}</p>
            </div>
            <button
              onClick={() => setCurrentWeek(navigateWeek(currentWeek, 1))}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
            >
              <ChevronRight size={15} />
            </button>

            {!isCurrentWeek && (
              <button
                onClick={() => setCurrentWeek(getISOWeekKey(new Date()))}
                className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Today
              </button>
            )}

            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${weekPhase === 'even' ? 'bg-blue-500' : 'bg-emerald-500'}`}>
              {weekPhase === 'even' ? 'Pottsville' : 'Orwigsburg'}
            </span>

            <span className="text-[10px] font-mono">
              <span className="text-green-600 font-bold">{readyCount}</span>
              <span className="text-gray-300">/{assignments.length}</span>
            </span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1">
            <button onClick={handleUndo} disabled={!canUndo()} title="Undo (Ctrl+Z)"
              className="p-1 rounded hover:bg-gray-100 transition-colors disabled:opacity-20">
              <Undo2 size={13} />
            </button>
            <button onClick={handleRedo} disabled={!canRedo()} title="Redo (Ctrl+Shift+Z)"
              className="p-1 rounded hover:bg-gray-100 transition-colors disabled:opacity-20">
              <Redo2 size={13} />
            </button>

            {/* Activity log */}
            <div className="relative" ref={activityRef}>
              <button onClick={() => setActivityOpen(!activityOpen)}
                className="p-1 rounded hover:bg-gray-100 transition-colors" title="Recent activity">
                <Clock size={13} className="text-gray-400" />
              </button>
              {activityOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-50 w-[260px]">
                  <div className="px-3 py-1.5 border-b text-[10px] font-bold text-gray-500 uppercase tracking-wider">Activity</div>
                  <ActivityLog />
                </div>
              )}
            </div>

            <div className="h-4 w-px bg-gray-200 mx-0.5" />

            <button onClick={() => setAutoAssignOpen(true)}
              className="text-[10px] font-bold px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1">
              <Wand2 size={10} />Auto-Fill
            </button>

            <button onClick={() => setUploadOpen(true)}
              className="text-[10px] font-medium px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-1">
              <Upload size={10} />Upload
            </button>

            {/* More menu */}
            <div className="relative" ref={moreRef}>
              <button onClick={() => setMoreOpen(!moreOpen)}
                className="p-1 rounded hover:bg-gray-100 transition-colors">
                <MoreHorizontal size={14} />
              </button>
              {moreOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 z-50 min-w-[140px]">
                  <button onClick={handleCopyPrevWeek} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-gray-50 flex items-center gap-2">
                    <Copy size={11} />Copy Prev Week
                  </button>
                  <Link to="/employees" onClick={() => setMoreOpen(false)} className="block px-3 py-1.5 text-[11px] hover:bg-gray-50 flex items-center gap-2">
                    <Users size={11} />Manage Crew
                  </Link>
                </div>
              )}
            </div>

            <button
              onClick={() => setPoolOpen(!poolOpen)}
              className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${
                poolOpen ? 'bg-gray-900 text-white' : 'border border-gray-200 hover:bg-gray-50'
              }`}
            >
              Pool ({activeEmployees.length})
            </button>
          </div>
        </div>

        {/* Conflict Banner */}
        <ConflictBanner conflicts={conflicts} />

        {/* Board */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex overflow-x-auto">
            {DAYS.map((day, i) => {
              const dayAssignments = assignments.filter((a) => {
                const route = routes.find((r) => r.id === a.routeId);
                return route?.day === day;
              });
              const daySpare = spareSlots.find((s) => s.day === day);
              const dayVacation = vacationSlots.find((v) => v.day === day);
              const dayConflicts = conflicts.filter((c) => c.day === day);
              return (
                <DayColumn
                  key={day}
                  day={day}
                  date={weekDays[i] ? formatDate(weekDays[i]) : ''}
                  assignments={dayAssignments}
                  weekKey={currentWeek}
                  spareSlot={daySpare}
                  vacationSlot={dayVacation}
                  conflicts={dayConflicts}
                />
              );
            })}
          </div>

          {poolOpen && (
            <EmployeePool employees={activeEmployees} />
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
