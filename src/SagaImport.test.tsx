import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import SagaImport from './SagaImport';
import { sagaApi } from './saga-api';
vi.mock('./saga-api', () => ({
  sagaApi: { search: vi.fn(), games: vi.fn(), import: vi.fn() },
}));
vi.mock('./library-api', () => ({ catalogApi: { cacheCover: vi.fn() } }));
const group = { id: 7, name: 'Borderlands', kind: 'collection' };
const game = {
  id: 1,
  name: 'Borderlands',
  coverImageId: null,
  releasedAt: 1255996800,
  platforms: ['PC'],
  communityRating: null,
  ratingCount: 0,
  kind: 'Main Game',
  edition: false,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(sagaApi.search).mockResolvedValue([group]);
  vi.mocked(sagaApi.games).mockResolvedValue({
    games: [
      game,
      { ...game, id: 2, name: 'Borderlands DLC', kind: 'DLC Addon' },
    ],
    nextOffset: null,
  });
  vi.mocked(sagaApi.import).mockResolvedValue(1);
});
async function open() {
  const user = userEvent.setup();
  await user.click(screen.getByText('Find a saga on IGDB'));
  await user.type(screen.getByLabelText('Saga or game name'), 'Borderlands');
  await user.click(screen.getByRole('button', { name: 'Search sagas' }));
  await user.click(
    await screen.findByRole('button', { name: 'Borderlands (collection)' }),
  );
  await screen.findByRole('checkbox', { name: 'Import Borderlands' });
  return user;
}
test('imports only reviewed visible games and the chosen platform', async () => {
  const changed = vi.fn();
  render(<SagaImport listId="list" onChanged={changed} />);
  const user = await open();
  expect(
    screen.queryByRole('checkbox', { name: 'Import Borderlands DLC' }),
  ).not.toBeInTheDocument();
  const extras = screen.getByRole('checkbox', { name: /Include DLCs/ });
  await user.click(extras);
  await user.click(
    screen.getByRole('checkbox', { name: 'Import Borderlands DLC' }),
  );
  await user.click(extras);
  await user.click(
    screen.getByRole('button', { name: 'Select visible games' }),
  );
  await user.type(screen.getByLabelText('Platform for imported games'), 'PC');
  await user.click(screen.getByRole('button', { name: 'Add selected games' }));
  expect(sagaApi.import).toHaveBeenCalledWith('list', [game], 'PC');
  expect(await screen.findByRole('status')).toHaveTextContent('1 games added');
  expect(changed).toHaveBeenCalled();
});
test('loads another page without losing the selection', async () => {
  vi.mocked(sagaApi.games)
    .mockResolvedValueOnce({ games: [game], nextOffset: 100 })
    .mockResolvedValueOnce({
      games: [{ ...game, id: 3, name: 'Second game' }],
      nextOffset: null,
    });
  render(<SagaImport listId="list" onChanged={vi.fn()} />);
  const user = await open();
  await user.click(
    screen.getByRole('checkbox', { name: 'Import Borderlands' }),
  );
  await user.click(
    screen.getByRole('button', { name: 'Load more saga games' }),
  );
  await screen.findByRole('checkbox', { name: 'Import Second game' });
  expect(
    screen.getByRole('checkbox', { name: 'Import Borderlands' }),
  ).toBeChecked();
  expect(sagaApi.games).toHaveBeenLastCalledWith(group, 100);
});
test('failed import retains the selection and never reports success', async () => {
  vi.mocked(sagaApi.import).mockRejectedValue('List unavailable');
  const changed = vi.fn();
  render(<SagaImport listId="list" onChanged={changed} />);
  const user = await open();
  await user.click(
    screen.getByRole('checkbox', { name: 'Import Borderlands' }),
  );
  await user.type(screen.getByLabelText('Platform for imported games'), 'PC');
  await user.click(screen.getByRole('button', { name: 'Add selected games' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'List unavailable',
  );
  expect(
    screen.getByRole('checkbox', { name: 'Import Borderlands' }),
  ).toBeChecked();
  expect(changed).not.toHaveBeenCalled();
});
