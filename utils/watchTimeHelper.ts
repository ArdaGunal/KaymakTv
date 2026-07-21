export interface WatchDuration {
  months: number;
  days: number;
  hours: number;
}

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_MONTH = 30;

export function minutesToWatchDuration(totalMinutes: number): WatchDuration {
  const totalHours = Math.floor((totalMinutes || 0) / MINUTES_PER_HOUR);
  const totalDays = Math.floor(totalHours / HOURS_PER_DAY);
  const months = Math.floor(totalDays / DAYS_PER_MONTH);
  const days = totalDays % DAYS_PER_MONTH;
  const hours = totalHours % HOURS_PER_DAY;
  return { months, days, hours };
}

export interface WatchDurationUnitLabels {
  month: string;
  day: string;
  hour: string;
}

// En fazla 2 anlamlı birim gösterir ("X Ay, Y Gün" gibi); ay yoksa saat de
// eklenir ("Y Gün, Z Saat"). Kart üzerinde "3 Ay, 12 Gün, 4 Saat, 0 Dakika"
// gibi gürültülü bir çıktı yerine kısa ve okunur bir süre hedeflenir.
export function formatWatchDuration(totalMinutes: number, unitLabels: WatchDurationUnitLabels): string {
  const { months, days, hours } = minutesToWatchDuration(totalMinutes);
  const parts: string[] = [];

  if (months > 0) parts.push(`${months} ${unitLabels.month}`);
  if (days > 0) parts.push(`${days} ${unitLabels.day}`);
  if (parts.length < 2 && hours > 0) parts.push(`${hours} ${unitLabels.hour}`);
  if (parts.length === 0) parts.push(`0 ${unitLabels.hour}`);

  return parts.join(', ');
}
