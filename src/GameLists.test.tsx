import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { listsApi } from './library-api';
import GameLists from './GameLists';
vi.mock('./library-api', () => ({
  listsApi: {
    all: vi.fn(),
    members: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    complete: vi.fn(),
  },
  libraryApi: { list: vi.fn(), archive: vi.fn() },
}));
const game = {
  id: 'g1',
  title: 'Devil May Cry',
  platform: 'PC',
  status: 'planned',
  rating: 5,
  playtimeSeconds: 600,
  completedOn: null,
  platinumStatus: 'planned',
  notes: 'My notes',
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listsApi.all).mockResolvedValue([
    { id: 'saga', name: 'DMC saga', total: 2, completed: 1 },
  ]);
  vi.mocked(listsApi.members).mockResolvedValue([game] as never);
});

test('list deletion requires popup confirmation and supports cancel and Escape', async () => {
  const user = userEvent.setup();
  const changed = vi.fn();
  render(<GameLists revision={0} onChanged={changed} onEdit={vi.fn()} />);
  await user.click(await screen.findByRole('button', { name: /DMC saga/ }));
  const opener = screen.getByRole('button', { name: 'Delete list' });
  await user.click(opener);
  const dialog = screen.getByRole('dialog', { name: 'Delete list?' });
  expect(
    within(dialog).getByText(
      /Your library games, notes and progress will be kept/,
    ),
  ).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
  expect(listsApi.delete).not.toHaveBeenCalled();
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
  await user.click(opener);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(listsApi.delete).not.toHaveBeenCalled();
  let finish!: () => void;
  vi.mocked(listsApi.delete).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await user.click(opener);
  await user.click(screen.getByRole('button', { name: 'Confirm delete list' }));
  expect(listsApi.delete).toHaveBeenCalledExactlyOnceWith('saga');
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  await user.keyboard('{Escape}');
  expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true');
  await act(async () => finish());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(changed).toHaveBeenCalled();
});

test('failed deletion leaves the popup open with a retryable error', async () => {
  const user = userEvent.setup();
  vi.mocked(listsApi.delete).mockRejectedValue('Could not delete list');
  const changed = vi.fn();
  render(<GameLists revision={0} onChanged={changed} onEdit={vi.fn()} />);
  await user.click(await screen.findByRole('button', { name: /DMC saga/ }));
  await user.click(screen.getByRole('button', { name: 'Delete list' }));
  await user.click(screen.getByRole('button', { name: 'Confirm delete list' }));
  const dialog = screen.getByRole('dialog');
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Could not delete list',
  );
  expect(
    within(dialog).getByRole('button', { name: 'Confirm delete list' }),
  ).toBeEnabled();
  expect(changed).not.toHaveBeenCalled();
});
test('shows progress and only changes the shared completion flag through IPC', async () => {
  const user = userEvent.setup();
  const changed = vi.fn();
  render(<GameLists revision={0} onChanged={changed} onEdit={vi.fn()} />);
  await user.click(await screen.findByRole('button', { name: /DMC saga/ }));
  expect(await screen.findByText('50% completed')).toBeInTheDocument();
  expect(
    screen.getByText('1 remaining · 1 of 2 completed'),
  ).toBeInTheDocument();
  await user.click(
    await screen.findByRole('checkbox', { name: 'Completed Devil May Cry' }),
  );
  expect(listsApi.complete).toHaveBeenCalledWith('saga', 'g1', true);
  expect(changed).toHaveBeenCalled();
});
test('creates a named list and adds a planned game without requiring catalog credentials', async () => {
  const user = userEvent.setup();
  vi.mocked(listsApi.save).mockResolvedValue('saga');
  render(<GameLists revision={0} onChanged={vi.fn()} onEdit={vi.fn()} />);
  await user.type(screen.getByLabelText('New list name'), 'DMC saga');
  await user.click(screen.getByRole('button', { name: 'Create list' }));
  expect(listsApi.save).toHaveBeenCalledWith(null, 'DMC saga');
  await user.click(await screen.findByText('Add games to this list'));
  await user.type(screen.getByLabelText('Game title'), 'Devil May Cry 3');
  await user.type(screen.getByLabelText('Game platform'), 'PC');
  await user.click(screen.getByRole('button', { name: 'Add game to list' }));
  await waitFor(() =>
    expect(listsApi.add).toHaveBeenCalledWith(
      'saga',
      null,
      'Devil May Cry 3',
      'PC',
    ),
  );
});
test('failed completion stays unchecked and reports a recoverable error', async () => {
  const user = userEvent.setup();
  vi.mocked(listsApi.complete).mockRejectedValue('Database unavailable');
  render(<GameLists revision={0} onChanged={vi.fn()} onEdit={vi.fn()} />);
  await user.click(await screen.findByRole('button', { name: /DMC saga/ }));
  const checkbox = await screen.findByRole('checkbox', {
    name: 'Completed Devil May Cry',
  });
  await user.click(checkbox);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Database unavailable',
  );
  expect(checkbox).not.toBeChecked();
});
