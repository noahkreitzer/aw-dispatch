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
        className={`crew-chip inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-medium cursor-grab select-none
          bg-amber-50 text-amber-700 ${isDragging ? 'opacity-30' : ''}`}
      >
        {name}
      </span>
      <button onClick={() => removeFromSpare(weekKey, day, employeeId)}
        className="p-0.5 rounded-lg hover:bg-red-50 transition-colors">
        <X size={9} className="text-gray-300 hover:text-red-500" />
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
      <span className="crew-chip inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-medium
        bg-red-50 text-red-600">
        {name}
      </span>
      <button onClick={() => removeFromVacation(weekKey, day, employeeId)}
        className="p-0.5 rounded-lg hover:bg-red-50 transition-colors">
        <X size={9} className="text-gray-300 hover:text-red-500" />
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
  const hasVacation = vacationEmployees.length > 0;
  const hasSpare = spareEmployees.length > 0;

  return (
    <div className="day-column flex-1 min-w-0 md:min-w-[240px] flex flex-col border-r border-gray-200/40 last:border-r-0 bg-[#f5f5f7]/50">
      {/* Day Header */}
      <div className="px-3 py-2 bg-white border-b border-gray-200/40 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${DAY_COLORS[day]}`} />
            <span className="font-semibold text-[13px]">{day}</span>
            <span className="text-[10px] text-gray-400">{date}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-gray-400 tabular-nums">{assignments.length}</span>
            {readyCount > 0 && readyCount === assignments.length && (
              <span className="text-green-500 font-semibold">✓</span>
            )}
            {readyCount > 0 && readyCount < assignments.length && (
              <span className="text-green-500 tabular-nums">{readyCount}/{assignments.length}</span>
            )}
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto gpu-scroll p-1.5 space-y-1.5">
        {assignments.length === 0 && (
          <div className="text-center text-[11px] text-gray-300 py-10">No routes</div>
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
      </div>

      {/* Bottom zones */}
      <div className="shrink-0 border-t border-gray-200/40 bg-white px-1.5 py-1.5 flex gap-1.5">
        {/* Vacation zone */}
        <div
          ref={vacationDropRef}
          className={`flex-1 rounded-lg p-1.5 min-h-[28px] transition-all duration-200
            ${isVacationOver ? 'bg-red-50 ring-1 ring-red-300' : hasVacation ? 'bg-red-50/50' : 'bg-gray-50'}`}
        >
          <span className="text-[8px] font-semibold text-red-300 uppercase tracking-wider">Off</span>
          {hasVacation ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {vacationEmployees.map((emp) => (
                <VacationEmployee key={emp.id} employeeId={emp.id} day={day} weekKey={weekKey} name={emp.name} />
              ))}
            </div>
          ) : isVacationOver ? (
            <p className="text-[9px] text-gray-300 mt-0.5">Drop here</p>
          ) : null}
        </div>

        {/* Spare zone */}
        <div
          ref={spareDropRef}
          className={`flex-1 rounded-lg p-1.5 min-h-[28px] transition-all duration-200
            ${isSpareOver ? 'bg-amber-50 ring-1 ring-amber-300' : hasSpare ? 'bg-amber-50/50' : 'bg-gray-50'}`}
        >
          <span className="text-[8px] font-semibold text-amber-300 uppercase tracking-wider">Spare</span>
          {hasSpare ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {spareEmployees.map((emp) => (
                <DraggableSpareEmployee key={emp.id} employeeId={emp.id} day={day} weekKey={weekKey} name={emp.name} />
              ))}
            </div>
          ) : isSpareOver ? (
            <p className="text-[9px] text-gray-300 mt-0.5">Drop here</p>
          ) : null}
        </div>
      </div>
    </div>
  );
});
