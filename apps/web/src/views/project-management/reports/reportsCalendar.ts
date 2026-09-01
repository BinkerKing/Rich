function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function calendarDays(selectedDate: string): string[] {
  const [year, month] = selectedDate.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month - 1, 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return isoDate(day);
  });
}

export function shiftCalendarMonth(selectedDate: string, delta: number): string {
  const [year, month, day] = selectedDate.split("-").map(Number);
  const next = new Date(year, month - 1 + delta, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  return isoDate(new Date(next.getFullYear(), next.getMonth(), Math.min(day, lastDay)));
}
