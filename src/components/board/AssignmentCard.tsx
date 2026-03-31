import { useState, useMemo, memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { useRouteStore } from '@/stores/routeStore';
import { useEmployeeStore } from '@/stores/employeeStore';
import { useTruckStore } from '@/stores/truckStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import type { Assignment, DayOfWeek } from '@/types';
import { MessageSquare, X, Power, AlertTriangle } from 'lucide-react';
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
      className={`crew-chip inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium cursor-grab select-none
        ${role === 'driver' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}
        ${isDragging ? 'opacity-30' : ''}`}
    >
      {name}
    </span>
  );
}

const TYPE_STYLES: Record<string, string> = {
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

  if (isOff) {
    return (
      <div className="route-card rounded-lg bg-gray-100 px-3 py-1.5 flex items-center justify-between opacity-50">
        <span className="text-xs font-medium text-gray-500 line-through">{route.name}</span>
        <button onClick={toggleOff} className="p-1 rounded hover:bg-gray-200 transition-colors">
          <Power size={12} className="text-red-400" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className={`route-card rounded-lg border bg-white overflow-hidden ${
        conflicts.length > 0 ? 'border-red-400 ring-1 ring-red-200' : isReady ? 'border-green-200' : 'border-gray-200'
      }`}>
        {/* Conflict indicator */}
        {conflicts.length > 0 && (
          <div className="bg-red-50 px-2.5 py-1 flex items-center gap-1.5 border-b border-red-200">
            <AlertTriangle size={10} className="text-red-500 shrink-0" />
            <span className="text-[9px] font-bold text-red-600 truncate">
              {conflicts.map((c) => {
                if (c.type === 'driver-double-booked') return `${c.employeeName} drives 2 routes`;
                if (c.type === 'truck-double-booked') return `Truck #${c.truckNumber} on 2 routes`;
                return `${c.employeeName} slings 2 routes`;
              }).join(' | ')}
            </span>
          </div>
        )}
        {/* Header bar — route name on its own line for full visibility */}
        <div className={`px-2.5 py-1.5 ${conflicts.length > 0 ? 'bg-red-50/50' : isReady ? 'bg-green-50' : 'bg-gray-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${TYPE_STYLES[route.type] ?? 'bg-gray-400'}`} />
              <span className="font-bold text-[11px] leading-tight">{route.name}</span>
            </div>
            <div className="flex items-center gap-0.5 shrink-0 ml-1">
              <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold text-white ${TYPE_STYLES[route.type] ?? 'bg-gray-400'}`}>
                {TYPE_LABELS[route.type] ?? route.type}
              </span>
              {isReady && (
                <button onClick={() => setDispatchOpen(true)} className="p-0.5 rounded hover:bg-green-100 transition-colors">
                  <MessageSquare size={12} className="text-green-600" />
                </button>
              )}
              <button onClick={toggleOff} className="p-0.5 rounded hover:bg-gray-200 transition-colors">
                <Power size={11} className="text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-2.5 py-1.5 space-y-1.5">
          {/* Truck */}
          <select
            value={assignment.truckId ?? ''}
            onChange={(e) => updateAssignment(weekKey, assignment.id, { truckId: e.target.value || null })}
            className="w-full text-[11px] font-mono px-2 py-1 rounded border border-gray-200 bg-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 outline-none transition-colors"
          >
            <option value="">Select truck...</option>
            {activeTrucks.map((t) => (
              <option key={t.id} value={t.id}>
                #{t.number} — {t.type}
              </option>
            ))}
          </select>

          {/* Driver drop zone */}
          <div
            ref={driverDropRef}
            className={`rounded border px-2 py-1.5 min-h-[28px] transition-all duration-150
              ${isDriverOver ? 'border-yellow-400 bg-yellow-50 scale-[1.01]' : 'border-dashed border-gray-200'}
              ${!driver ? 'flex items-center justify-center' : ''}`}
          >
            {driver ? (
              <div className="flex items-center justify-between gap-1">
                <DraggableEmployee employeeId={driver.id} assignmentId={assignment.id} name={isAutoFilled(assignment.notes, driver.id) ? `${driver.name} *` : driver.name} role="driver" />
                <button onClick={removeDriver} className="p-0.5 rounded hover:bg-red-50 transition-colors shrink-0">
                  <X size={11} className="text-gray-300 hover:text-red-500" />
                </button>
              </div>
            ) : (
              <span className="text-[10px] text-gray-300">+ Driver</span>
            )}
          </div>

          {/* Slinger drop zone */}
          <div
            ref={slingerDropRef}
            className={`rounded border px-2 py-1.5 min-h-[28px] transition-all duration-150
              ${isSlingerOver ? 'border-yellow-400 bg-yellow-50 scale-[1.01]' : 'border-dashed border-gray-100'}
              ${slingers.length === 0 ? 'flex items-center justify-center' : ''}`}
          >
            {slingers.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {slingers.map((s) => (
                  <div key={s.id} className="flex items-center gap-0.5">
                    <DraggableEmployee employeeId={s.id} assignmentId={assignment.id} name={isAutoFilled(assignment.notes, s.id) ? `${s.name} *` : s.name} role="slinger" />
                    <button onClick={() => removeSlinger(s.id)} className="p-0.5 rounded hover:bg-red-50 transition-colors">
                      <X size={11} className="text-gray-300 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-gray-300">+ Slinger(s)</span>
            )}
          </div>
        </div>
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
