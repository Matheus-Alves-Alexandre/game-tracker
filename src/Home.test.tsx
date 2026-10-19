import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import Home from './Home';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
test('home labels personal and community ratings separately and defines platinum denominator', async () => {
  const game = {
    id: 'one',
    title: 'Adventure',
    platform: 'PC',
    status: 'playing',
    rating: 4,
    playtimeSeconds: null,
    completedOn: null,
    platinumStatus: 'planned',
    notes: '',
    igdbRating: 91.5,
  };
  vi.mocked(invoke).mockResolvedValue({
    totalSeconds: 3600,
    recordedTimes: 2,
    rated: 1,
    platinumEligible: 2,
    featured: game,
    topRated: [game],
    recentlyCompleted: [],
  });
  render(
    <Home
      revision={0}
      dashboard={{
        total: 3,
        completed: 1,
        playing: 1,
        platinum: 1,
        averageRating: 4,
      }}
      onOpen={vi.fn()}
      onLibrary={vi.fn()}
    />,
  );
  await screen.findByText('Adventure', { selector: 'h2' });
  expect(screen.getByText('Your rating 4/5')).toBeInTheDocument();
  expect(screen.getByText('IGDB community 92/100')).toBeInTheDocument();
  expect(screen.getByText('50%')).toBeInTheDocument();
  expect(screen.getByText(/1 of 2 eligible games/)).toBeInTheDocument();
  expect(
    screen.getByText(/Playtime recorded for 2 of 3 games/),
  ).toBeInTheDocument();
  expect(screen.getByText('1h 0m')).toBeInTheDocument();
});
test('an empty library does not invent ratings, activity or a platinum percentage', async () => {
  vi.mocked(invoke).mockResolvedValue({
    totalSeconds: 0,
    recordedTimes: 0,
    rated: 0,
    platinumEligible: 0,
    featured: null,
    topRated: [],
    recentlyCompleted: [],
  });
  render(
    <Home
      revision={0}
      dashboard={{
        total: 0,
        completed: 0,
        playing: 0,
        platinum: 0,
        averageRating: null,
      }}
      onOpen={vi.fn()}
      onLibrary={vi.fn()}
    />,
  );
  await screen.findByText('Every game has a story.');
  expect(screen.queryByText('0%')).not.toBeInTheDocument();
  expect(screen.getByText('Not rated')).toBeInTheDocument();
  expect(
    screen.getByText(/Completed games with a recorded finish date/),
  ).toBeInTheDocument();
});
