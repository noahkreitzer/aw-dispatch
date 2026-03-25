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
      className={`crew-chip flex items-center justify-between px-2.5 py-2 rounded-lg cursor-grab select-none
        hover:bg-yellow-50 active:bg-yellow-100 transition-colors border border-transparent hover:border-yellow-200
        ${isDragging ? 'opacity-20' : ''}`}
    >
      <span className="text-xs font-medium truncate">{employee.name}</span>
      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ml-2
        ${employee.role === 'driver' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
        {employee.role === 'driver' ? 'DRV' : 'SLG'}
      </span>
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
    <div className="w-52 border-l bg-white shrink-0 flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b bg-gray-900 text-white">
        <span className="font-bold text-xs">Crew Pool</span>
        <span className="text-gray-400 text-[10px] ml-1.5">({employees.length})</span>
      </div>

      <div className="flex-1 overflow-y-auto gpu-scroll">
        {/* Drivers */}
        <div className="px-1.5 pt-2">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-0.5">
            Drivers ({drivers.length})
          </p>
          {drivers.map((emp) => (
            <DraggablePoolEmployee key={emp.id} employee={emp} />
          ))}
          {drivers.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-3">All assigned</p>
          )}
        </div>

        {/* Slingers */}
        <div className="px-1.5 pt-3 pb-2">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-0.5">
            Slingers ({slingers.length})
          </p>
          {slingers.map((emp) => (
            <DraggablePoolEmployee key={emp.id} employee={emp} />
          ))}
          {slingers.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-3">All assigned</p>
          )}
        </div>
      </div>
    </div>
  );
});
