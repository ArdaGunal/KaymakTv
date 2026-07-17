import { getTraktClient, applyTranslation } from './traktClient';
import i18n from '../../locales/index';

export const searchTrakt = async (query: string, type: 'show' | 'movie') => {
  try {
    const client = await getTraktClient();
    const response = await client.get(`/search/${type}?query=${encodeURIComponent(query)}&extended=full`);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÄ± (searchTrakt):', error);
    throw error;
  }
};
