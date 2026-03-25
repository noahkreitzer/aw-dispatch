import { useDraggable } from '@dnd-kit/core';
import type { Employee } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

function DraggablePoolEmployee({ employee }: { employee: Employee }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: employee.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center justify-between px-2 py-1.5 rounded cursor-grab
        hover:bg-[#F5C400]/10 transition-colors
        ${isDragging ? 'opacity-30' : ''}`}
    >
      <span className="font-mono text-xs font-medium truncate">{employee.name}</span>
      <Badge
        variant={employee.role === 'driver' ? 'default' : 'secondary'}
        className="text-[9px] px-1 py-0 shrink-0 ml-1"
      >
        {employee.role === 'driver' ? 'DRV' : 'SLG'}
      </Badge>
    </div>
  );
}

interface EmployeePoolProps {
  employees: Employee[];
}

export default function EmployeePool({ employees }: EmployeePoolProps) {
  const drivers = employees.filter((e) => e.role === 'driver');
  const slingers = employees.filter((e) => e.role === 'slinger');

  return (
    <div className="w-52 border-l bg-white shrink-0 flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b bg-[#1A1A1A] text-white flex items-center gap-2">
        <Users size={14} />
        <span className="font-heading text-sm font-bold">Crew Pool</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Drivers */}
        <div className="px-2 pt-2">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider px-1 mb-1">
            Drivers ({drivers.length})
          </p>
          {drivers.map((emp) => (
            <DraggablePoolEmployee key={emp.id} employee={emp} />
          ))}
          {drivers.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-2 font-mono">All assigned</p>
          )}
        </div>

        {/* Slingers */}
        <div className="px-2 pt-3 pb-2">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider px-1 mb-1">
            Slingers ({slingers.length})
          </p>
          {slingers.map((emp) => (
            <DraggablePoolEmployee key={emp.id} employee={emp} />
          ))}
          {slingers.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-2 font-mono">All assigned</p>
          )}
        </div>
      </div>
    </div>
  );
}
