import type { StatsTab } from '../../../hooks/useProfileStatistics';

export interface GenreSlice {
  value: number;
  color: string;
  label: string;
}

export interface MonthlyBar {
  value: number;
  label: string;
}

// TODO: Trakt/TMDB tür (genre) verisi izlenen içeriklerden türetildiğinde bu
// mock veriler gerçek dağılımla değiştirilecek. Şimdilik yalnızca görsel
// tasarımı kanıtlamak için sabit değerler kullanılıyor.
const GENRE_MOCK: Record<StatsTab, GenreSlice[]> = {
  shows: [
    { value: 40, color: '#3B82F6', label: 'Bilim Kurgu' },
    { value: 25, color: '#8B5CF6', label: 'Drama' },
    { value: 20, color: '#F59E0B', label: 'Komedi' },
    { value: 15, color: '#10B981', label: 'Suç' },
  ],
  movies: [
    { value: 35, color: '#8B5CF6', label: 'Aksiyon' },
    { value: 30, color: '#3B82F6', label: 'Bilim Kurgu' },
    { value: 20, color: '#EF4444', label: 'Gerilim' },
    { value: 15, color: '#F59E0B', label: 'Komedi' },
  ],
};

const MONTHLY_MOCK: Record<StatsTab, MonthlyBar[]> = {
  shows: [
    { value: 12, label: 'Şub' },
    { value: 18, label: 'Mar' },
    { value: 9, label: 'Nis' },
    { value: 22, label: 'May' },
    { value: 15, label: 'Haz' },
    { value: 27, label: 'Tem' },
  ],
  movies: [
    { value: 4, label: 'Şub' },
    { value: 7, label: 'Mar' },
    { value: 3, label: 'Nis' },
    { value: 6, label: 'May' },
    { value: 9, label: 'Haz' },
    { value: 5, label: 'Tem' },
  ],
};

export const getGenreMockData = (tab: StatsTab): GenreSlice[] => GENRE_MOCK[tab];
export const getMonthlyMockData = (tab: StatsTab): MonthlyBar[] => MONTHLY_MOCK[tab];
