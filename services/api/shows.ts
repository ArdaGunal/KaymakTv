import { getTraktClient, applyTranslation } from './traktClient';
import i18n from '../../locales/index';

export const getTrendingShows = async (page = 1, limit = 7) => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/shows/trending?extended=full&page=${page}&limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÃ„Â± (getTrendingShows):', error);
    throw error;
  }
};

export const getShowSummary = async (showId: number) => {
  try {
    const client = await getTraktClient();
    const lang = i18n.language === 'tr' ? 'tr' : 'en';
    const response = await client.get(`/shows/${showId}?extended=full&translations=${lang}`);
    return applyTranslation(response.data, lang);
  } catch (error) {
    console.error(`Trakt API HatasÃ„Â± (getShowSummary - ${showId}):`, error);
    throw error;
  }
};

export const getShowSeasons = async (showId: number) => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/shows/${showId}/seasons?extended=full,episodes`);
    return response.data;
  } catch (error) {
    console.error(`Trakt API HatasÃ„Â± (getShowSeasons - ${showId}):`, error);
    throw error;
  }
};

export const getShowCast = async (showId: number) => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/shows/${showId}/people`);
    return response.data;
  } catch (error) {
    console.error(`Trakt API HatasÃ„Â± (getShowCast - ${showId}):`, error);
    throw error;
  }
};

export const getRelatedShows = async (showId: number) => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/shows/${showId}/related?extended=full&limit=10`);
    return response.data;
  } catch (error) {
    console.error(`Trakt API HatasÃ„Â± (getRelatedShows - ${showId}):`, error);
    throw error;
  }
};

export const getEpisodeDetail = async (showId: number, season: number, episode: number) => {
  try {
    const client = await getTraktClient();
    const lang = i18n.language === 'tr' ? 'tr' : 'en';
    const response = await client.get(`/shows/${showId}/seasons/${season}/episodes/${episode}?extended=full&translations=${lang}`);
    return applyTranslation(response.data, lang);
  } catch (error) {
    console.error(`Trakt API HatasÄ± (getEpisodeDetail - ${showId} S${season}E${episode}):`, error);
    throw error;
  }
};
