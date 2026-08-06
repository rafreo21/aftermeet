export function followUpDueDate(days: number, now = new Date()) {
  const due = new Date(now);
  due.setHours(12, 0, 0, 0);
  due.setDate(due.getDate() + days);
  const year = due.getFullYear();
  const month = String(due.getMonth() + 1).padStart(2, "0");
  const day = String(due.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
