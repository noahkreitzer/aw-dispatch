import { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Employee } from '@/types';

function DraggablePoolEmployee({ employee }: { employee: Employee }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: employee.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`crew-chip flex items-center px-3 py-2 rounded-lg cursor-grab select-none
        hover:bg-gray-100 active:bg-gray-200 transition-colors
        ${isDragging ? 'opacity-20' : ''}`}
    >
      <span className="text-[12px] font-medium truncate">{employee.name}</span>
    </div>
  );
}

interface EmployeePoolProps {
  employees: Employee[];
}

export default memo(function EmployeePool({ employees }: EmployeePoolProps) {
  const drivers = employees.filter((e) => e.role === 'driver');
  const slingers = employees.filter((e) => e.role === 'slinger');

  return (
    <div className="w-48 border-l border-gray-200/60 bg-white shrink-0 flex flex-col overflow-hidden">
      <div className="px-3 py-2.5 border-b border-gray-200/60 flex items-center justify-between">
        <span className="font-semibold text-[13px] text-gray-900">Crew Pool</span>
        <span className="text-gray-400 text-[11px] tabular-nums">{employees.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto gpu-scroll">
        {/* Drivers */}
        <div className="px-1.5 pt-2">
          <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider px-2 mb-1">
            Drivers ({drivers.length})
          </p>
          <div className="border-b border-gray-100 pb-2">
            {drivers.map((emp) => (
              <DraggablePoolEmployee key={emp.id} employee={emp} />
            ))}
          </div>
        </div>

        {/* Slingers */}
        <div className="px-1.5 pt-2 pb-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">
            Slingers ({slingers.length})
          </p>
          {slingers.map((emp) => (
            <DraggablePoolEmployee key={emp.id} employee={emp} />
          ))}
        </div>
      </div>
    </div>
  );
});
