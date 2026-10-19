import { invoke } from '@tauri-apps/api/core';

export const statuses = [
  'planned',
  'playing',
  'paused',
  'completed',
  'dropped',
] as const;
export type Status = (typeof statuses)[number];
export const statusLabel = (status: string) =>
  status.charAt(0).toUpperCase() + status.slice(1);
export interface GameInput {
  id: string | null;
  title: string;
  platform: string;
  status: Status;
  rating: number | null;
  playtimeSeconds: number | null;
  completedOn: string | null;
  platinumStatus: string;
  notes: string;
  igdbId?: number | null;
  coverImageId?: string | null;
  igdbRating?: number | null;
  igdbRatingCount?: number | null;
}
export interface Game extends GameInput {
  id: string;
}
export interface Dashboard {
  total: number;
  completed: number;
  playing: number;
  platinum: number;
  averageRating: number | null;
}
export interface HomeData {
  dashboard?: Dashboard;
  totalSeconds: number;
  recordedTimes: number;
  rated: number;
  platinumEligible: number;
  featured: Game | null;
  topRated: Game[];
  recentlyCompleted: Game[];
}
export interface Candidate {
  id: number;
  name: string;
  coverImageId: string | null;
  releasedAt: number | null;
  platforms: string[];
  communityRating: number | null;
  ratingCount: number;
}
export const catalogApi = {
  setup: () => invoke<void>('open_igdb_setup'),
  connected: () => invoke<boolean>('igdb_connected'),
  connect: (clientId: string, clientSecret: string) =>
    invoke<void>('connect_igdb', { clientId, clientSecret }),
  disconnect: () => invoke<void>('disconnect_igdb'),
  search: (title: string) => invoke<Candidate[]>('search_igdb', { title }),
  cacheCover: (imageId: string) =>
    invoke<void>('cache_igdb_cover', { imageId }),
  readCover: (imageId: string) =>
    invoke<string | null>('read_cached_cover', { imageId }),
};
export const libraryApi = {
  list: (search: string, status: string, offset: number, archived: boolean) =>
    invoke<Game[]>('list_games', { search, status, offset, archived }),
  dashboard: () => invoke<Dashboard>('get_dashboard'),
  home: () => invoke<HomeData>('get_home'),
  save: (input: GameInput) => invoke<Game>('save_game', { input }),
  archive: (id: string, archived: boolean) =>
    invoke<void>('set_archived', { id, archived }),
  support: () => invoke<void>('open_support'),
};
export function formatPlaytime(seconds: number | null) {
  if (seconds === null) return 'Not recorded';
  const minutes = Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
