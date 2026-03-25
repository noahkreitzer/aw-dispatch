import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import type { Assignment, DayOfWeek, SpareSlot } from '@/types';
import { useEmployeeStore } from '@/stores/employeeStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import AssignmentCard from './AssignmentCard';

interface DayColumnProps {
  day: DayOfWeek;
  date: string;
  assignments: Assignment[];
  weekKey: string;
  spareSlot?: SpareSlot;
}

const dayColors: Record<DayOfWeek, string> = {
  Monday: 'border-blue-400',
  Tuesday: 'border-green-400',
  Wednesday: 'border-yellow-400',
  Thursday: 'border-orange-400',
  Friday: 'border-red-400',
  Saturday: 'border-purple-400',
};

function DraggableSpareEmployee({ employeeId, day, weekKey, name }: {
  employeeId: string;
  day: DayOfWeek;
  weekKey: string;
  name: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `spare-${day}-${employeeId}`,
    data: { employeeId, type: 'spare' },
  });
  const removeFromSpare = useScheduleStore((s) => s.removeFromSpare);

  return (
    <div className="flex items-center gap-1">
      <span
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono cursor-grab
          bg-amber-100 text-amber-800 ${isDragging ? 'opacity-50' : ''}`}
      >
        {name}
      </span>
      <button
        onClick={() => removeFromSpare(weekKey, day, employeeId)}
        className="text-muted-foreground hover:text-destructive"
      >
        <X size={10} />
      </button>
    </div>
  );
}

export default function DayColumn({ day, date, assignments, weekKey, spareSlot }: DayColumnProps) {
  const employees = useEmployeeStore((s) => s.employees);
  const spareEmployees = useMemo(
    () => (spareSlot?.employeeIds ?? []).map((id) => employees.find((e) => e.id === id)).filter(Boolean) as typeof employees,
    [spareSlot, employees]
  );

  const { setNodeRef: spareDropRef, isOver: isSpareOver } = useDroppable({
    id: `spare-drop-${day}`,
    data: { slot: 'spare', day },
  });

  return (
    <div className="flex-1 min-w-[220px] flex flex-col border-r last:border-r-0">
      {/* Day Header */}
      <div className={`px-3 py-2 bg-white border-b-2 ${dayColors[day]} shrink-0`}>
        <div className="flex items-center justify-between">
          <span className="font-heading font-bold text-sm">{day}</span>
          <span className="font-mono text-xs text-muted-foreground">{date}</span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {assignments.length} route{assignments.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-muted/30">
        {assignments.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-4 font-mono">
            No routes
          </div>
        )}
        {assignments.map((assignment) => (
          <AssignmentCard
            key={assignment.id}
            assignment={assignment}
            weekKey={weekKey}
            day={day}
          />
        ))}

        {/* Spare / Extra Crew Slot */}
        <div
          ref={spareDropRef}
          className={`rounded border-2 border-dashed p-2 min-h-[40px] transition-colors mt-2
            ${isSpareOver ? 'border-[#F5C400] bg-[#F5C400]/10' : 'border-amber-300/50 bg-amber-50/30'}`}
        >
          <div className="flex items-center gap-1 mb-1">
            <Badge className="text-[9px] bg-amber-500 text-white">SPARE</Badge>
            <span className="text-[10px] text-muted-foreground font-mono">Extra crew</span>
          </div>
          {spareEmployees.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {spareEmployees.map((emp) => (
                <DraggableSpareEmployee
                  key={emp.id}
                  employeeId={emp.id}
                  day={day}
                  weekKey={weekKey}
                  name={emp.name}
                />
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground font-mono">Drop spare crew here</span>
          )}
        </div>
      </div>
    </div>
  );
}
