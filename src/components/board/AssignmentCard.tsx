import { useState, useMemo, memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { useRouteStore } from '@/stores/routeStore';
import { useEmployeeStore } from '@/stores/employeeStore';
import { useTruckStore } from '@/stores/truckStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import type { Assignment, DayOfWeek } from '@/types';
import { X, Power, AlertTriangle, MessageSquare, StickyNote, Check } from 'lucide-react';
import DispatchModal from './DispatchModal';
import type { Conflict } from '@/lib/conflicts';
import { isAutoFilled } from '@/lib/autoAssign';

interface AssignmentCardProps {
  assignment: Assignment;
  weekKey: string;
  day: DayOfWeek;
  conflicts?: Conflict[];
}

function DraggableEmployee({ employeeId, assignmentId, name, role }: {
  employeeId: string;
  assignmentId: string;
  name: string;
  role: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `assigned-${assignmentId}-${employeeId}`,
    data: { employeeId, assignmentId, type: 'assigned' },
  });

  return (
    <span
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`crew-chip inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium cursor-grab select-none
        ${role === 'driver' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}
        ${isDragging ? 'opacity-30' : ''}`}
    >
      {name}
    </span>
  );
}

const TYPE_COLORS: Record<string, string> = {
  residential: 'bg-blue-500',
  commercial: 'bg-purple-500',
  recycling: 'bg-emerald-500',
  'roll-off': 'bg-orange-500',
};

const TYPE_LABELS: Record<string, string> = {
  residential: 'Trash',
  commercial: 'Commercial',
  recycling: 'Recycling',
  'roll-off': 'Roll-Off',
};

export default memo(function AssignmentCard({ assignment, weekKey, day, conflicts = [] }: AssignmentCardProps) {
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  const routes = useRouteStore((s) => s.routes);
  const employees = useEmployeeStore((s) => s.employees);
  const trucks = useTruckStore((s) => s.trucks);
  const updateAssignment = useScheduleStore((s) => s.updateAssignment);

  const route = useMemo(() => routes.find((r) => r.id === assignment.routeId), [routes, assignment.routeId]);
  const activeTrucks = useMemo(() => trucks.filter((t) => t.status === 'active'), [trucks]);
  const driver = useMemo(
    () => (assignment.driverId ? employees.find((e) => e.id === assignment.driverId) : undefined),
    [employees, assignment.driverId]
  );
  const slingers = useMemo(
    () => assignment.slingerIds.map((id) => employees.find((e) => e.id === id)).filter(Boolean) as typeof employees,
    [employees, assignment.slingerIds]
  );
  const truck = useMemo(
    () => (assignment.truckId ? trucks.find((t) => t.id === assignment.truckId) : undefined),
    [trucks, assignment.truckId]
  );

  const isOff = assignment.status === 'off';
  const isReady = assignment.status === 'ready';
  const hasConflict = conflicts.length > 0;

  const userNotes = (assignment.notes || '').replace(/\[auto:.*?\]/g, '').trim();

  const { setNodeRef: driverDropRef, isOver: isDriverOver } = useDroppable({
    id: `driver-${assignment.id}`,
    data: { assignmentId: assignment.id, slot: 'driver' },
  });

  const { setNodeRef: slingerDropRef, isOver: isSlingerOver } = useDroppable({
    id: `slinger-${assignment.id}`,
    data: { assignmentId: assignment.id, slot: 'slinger' },
  });

  if (!route) return null;

  const removeSlinger = (sid: string) => {
    updateAssignment(weekKey, assignment.id, {
      slingerIds: assignment.slingerIds.filter((id) => id !== sid),
    });
  };
  const removeDriver = () => {
    updateAssignment(weekKey, assignment.id, { driverId: null });
  };
  const toggleOff = () => {
    updateAssignment(weekKey, assignment.id, {
      status: isOff ? 'incomplete' : 'off',
    });
  };
  const openNotes = () => {
    setNotesDraft(userNotes);
    setNotesOpen(true);
  };
  const saveNotes = () => {
    const autoTags = (assignment.notes || '').match(/\[auto:.*?\]/g)?.join('') ?? '';
    const newNotes = notesDraft.trim() ? `${notesDraft.trim()} ${autoTags}`.trim() : autoTags;
    updateAssignment(weekKey, assignment.id, { notes: newNotes });
    setNotesOpen(false);
  };

  if (isOff) {
    return (
      <div className="route-card rounded-xl bg-gray-50 px-3 py-2 flex items-center justify-between opacity-40">
        <span className="text-[11px] font-medium text-gray-400 line-through">{route.name}</span>
        <button onClick={toggleOff} className="p-1 rounded-lg hover:bg-gray-200 transition-colors">
          <Power size={12} className="text-red-400" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className={`route-card rounded-xl bg-white shadow-sm overflow-hidden
        ${hasConflict ? 'ring-1 ring-red-300 border-l-[3px] border-l-red-500' : isReady ? 'ring-1 ring-green-200 border-l-[3px] border-l-green-400' : 'ring-1 ring-gray-100'}`}>
        {/* Header */}
        <div className="px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${TYPE_COLORS[route.type] ?? 'bg-gray-400'}`} />
            <span className="font-semibold text-[12px] leading-tight truncate" title={`${route.name} (${TYPE_LABELS[route.type] ?? route.type})`}>{route.name}</span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {hasConflict && (
              <span title={conflicts.map(c => c.type === 'driver-double-booked' ? `${c.employeeName} drives 2` : c.type === 'truck-double-booked' ? `Truck #${c.truckNumber} on 2` : `${c.employeeName} slings 2`).join(', ')}>
                <AlertTriangle size={12} className="text-red-500" />
              </span>
            )}
            {userNotes && (
              <button onClick={openNotes} className="p-1 rounded-lg hover:bg-amber-50 transition-colors" title={userNotes}>
                <StickyNote size={12} className="text-amber-500" />
              </button>
            )}
            {isReady && (
              <button onClick={() => setDispatchOpen(true)} className="p-1 rounded-lg hover:bg-green-50 transition-colors">
                <MessageSquare size={12} className="text-green-500" />
              </button>
            )}
            <button onClick={toggleOff} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
              <Power size={11} className="text-gray-300" />
            </button>
          </div>
        </div>

        <div className="px-3 pb-2.5 space-y-1.5">
          {/* Truck select */}
          <select
            value={assignment.truckId ?? ''}
            onChange={(e) => updateAssignment(weekKey, assignment.id, { truckId: e.target.value || null })}
            className="w-full text-[11px] px-2 py-1 rounded-lg bg-gray-50 border-0 focus:ring-2 focus:ring-blue-200 outline-none appearance-none"
          >
            <option value="">Select truck...</option>
            {activeTrucks.map((t) => (
              <option key={t.id} value={t.id}>#{t.number} — {t.type}</option>
            ))}
          </select>

          {/* Driver drop zone */}
          <div
            ref={driverDropRef}
            className={`rounded-lg px-2 py-1.5 min-h-[28px] transition-all duration-150
              ${isDriverOver ? 'bg-blue-50 ring-1 ring-blue-300' : 'bg-gray-50/80'}
              ${!driver ? 'flex items-center justify-center' : ''}`}
          >
            {driver ? (
              <div className="flex items-center justify-between gap-1">
                <DraggableEmployee employeeId={driver.id} assignmentId={assignment.id} name={isAutoFilled(assignment.notes, driver.id) ? `${driver.name} *` : driver.name} role="driver" />
                <button onClick={removeDriver} className="p-1 rounded-lg hover:bg-red-50 transition-colors shrink-0">
                  <X size={11} className="text-gray-300 hover:text-red-500" />
                </button>
              </div>
            ) : (
              <span className="text-[10px] text-gray-300 font-medium">+ Driver</span>
            )}
          </div>

          {/* Slinger drop zone */}
          <div
            ref={slingerDropRef}
            className={`rounded-lg px-2 py-1.5 min-h-[28px] transition-all duration-150
              ${isSlingerOver ? 'bg-blue-50 ring-1 ring-blue-300' : 'bg-gray-50/50'}
              ${slingers.length === 0 ? 'flex items-center justify-center' : ''}`}
          >
            {slingers.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {slingers.map((s) => (
                  <div key={s.id} className="flex items-center gap-0.5">
                    <DraggableEmployee employeeId={s.id} assignmentId={assignment.id} name={isAutoFilled(assignment.notes, s.id) ? `${s.name} *` : s.name} role="slinger" />
                    <button onClick={() => removeSlinger(s.id)} className="p-0.5 rounded-lg hover:bg-red-50 transition-colors">
                      <X size={10} className="text-gray-300 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-gray-300 font-medium">+ Slinger(s)</span>
            )}
          </div>

          {/* Notes inline editor */}
          {notesOpen && (
            <div className="flex gap-1.5">
              <input
                autoFocus
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveNotes(); if (e.key === 'Escape') setNotesOpen(false); }}
                placeholder="Add a note..."
                className="flex-1 text-[11px] px-2.5 py-1 rounded-lg bg-amber-50 border-0 outline-none focus:ring-2 focus:ring-amber-300"
              />
              <button onClick={saveNotes} className="p-1 rounded-lg bg-amber-400 hover:bg-amber-500 transition-colors">
                <Check size={11} className="text-white" />
              </button>
              <button onClick={() => setNotesOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={11} className="text-gray-400" />
              </button>
            </div>
          )}
        </div>

        {/* Notes button — only when editor is closed */}
        {!notesOpen && !userNotes && (
          <button onClick={openNotes} className="w-full px-3 py-1 text-[10px] text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors text-left rounded-b-xl">
            + note
          </button>
        )}
      </div>

      {dispatchOpen && driver && truck && (
        <DispatchModal
          open={dispatchOpen}
          onClose={() => setDispatchOpen(false)}
          assignment={assignment}
          day={day}
        />
      )}
    </>
  );
});
