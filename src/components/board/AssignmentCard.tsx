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
      className={`crew-chip inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-grab select-none
        ${role === 'driver' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}
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

  // Strip auto-tags from notes for display
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
    // Preserve auto-tags, replace user text
    const autoTags = (assignment.notes || '').match(/\[auto:.*?\]/g)?.join('') ?? '';
    const newNotes = notesDraft.trim() ? `${notesDraft.trim()} ${autoTags}`.trim() : autoTags;
    updateAssignment(weekKey, assignment.id, { notes: newNotes });
    setNotesOpen(false);
  };

  if (isOff) {
    return (
      <div className="route-card rounded-lg bg-gray-100 px-2.5 py-1 flex items-center justify-between opacity-50">
        <span className="text-[10px] font-medium text-gray-500 line-through">{route.name}</span>
        <button onClick={toggleOff} className="p-0.5 rounded hover:bg-gray-200 transition-colors">
          <Power size={11} className="text-red-400" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className={`route-card rounded-lg bg-white overflow-hidden
        ${hasConflict ? 'border-l-[3px] border-l-red-500 border border-red-300' : isReady ? 'border-l-[3px] border-l-green-400 border border-green-200' : 'border border-gray-200'}`}>
        {/* Header */}
        <div className="px-2 py-1 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_COLORS[route.type] ?? 'bg-gray-400'}`} />
            <span className="font-semibold text-[10px] leading-tight truncate" title={`${route.name} (${TYPE_LABELS[route.type] ?? route.type})`}>{route.name}</span>
          </div>
          <div className="flex items-center shrink-0">
            {hasConflict && (
              <span title={conflicts.map(c => c.type === 'driver-double-booked' ? `${c.employeeName} drives 2` : c.type === 'truck-double-booked' ? `Truck #${c.truckNumber} on 2` : `${c.employeeName} slings 2`).join(', ')}>
                <AlertTriangle size={10} className="text-red-500" />
              </span>
            )}
            {userNotes && (
              <button onClick={openNotes} className="p-0.5 rounded hover:bg-yellow-50 transition-colors" title={userNotes}>
                <StickyNote size={10} className="text-yellow-500" />
              </button>
            )}
            {isReady && (
              <button onClick={() => setDispatchOpen(true)} className="p-0.5 rounded hover:bg-green-50 transition-colors">
                <MessageSquare size={10} className="text-green-500" />
              </button>
            )}
            <button onClick={toggleOff} className="p-0.5 rounded hover:bg-gray-100 transition-colors">
              <Power size={9} className="text-gray-300" />
            </button>
          </div>
        </div>

        <div className="px-2 pb-1.5 space-y-1">
          {/* Truck — compact inline */}
          <select
            value={assignment.truckId ?? ''}
            onChange={(e) => updateAssignment(weekKey, assignment.id, { truckId: e.target.value || null })}
            className="w-full text-[10px] font-mono px-1.5 py-0.5 rounded border border-gray-150 bg-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 outline-none"
          >
            <option value="">Truck...</option>
            {activeTrucks.map((t) => (
              <option key={t.id} value={t.id}>#{t.number} — {t.type}</option>
            ))}
          </select>

          {/* Driver drop zone */}
          <div
            ref={driverDropRef}
            className={`rounded px-1.5 py-1 min-h-[22px] transition-all duration-150
              ${isDriverOver ? 'border border-yellow-400 bg-yellow-50' : 'border border-dashed border-gray-200'}
              ${!driver ? 'flex items-center justify-center' : ''}`}
          >
            {driver ? (
              <div className="flex items-center justify-between gap-1">
                <DraggableEmployee employeeId={driver.id} assignmentId={assignment.id} name={isAutoFilled(assignment.notes, driver.id) ? `${driver.name} *` : driver.name} role="driver" />
                <button onClick={removeDriver} className="p-0.5 rounded hover:bg-red-50 transition-colors shrink-0">
                  <X size={10} className="text-gray-300 hover:text-red-500" />
                </button>
              </div>
            ) : (
              <span className="text-[9px] text-gray-300">+ Driver</span>
            )}
          </div>

          {/* Slinger drop zone */}
          <div
            ref={slingerDropRef}
            className={`rounded px-1.5 py-1 min-h-[22px] transition-all duration-150
              ${isSlingerOver ? 'border border-yellow-400 bg-yellow-50' : 'border border-dashed border-gray-100'}
              ${slingers.length === 0 ? 'flex items-center justify-center' : ''}`}
          >
            {slingers.length > 0 ? (
              <div className="flex flex-wrap gap-0.5">
                {slingers.map((s) => (
                  <div key={s.id} className="flex items-center gap-0.5">
                    <DraggableEmployee employeeId={s.id} assignmentId={assignment.id} name={isAutoFilled(assignment.notes, s.id) ? `${s.name} *` : s.name} role="slinger" />
                    <button onClick={() => removeSlinger(s.id)} className="p-0.5 rounded hover:bg-red-50 transition-colors">
                      <X size={10} className="text-gray-300 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-[9px] text-gray-300">+ Slinger(s)</span>
            )}
          </div>

          {/* Notes inline editor */}
          {notesOpen && (
            <div className="flex gap-1">
              <input
                autoFocus
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveNotes(); if (e.key === 'Escape') setNotesOpen(false); }}
                placeholder="Add a note..."
                className="flex-1 text-[10px] px-1.5 py-0.5 rounded border border-yellow-300 bg-yellow-50 outline-none focus:ring-1 focus:ring-yellow-400"
              />
              <button onClick={saveNotes} className="p-0.5 rounded bg-yellow-400 hover:bg-yellow-500 transition-colors">
                <Check size={10} className="text-white" />
              </button>
              <button onClick={() => setNotesOpen(false)} className="p-0.5 rounded hover:bg-gray-100 transition-colors">
                <X size={10} className="text-gray-400" />
              </button>
            </div>
          )}
        </div>

        {/* Notes button bar — only when notes editor is closed */}
        {!notesOpen && !userNotes && (
          <button onClick={openNotes} className="w-full px-2 py-0.5 text-[8px] text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors text-left">
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
