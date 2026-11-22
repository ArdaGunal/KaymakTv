import { getShowSummary } from '../api/shows';
import { fetchFromTmdb } from '../tmdbApi';
import { cacheManager } from '../../utils/cacheManager';
import { tekUcus } from '../../utils/tekUcus';

interface ShowFilterMetadata {
  status?: string;
  nextAirDate?: string | null;
}

export function normalizeShowStatus(status: unknown): string | undefined {
  return typeof status === 'string' ? status.trim().toLowerCase() || undefined : undefined;
}

export const loadShowFilterMetadata = tekUcus(
  (id: number, tmdbId?: number) => `${id}:${tmdbId ?? ''}`,
  async (id: number, tmdbId?: number): Promise<ShowFilterMetadata | null> => {
    const cacheKey = `@show_detail_filter_${id}_${tmdbId ?? ''}`;
    const cached = await cacheManager.get<ShowFilterMetadata>(cacheKey);
    if (cached) return cached;

    let metadata: ShowFilterMetadata = {};
    if (tmdbId) {
      const response = await fetchFromTmdb(`/tv/${tmdbId}`, {}, 15000).catch(() => null);
      const next = response?.data?.next_episode_to_air;
      metadata = {
        status: normalizeShowStatus(response?.data?.status),
        // null: bölüm duyurulmuş, yayın tarihi henüz verilmemiş.
        nextAirDate: next ? next.air_date ?? null : undefined,
      };
    }

    if (!metadata.status) {
      const detail = await cacheManager.get<{ summary?: { status?: string } }>(`@show_detail_v3_${id}`);
      metadata.status = normalizeShowStatus(detail?.summary?.status);
      if (!metadata.status) {
        const summary = await getShowSummary(id).catch(() => null);
        metadata.status = normalizeShowStatus(summary?.status);
      }
    }

    if (!metadata.status && metadata.nextAirDate === undefined) return null;
    if (metadata.status) await cacheManager.set(cacheKey, metadata);
    return metadata;
  },
);
