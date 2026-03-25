import type { Employee, Assignment, Route, Truck } from '@/types';

export function buildDispatchMessage(
  employee: Employee,
  _assignment: Assignment,
  route: Route,
  truck: Truck,
  driver: Employee,
  slingers: Employee[],
  template: string,
  dayName: string
): string {
  const slingerText =
    slingers.length > 0
      ? ', Slingers: ' + slingers.map((s) => s.name).join(' & ')
      : '';
  return template
    .replace('{name}', employee.name)
    .replace('{day}', dayName)
    .replace('{truckNumber}', truck.number)
    .replace('{truckType}', truck.type.replace('-', ' '))
    .replace('{routeName}', route.name)
    .replace('{driverName}', driver.name)
    .replace('{slingers}', slingerText);
}

export function formatPhone(digits: string): string {
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

export function openInMessages(phone: string, body: string) {
  const uri = `sms:${phone}?body=${encodeURIComponent(body)}`;
  window.location.href = uri;
}

export function dispatchAll(crew: { phone: string; message: string }[]) {
  crew.forEach((member, i) => {
    setTimeout(() => openInMessages(member.phone, member.message), i * 600);
  });
}
