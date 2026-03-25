import { useMemo } from 'react';
import { useRouteStore } from '@/stores/routeStore';
import { useEmployeeStore } from '@/stores/employeeStore';
import { useTruckStore } from '@/stores/truckStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Assignment, DayOfWeek } from '@/types';
import { buildDispatchMessage, formatPhone, openInMessages, dispatchAll } from '@/lib/dispatch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Copy, Send } from 'lucide-react';
import { toast } from 'sonner';

interface DispatchModalProps {
  open: boolean;
  onClose: () => void;
  assignment: Assignment;
  day: DayOfWeek;
}

export default function DispatchModal({ open, onClose, assignment, day }: DispatchModalProps) {
  const routes = useRouteStore((s) => s.routes);
  const employees = useEmployeeStore((s) => s.employees);
  const trucks = useTruckStore((s) => s.trucks);
  const template = useSettingsStore((s) => s.dispatchTemplate);

  const route = useMemo(() => routes.find((r) => r.id === assignment.routeId), [routes, assignment.routeId]);
  const driver = useMemo(
    () => (assignment.driverId ? employees.find((e) => e.id === assignment.driverId) : null),
    [employees, assignment.driverId]
  );
  const slingers = useMemo(
    () => assignment.slingerIds.map((id) => employees.find((e) => e.id === id)).filter(Boolean) as typeof employees,
    [employees, assignment.slingerIds]
  );
  const truck = useMemo(
    () => (assignment.truckId ? trucks.find((t) => t.id === assignment.truckId) : null),
    [trucks, assignment.truckId]
  );

  const crewMessages = useMemo(() => {
    if (!route || !driver || !truck) return [];
    const allCrew = [driver, ...slingers];
    return allCrew.map((member) => ({
      employee: member,
      message: buildDispatchMessage(member, assignment, route, truck, driver, slingers, template, day),
    }));
  }, [route, driver, slingers, truck, assignment, template, day]);

  const handleCopy = (message: string) => {
    navigator.clipboard.writeText(message);
    toast.success('Copied to clipboard');
  };

  const handleOpenMessages = (phone: string, message: string) => {
    if (!phone) {
      toast.error('No phone number on file');
      return;
    }
    openInMessages(phone, message);
  };

  const handleDispatchAll = () => {
    const withPhones = crewMessages.filter((c) => c.employee.phone);
    if (withPhones.length === 0) {
      toast.error('No crew members have phone numbers');
      return;
    }
    dispatchAll(
      withPhones.map((c) => ({ phone: c.employee.phone, message: c.message }))
    );
    toast.success(`Dispatching ${withPhones.length} messages...`);
  };

  if (!route || !driver || !truck) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <MessageSquare size={18} className="text-green-600" />
            Dispatch — {route.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          <div className="flex gap-2 text-xs font-mono text-muted-foreground">
            <Badge variant="outline">{day}</Badge>
            <Badge variant="outline">Truck #{truck.number}</Badge>
            <Badge variant="outline">{route.municipality}</Badge>
          </div>

          {crewMessages.map(({ employee, message }) => (
            <Card key={employee.id}>
              <CardContent className="py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-sm">{employee.name}</span>
                    <Badge className="ml-2 text-[10px]" variant="secondary">{employee.role}</Badge>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {employee.phone ? formatPhone(employee.phone) : 'No phone'}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 text-xs font-mono whitespace-pre-wrap">
                  {message}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleCopy(message)}
                  >
                    <Copy size={12} className="mr-1" /> Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleOpenMessages(employee.phone, message)}
                    disabled={!employee.phone}
                  >
                    <MessageSquare size={12} className="mr-1" /> Open in Messages
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handleDispatchAll}>
            <Send size={14} className="mr-1" /> Dispatch All ({crewMessages.filter((c) => c.employee.phone).length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
