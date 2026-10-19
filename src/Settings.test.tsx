import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import Library from './Library';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);
beforeEach(() => {
  mockInvoke.mockImplementation(async (command) => {
    if (command === 'list_games') return [] as never;
    if (command === 'igdb_connected') return false as never;
    if (command === 'get_home')
      return {
        totalSeconds: 0,
        recordedTimes: 0,
        rated: 0,
        platinumEligible: 0,
        featured: null,
        topRated: [],
        recentlyCompleted: [],
      } as never;
    return {
      total: 0,
      completed: 0,
      playing: 0,
      platinum: 0,
      averageRating: null,
    } as never;
  });
});

test('settings centralizes Twitch credentials and describes Steam without collecting an unused key', async () => {
  const user = userEvent.setup();
  render(<Library initialView="library" />);
  await user.click(screen.getByRole('button', { name: 'Settings' }));
  const settings = screen.getByRole('region', { name: 'Application settings' });
  expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(within(settings).getByLabelText('Client ID')).toBeInTheDocument();
  expect(within(settings).getByLabelText('Client Secret')).toHaveAttribute(
    'type',
    'password',
  );
  const steam = within(settings).getByRole('region', { name: 'Steam' });
  expect(within(steam).getByText('Coming soon')).toBeInTheDocument();
  expect(within(steam).queryByRole('textbox')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Archived games' }));
  await screen.findByText('No archived games');
  expect(
    screen.queryByRole('region', { name: 'Application settings' }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Home' }));
  expect(
    screen.getByRole('heading', { name: 'Welcome back, player.' }),
  ).toBeInTheDocument();
});

test('leaving settings discards an unsubmitted secret without sending it', async () => {
  const user = userEvent.setup();
  render(<Library initialView="library" />);
  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.type(screen.getByLabelText('Client Secret'), 'syntheticSecret');
  await user.click(screen.getByRole('button', { name: 'Library' }));
  await user.click(screen.getByRole('button', { name: 'Settings' }));
  expect(screen.getByLabelText('Client Secret')).toHaveValue('');
  expect(
    mockInvoke.mock.calls.some(([command]) => command === 'connect_igdb'),
  ).toBe(false);
});

test('a disconnected game editor directs the user to Settings without collecting credentials there', async () => {
  const user = userEvent.setup();
  render(<Library initialView="library" />);
  await user.click(screen.getByRole('button', { name: '+ Add game' }));
  await user.type(screen.getByLabelText('Title'), 'My draft');
  await user.click(screen.getByText('Find a game & cover on IGDB'));
  expect(
    screen.getByText(/Connect Twitch \/ IGDB in Settings/),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText('Client Secret')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Title')).toHaveValue('My draft');
});
