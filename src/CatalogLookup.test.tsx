import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import Library from './Library';
import { CatalogConnection } from './CatalogLookup';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);
const game = {
  id: 'local-game',
  title: 'My original title',
  platform: 'PC',
  status: 'playing',
  rating: 4,
  playtimeSeconds: 5400,
  completedOn: null,
  platinumStatus: 'planned',
  notes: 'My personal notes',
};
beforeEach(() => {
  mockInvoke.mockImplementation(async (command) => {
    if (command === 'igdb_connected') return true as never;
    if (command === 'list_games') return [game] as never;
    if (command === 'get_dashboard')
      return {
        total: 1,
        completed: 0,
        playing: 1,
        platinum: 0,
        averageRating: 4,
      } as never;
    if (command === 'search_igdb')
      return [
        {
          id: 42,
          name: 'Adventure: Definitive Edition',
          coverImageId: 'co_example',
          releasedAt: null,
          platforms: ['PC'],
          communityRating: 91.5,
          ratingCount: 12,
        },
      ] as never;
    return undefined as never;
  });
});

test('selecting an IGDB edition caches the cover and preserves existing personal data until save', async () => {
  const user = userEvent.setup();
  render(<Library initialView="library" />);
  await user.click(await screen.findByRole('button', { name: game.title }));
  await user.click(screen.getByText('Find a game & cover on IGDB'));
  const search = await screen.findByLabelText('Search IGDB');
  await user.clear(search);
  await user.type(search, 'Adventure');
  await user.click(screen.getByRole('button', { name: 'Search IGDB' }));
  await user.click(
    await screen.findByRole('button', {
      name: /Adventure: Definitive Edition/,
    }),
  );
  await screen.findByText('Linked to IGDB #42');
  expect(screen.getByLabelText('Title')).toHaveValue(game.title);
  expect(screen.getByLabelText('Rating')).toHaveValue('4');
  expect(screen.getByLabelText('Notes')).toHaveValue(game.notes);
  expect(mockInvoke).toHaveBeenCalledWith('cache_igdb_cover', {
    imageId: 'co_example',
  });
  expect(
    mockInvoke.mock.calls.some(([command]) => command === 'save_game'),
  ).toBe(false);
  await user.click(screen.getByRole('button', { name: 'Save game' }));
  await waitFor(() =>
    expect(mockInvoke).toHaveBeenCalledWith('save_game', {
      input: expect.objectContaining({
        ...game,
        igdbId: 42,
        coverImageId: 'co_example',
        igdbRating: 91.5,
        igdbRatingCount: 12,
      }),
    }),
  );
});

test('a failed cover download leaves the current game unchanged', async () => {
  const fallback = mockInvoke.getMockImplementation()!;
  mockInvoke.mockImplementation(async (command, args, options) => {
    if (command === 'cache_igdb_cover') throw new Error('Cover unavailable');
    return fallback(command, args, options);
  });
  const user = userEvent.setup();
  render(<Library initialView="library" />);
  await user.click(await screen.findByRole('button', { name: game.title }));
  await user.click(screen.getByText('Find a game & cover on IGDB'));
  await user.click(await screen.findByRole('button', { name: 'Search IGDB' }));
  await user.click(
    await screen.findByRole('button', {
      name: /Adventure: Definitive Edition/,
    }),
  );
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Title')).toHaveValue(game.title);
  expect(screen.queryByText('Linked to IGDB #42')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(
    mockInvoke.mock.calls.some(([command]) => command === 'save_game'),
  ).toBe(false);
});

test('credentials use a password field and the secret is cleared while connecting', async () => {
  let finish: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  mockInvoke.mockImplementation(async (command) => {
    if (command === 'igdb_connected') return false as never;
    if (command === 'connect_igdb') await pending;
    return undefined as never;
  });
  const user = userEvent.setup();
  render(<CatalogConnection />);
  await user.type(screen.getByLabelText('Client ID'), 'syntheticClient');
  await user.type(screen.getByLabelText('Client Secret'), 'syntheticSecret');
  expect(screen.getByLabelText('Client Secret')).toHaveAttribute(
    'type',
    'password',
  );
  await user.click(screen.getByRole('button', { name: 'Connect to IGDB' }));
  expect(screen.getByLabelText('Client Secret')).toHaveValue('');
  expect(mockInvoke).toHaveBeenCalledWith('connect_igdb', {
    clientId: 'syntheticClient',
    clientSecret: 'syntheticSecret',
  });
  finish();
  await screen.findByText('Connected to IGDB for this session.');
  await user.click(screen.getByRole('button', { name: 'Disconnect IGDB' }));
  expect(mockInvoke).toHaveBeenCalledWith('disconnect_igdb');
});
