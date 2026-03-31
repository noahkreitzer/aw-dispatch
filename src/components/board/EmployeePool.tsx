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
      className={`crew-chip flex items-center px-2 py-1.5 rounded cursor-grab select-none
        hover:bg-yellow-50 active:bg-yellow-100 transition-colors
        ${isDragging ? 'opacity-20' : ''}`}
    >
      <span className="text-[11px] font-medium truncate">{employee.name}</span>
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
    <div className="w-44 border-l bg-white shrink-0 flex flex-col overflow-hidden">
      <div className="px-2 py-1.5 border-b bg-gray-900 text-white flex items-center justify-between">
        <span className="font-bold text-[10px]">Crew Pool</span>
        <span className="text-gray-500 text-[9px] font-mono">{employees.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto gpu-scroll">
        {/* Drivers */}
        <div className="px-1 pt-1.5">
          <p className="text-[8px] font-bold text-blue-400 uppercase tracking-widest px-2 mb-0.5">
            Drivers ({drivers.length})
          </p>
          {drivers.map((emp) => (
            <DraggablePoolEmployee key={emp.id} employee={emp} />
          ))}
        </div>

        {/* Slingers */}
        <div className="px-1 pt-2 pb-1">
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-0.5">
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
