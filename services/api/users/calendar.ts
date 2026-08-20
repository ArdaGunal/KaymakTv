import { getTraktClient } from '../traktClient';

export const getMyCalendarShows = async (days = 30) => {
  try {
    const client = await getTraktClient();
    const today = new Date().toISOString().split('T')[0];
    const response = await client.get(`/calendars/my/shows/${today}/${days}?extended=full`);
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (getMyCalendarShows):', error);
    throw error;
  }
};

export const getMyCalendarMovies = async (days = 30) => {
  try {
    const client = await getTraktClient();
    const today = new Date().toISOString().split('T')[0];
    const response = await client.get(`/calendars/my/movies/${today}/${days}?extended=full`);
    return response.data;
  } catch (error) {
    console.error('Trakt API Hatası (getMyCalendarMovies):', error);
    throw error;
  }
};
