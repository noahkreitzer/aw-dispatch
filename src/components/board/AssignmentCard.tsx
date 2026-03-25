import { useState, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { useRouteStore } from '@/stores/routeStore';
import { useEmployeeStore } from '@/stores/employeeStore';
import { useTruckStore } from '@/stores/truckStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import type { Assignment, DayOfWeek } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { MessageSquare, ChevronDown, ChevronUp, X, Power } from 'lucide-react';
import DispatchModal from './DispatchModal';

interface AssignmentCardProps {
  assignment: Assignment;
  weekKey: string;
  day: DayOfWeek;
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
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono cursor-grab
        ${role === 'driver' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}
        ${isDragging ? 'opacity-50' : ''}`}
    >
      {name}
    </span>
  );
}

export default function AssignmentCard({ assignment, weekKey, day }: AssignmentCardProps) {
  const [expanded, setExpanded] = useState(true);
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

  const statusColor = isOff
    ? 'bg-gray-200 text-gray-500'
    : isReady
    ? 'border-l-green-500'
    : 'border-l-orange-400';

  const typeColor: Record<string, string> = {
    residential: 'bg-blue-100 text-blue-700',
    commercial: 'bg-purple-100 text-purple-700',
    recycling: 'bg-green-100 text-green-700',
    'roll-off': 'bg-orange-100 text-orange-700',
  };

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

  return (
    <>
      <div
        className={`rounded border-l-4 bg-white shadow-sm text-xs ${statusColor} ${isOff ? 'opacity-50' : ''}`}
      >
        {/* Header */}
        <div className="px-2 py-1.5 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-semibold truncate">{route.name}</span>
              <Badge className={`text-[9px] px-1 py-0 ${typeColor[route.type] ?? ''}`}>
                {route.type.slice(0, 3)}
              </Badge>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono truncate">
              {route.municipality}
              {truck && <> · Truck #{truck.number}</>}
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {isReady && !isOff && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDispatchOpen(true)}>
                <MessageSquare size={12} className="text-green-600" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleOff}>
              <Power size={12} className={isOff ? 'text-red-500' : 'text-muted-foreground'} />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </Button>
          </div>
        </div>

        {expanded && !isOff && (
          <div className="px-2 pb-2 space-y-1.5">
            {/* Truck Select */}
            <div>
              <Select
                value={assignment.truckId ?? 'none'}
                onValueChange={(v) =>
                  updateAssignment(weekKey, assignment.id, { truckId: v === 'none' ? null : v })
                }
              >
                <SelectTrigger className="h-6 text-[10px] font-mono">
                  <SelectValue placeholder="Assign truck..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No truck</SelectItem>
                  {activeTrucks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      #{t.number} ({t.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Driver Drop Zone */}
            <div
              ref={driverDropRef}
              className={`rounded border border-dashed p-1.5 min-h-[28px] transition-colors
                ${isDriverOver ? 'border-[#F5C400] bg-[#F5C400]/10' : 'border-gray-300'}
                ${!driver ? 'flex items-center justify-center' : ''}`}
            >
              {driver ? (
                <div className="flex items-center justify-between">
                  <DraggableEmployee
                    employeeId={driver.id}
                    assignmentId={assignment.id}
                    name={driver.name}
                    role="driver"
                  />
                  <button onClick={removeDriver} className="text-muted-foreground hover:text-destructive">
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <span className="text-[10px] text-muted-foreground font-mono">Drop driver here</span>
              )}
            </div>

            {/* Slinger Drop Zone */}
            <div
              ref={slingerDropRef}
              className={`rounded border border-dashed p-1.5 min-h-[28px] transition-colors
                ${isSlingerOver ? 'border-[#F5C400] bg-[#F5C400]/10' : 'border-gray-200'}
                ${slingers.length === 0 ? 'flex items-center justify-center' : ''}`}
            >
              {slingers.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {slingers.map((s) => (
                    <div key={s.id} className="flex items-center gap-0.5">
                      <DraggableEmployee
                        employeeId={s.id}
                        assignmentId={assignment.id}
                        name={s.name}
                        role="slinger"
                      />
                      <button onClick={() => removeSlinger(s.id)} className="text-muted-foreground hover:text-destructive">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-[10px] text-muted-foreground font-mono">Drop slinger(s) here</span>
              )}
            </div>

            {/* Status */}
            <div className="flex items-center justify-between">
              <Badge
                className={`text-[9px] ${
                  isReady ? 'bg-green-600 text-white' : 'bg-orange-500 text-white'
                }`}
              >
                {isReady ? 'Ready' : 'Incomplete'}
              </Badge>
              {route.stops > 0 && (
                <span className="text-[9px] text-muted-foreground font-mono">{route.stops} stops</span>
              )}
            </div>
          </div>
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
}
