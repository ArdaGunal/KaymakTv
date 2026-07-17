import { StateCreator } from 'zustand';

export interface CalendarSlice {
  calendarShows: any[];
  calendarMovies: any[];
  calendarSeasonsMap: Record<string, any>;
  setCalendarShows: (shows: any[]) => void;
  setCalendarMovies: (movies: any[]) => void;
  setCalendarSeasonsMap: (map: Record<string, any>) => void;
}

export const createCalendarSlice: StateCreator<CalendarSlice> = (set) => ({
  calendarShows: [],
  calendarMovies: [],
  calendarSeasonsMap: {},
  setCalendarShows: (shows) => set({ calendarShows: shows }),
  setCalendarMovies: (movies) => set({ calendarMovies: movies }),
  setCalendarSeasonsMap: (map) => set({ calendarSeasonsMap: map }),
});
