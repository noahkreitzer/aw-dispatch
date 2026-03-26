import { useMemo, memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import type { Assignment, DayOfWeek, SpareSlot, VacationSlot } from '@/types';
import type { Conflict } from '@/lib/conflicts';
import { useEmployeeStore } from '@/stores/employeeStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { X } from 'lucide-react';
import AssignmentCard from './AssignmentCard';

interface DayColumnProps {
  day: DayOfWeek;
  date: string;
  assignments: Assignment[];
  weekKey: string;
  spareSlot?: SpareSlot;
  vacationSlot?: VacationSlot;
  conflicts?: Conflict[];
}

const DAY_COLORS: Record<DayOfWeek, string> = {
  Monday: 'bg-blue-500',
  Tuesday: 'bg-emerald-500',
  Wednesday: 'bg-amber-500',
  Thursday: 'bg-orange-500',
  Friday: 'bg-red-500',
  Saturday: 'bg-purple-500',
};

function DraggableSpareEmployee({ employeeId, day, weekKey, name }: {
  employeeId: string; day: DayOfWeek; weekKey: string; name: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `spare-${day}-${employeeId}`,
    data: { employeeId, type: 'spare' },
  });
  const removeFromSpare = useScheduleStore((s) => s.removeFromSpare);

  return (
    <div className="flex items-center gap-1">
      <span
        ref={setNodeRef} {...listeners} {...attributes}
        className={`crew-chip inline-flex items-center px-2 py-1 rounded-md text-xs font-medium cursor-grab select-none
          bg-amber-50 text-amber-700 border border-amber-200 ${isDragging ? 'opacity-30' : ''}`}
      >
        {name}
      </span>
      <button onClick={() => removeFromSpare(weekKey, day, employeeId)}
        className="p-0.5 rounded hover:bg-red-50 transition-colors">
        <X size={11} className="text-gray-400 hover:text-red-500" />
      </button>
    </div>
  );
}

function VacationEmployee({ employeeId, day, weekKey, name }: {
  employeeId: string; day: DayOfWeek; weekKey: string; name: string;
}) {
  const removeFromVacation = useScheduleStore((s) => s.removeFromVacation);

  return (
    <div className="flex items-center gap-1">
      <span className="crew-chip inline-flex items-center px-2 py-1 rounded-md text-xs font-medium
        bg-red-50 text-red-600 border border-red-200">
        {name}
      </span>
      <button onClick={() => removeFromVacation(weekKey, day, employeeId)}
        className="p-0.5 rounded hover:bg-red-50 transition-colors">
        <X size={11} className="text-gray-400 hover:text-red-500" />
      </button>
    </div>
  );
}

export default memo(function DayColumn({ day, date, assignments, weekKey, spareSlot, vacationSlot, conflicts = [] }: DayColumnProps) {
  const employees = useEmployeeStore((s) => s.employees);
  const spareIds = spareSlot?.employeeIds;
  const vacationIds = vacationSlot?.employeeIds;
  const spareEmployees = useMemo(
    () => (spareIds ?? []).map((id) => employees.find((e) => e.id === id)).filter(Boolean) as typeof employees,
    [spareIds, employees]
  );
  const vacationEmployees = useMemo(
    () => (vacationIds ?? []).map((id) => employees.find((e) => e.id === id)).filter(Boolean) as typeof employees,
    [vacationIds, employees]
  );

  const { setNodeRef: spareDropRef, isOver: isSpareOver } = useDroppable({
    id: `spare-drop-${day}`,
    data: { slot: 'spare', day },
  });
  const { setNodeRef: vacationDropRef, isOver: isVacationOver } = useDroppable({
    id: `vacation-drop-${day}`,
    data: { slot: 'vacation', day },
  });

  const readyCount = assignments.filter((a) => a.status === 'ready').length;

  return (
    <div className="day-column flex-1 min-w-[260px] flex flex-col border-r last:border-r-0 bg-gray-50/30">
      {/* Day Header */}
      <div className="px-3 py-2 bg-white border-b shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${DAY_COLORS[day]}`} />
            <span className="font-bold text-sm">{day}</span>
            <span className="text-[10px] text-gray-400 font-mono">{date}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <span className="text-gray-400">{assignments.length}</span>
            {readyCount > 0 && readyCount === assignments.length && (
              <span className="text-green-500 font-bold">✓</span>
            )}
            {readyCount > 0 && readyCount < assignments.length && (
              <span className="text-green-500">{readyCount}/{assignments.length}</span>
            )}
          </div>
        </div>
      </div>

      {/* Cards - GPU accelerated scroll */}
      <div className="flex-1 overflow-y-auto gpu-scroll p-1.5 space-y-1.5">
        {assignments.length === 0 && (
          <div className="text-center text-xs text-gray-400 py-8 font-medium">
            No routes
          </div>
        )}
        {assignments.map((assignment) => (
          <AssignmentCard
            key={assignment.id}
            assignment={assignment}
            weekKey={weekKey}
            day={day}
            conflicts={conflicts.filter((c) => c.assignmentIds.includes(assignment.id))}
          />
        ))}

        {/* Vacation zone */}
        <div
          ref={vacationDropRef}
          className={`rounded-lg border-2 border-dashed p-2 transition-all duration-150
            ${isVacationOver ? 'border-red-400 bg-red-50 scale-[1.01]' : 'border-red-200/30 bg-red-50/10'}`}
        >
          <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">Off / Vacation</span>
          {vacationEmployees.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {vacationEmployees.map((emp) => (
                <VacationEmployee key={emp.id} employeeId={emp.id} day={day} weekKey={weekKey} name={emp.name} />
              ))}
            </div>
          ) : (
            <p className="text-[9px] text-gray-300 mt-0.5">Drop here</p>
          )}
        </div>

        {/* Spare zone */}
        <div
          ref={spareDropRef}
          className={`rounded-lg border-2 border-dashed p-2 transition-all duration-150
            ${isSpareOver ? 'border-amber-400 bg-amber-50 scale-[1.01]' : 'border-amber-200/30 bg-amber-50/10'}`}
        >
          <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Spare</span>
          {spareEmployees.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {spareEmployees.map((emp) => (
                <DraggableSpareEmployee key={emp.id} employeeId={emp.id} day={day} weekKey={weekKey} name={emp.name} />
              ))}
            </div>
          ) : (
            <p className="text-[9px] text-gray-300 mt-0.5">Drop here</p>
          )}
        </div>
      </div>
    </div>
  );
});
