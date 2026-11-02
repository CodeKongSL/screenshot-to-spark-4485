// Date helpers. "Today" is always Asia/Colombo time, not the visitor's browser time zone.

/** Today's date in Colombo as YYYY-MM-DD (no UTC conversion). */
export function todayInColombo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "14:30" -> "2:30 PM" */
export function formatTime12(time24: string): string {
  const [h = 0, m = 0] = time24.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "2026-11-09" -> "Monday, 9 November 2026" */
export function formatLongDate(dateStr: string): string {
  const [y = 0, m = 1, d = 1] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}