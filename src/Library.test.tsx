import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import Library from './Library';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);
beforeEach(() => {
  mockInvoke.mockImplementation(async (command) => {
    if (command === 'list_games') return [] as never;
    if (command === 'get_dashboard')
      return {
        total: 0,
        completed: 0,
        playing: 0,
        platinum: 0,
        averageRating: null,
      } as never;
    return undefined as never;
  });
});
test('submits minutes as seconds and leaves an unrated game unknown', async () => {
  const user = userEvent.setup();
  render(<Library />);
  await screen.findByText('Your next chapter starts here');
  await user.click(screen.getByRole('button', { name: '+ Add game' }));
  await user.type(screen.getByLabelText('Title'), 'Celeste');
  await user.type(screen.getByLabelText('Playtime (total minutes)'), '90');
  await user.click(screen.getByRole('button', { name: 'Save game' }));
  await waitFor(() =>
    expect(mockInvoke).toHaveBeenCalledWith('save_game', {
      input: expect.objectContaining({
        title: 'Celeste',
        playtimeSeconds: 5400,
        rating: null,
        completedOn: null,
      }),
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
});
test('keeps unsaved input visible when persistence fails', async () => {
  mockInvoke.mockImplementation(async (command) => {
    if (command === 'save_game') throw new Error('Disk is full');
    if (command === 'list_games') return [] as never;
    return {
      total: 0,
      completed: 0,
      playing: 0,
      platinum: 0,
      averageRating: null,
    } as never;
  });
  const user = userEvent.setup();
  render(<Library />);
  await user.click(screen.getByRole('button', { name: '+ Add game' }));
  await user.type(screen.getByLabelText('Title'), 'Unsaved game');
  await user.click(screen.getByRole('button', { name: 'Save game' }));
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('Disk is full'),
  );
  expect(screen.getByLabelText('Title')).toHaveValue('Unsaved game');
});
test('retries a failed library read', async () => {
  mockInvoke.mockRejectedValueOnce(new Error('Library unavailable'));
  const user = userEvent.setup();
  render(<Library />);
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('Your next chapter starts here');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
