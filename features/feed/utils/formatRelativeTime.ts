export function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return 'şimdi';
  if (minutes < 60) return `${minutes}dk önce`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}sa önce`;

  const days = Math.floor(hours / 24);
  return `${days}g önce`;
}
