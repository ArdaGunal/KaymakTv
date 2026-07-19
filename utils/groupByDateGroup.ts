export interface DateGroupSection {
  title: string;
  data: any[];
}

/**
 * dateGroup alanına göre O(n) gruplama (Map tabanlı).
 * Eskiden 4 ekranda kopya olarak, her öğe için groups.find() çağıran
 * O(n²) bir döngüyle yapılıyordu — uzun takvim listelerinde gereksiz maliyet.
 * Girdi sıralı geldiği için (rawDate asc) grup sırası korunur.
 */
export function groupByDateGroup(items: any[]): DateGroupSection[] {
  const map = new Map<string, DateGroupSection>();
  for (const item of items) {
    const key = item.dateGroup;
    const existing = map.get(key);
    if (existing) existing.data.push(item);
    else map.set(key, { title: key, data: [item] });
  }
  return Array.from(map.values());
}
