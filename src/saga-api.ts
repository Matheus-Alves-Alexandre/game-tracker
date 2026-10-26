import { invoke } from '@tauri-apps/api/core';
import type { Candidate } from './library-api';
export interface SagaGroup {
  id: number;
  name: string;
  kind: string;
}
export interface SagaGame extends Candidate {
  kind: string;
  edition: boolean;
}
export const sagaApi = {
  search: (title: string) => invoke<SagaGroup[]>('search_sagas', { title }),
  games: (group: SagaGroup, offset: number) =>
    invoke<{ games: SagaGame[]; nextOffset: number | null }>('get_saga_games', {
      kind: group.kind,
      id: group.id,
      offset,
    }),
  import: (listId: string, games: Candidate[], platform: string) =>
    invoke<number>('import_saga_games', { listId, games, platform }),
};
