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
export const libraryApi = {
  list: (search: string, status: string, offset: number, archived: boolean) =>
    invoke<Game[]>('list_games', { search, status, offset, archived }),
  dashboard: () => invoke<Dashboard>('get_dashboard'),
  save: (input: GameInput) => invoke<Game>('save_game', { input }),
  archive: (id: string, archived: boolean) =>
    invoke<void>('set_archived', { id, archived }),
  setStatus: (id: string, status: Status) =>
    invoke<void>('set_game_status', { id, status }),
  support: () => invoke<void>('open_support'),
};
export function formatPlaytime(seconds: number | null) {
  if (seconds === null) return 'Not recorded';
  const minutes = Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
