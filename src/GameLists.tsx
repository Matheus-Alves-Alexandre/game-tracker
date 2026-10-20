import { useEffect, useState } from 'react';
import { libraryApi, listsApi } from './library-api';
import type { Game, GameList } from './library-api';
import Cover from './Cover';
import './lists.css';

export default function GameLists({
  revision,
  onChanged,
  onEdit,
}: {
  revision: number;
  onChanged: () => void;
  onEdit: (game: Game, opener: HTMLElement) => void;
}) {
  const [lists, setLists] = useState<GameList[]>([]);
  const [selected, setSelected] = useState('');
  const [members, setMembers] = useState<Game[]>([]);
  const [offset, setOffset] = useState(0);
  const [name, setName] = useState('');
  const [renameName, setRenameName] = useState('');
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Game[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const current = lists.find((list) => list.id === selected);
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      listsApi.all(),
      selected ? listsApi.members(selected, offset) : Promise.resolve([]),
    ])
      .then(([items, games]) => {
        if (active) {
          setLists(items);
          setMembers(games);
        }
      })
      .catch((reason) => {
        if (active) setError(String(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected, offset, revision]);
  useEffect(() => {
    let active = true;
    setResults([]);
    const timer = setTimeout(() => {
      if (!search.trim()) return;
      libraryApi
        .list(search, '', 0, false)
        .then((games) => {
          if (active) setResults(games);
        })
        .catch((reason) => {
          if (active) setError(String(reason));
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, revision]);
  async function mutate(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
      onChanged();
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  }
  const percent = current?.total
    ? Math.floor((current.completed / current.total) * 100)
    : 0;
  return (
    <section
      aria-label="Game lists"
      className="game-lists"
      aria-busy={busy || loading}
    >
      <p className="muted">
        Build a saga checklist or plan your next adventures. Each game stays
        linked to your library.
      </p>
      {error && (
        <div role="alert" className="error">
          {error}{' '}
          <button
            onClick={() => {
              setError('');
              onChanged();
            }}
          >
            Retry
          </button>
        </div>
      )}
      <form
        className="list-create"
        onSubmit={(event) => {
          event.preventDefault();
          void mutate(async () => {
            const id = await listsApi.save(null, name);
            setSelected(id);
            setOffset(0);
            setName('');
          });
        }}
      >
        <label>
          New list name
          <input
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Devil May Cry saga"
          />
        </label>
        <button className="primary" disabled={busy || !name.trim()}>
          Create list
        </button>
      </form>
      <div className="lists-layout">
        <nav aria-label="Your lists" className="list-picker">
          {!lists.length && !loading && (
            <p>No lists yet. Create your first saga above.</p>
          )}
          {lists.map((list) => (
            <button
              key={list.id}
              disabled={busy}
              aria-current={selected === list.id ? 'page' : undefined}
              className={selected === list.id ? 'nav-active' : ''}
              onClick={() => {
                setSelected(list.id);
                setOffset(0);
                setDeleting(false);
                setRenaming(false);
                setSearch('');
              }}
            >
              <strong>{list.name}</strong>
              <small>
                {list.completed} / {list.total} completed
              </small>
            </button>
          ))}
        </nav>
        {current ? (
          <div className="list-detail">
            <div className="toolbar">
              <h3>{current.name}</h3>
              <button
                disabled={busy}
                onClick={() => {
                  setRenaming(!renaming);
                  setRenameName(current.name);
                }}
              >
                Rename list
              </button>
              <button disabled={busy} onClick={() => setDeleting(!deleting)}>
                Delete list
              </button>
            </div>
            {renaming && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutate(async () => {
                    await listsApi.save(selected, renameName);
                    setRenaming(false);
                    setName('');
                  });
                }}
              >
                <label>
                  List name
                  <input
                    required
                    maxLength={120}
                    value={renameName}
                    onChange={(e) => setRenameName(e.target.value)}
                  />
                </label>
                <button disabled={busy}>Save list name</button>
              </form>
            )}
            {deleting && (
              <div className="notice">
                Delete this list? Your library games will be kept.{' '}
                <button
                  disabled={busy}
                  onClick={() =>
                    void mutate(async () => {
                      await listsApi.delete(selected);
                      setSelected('');
                      setDeleting(false);
                    })
                  }
                >
                  Confirm delete list
                </button>
              </div>
            )}
            <div className="list-progress">
              <strong>{percent}% completed</strong>
              <span>
                {current.total - current.completed} remaining ·{' '}
                {current.completed} of {current.total} completed
              </span>
              <progress
                aria-label={`${current.name} completion`}
                max={current.total || 1}
                value={current.completed}
              />
            </div>
            <p className="muted">
              Checking a game marks it Completed in your library and restores it
              if archived. Unchecking returns it to Planned and clears its
              finish date. Dates are entered in Edit game, which also restores
              archived games.
            </p>
            {loading ? (
              <p role="status">Loading list…</p>
            ) : (
              <>
                {!current.total && (
                  <p className="empty">Add games to start this journey.</p>
                )}
                <ul className="list-members">
                  {members.map((game) => (
                    <li key={game.id}>
                      <input
                        type="checkbox"
                        aria-label={`Completed ${game.title}`}
                        checked={game.status === 'completed'}
                        disabled={busy}
                        onChange={(e) =>
                          void mutate(() =>
                            listsApi.complete(
                              selected,
                              game.id,
                              e.target.checked,
                            ),
                          )
                        }
                      />
                      <Cover imageId={game.coverImageId ?? null} />
                      <div>
                        <strong>{game.title}</strong>
                        <small>
                          {game.platform || 'No platform'} · {game.status}
                        </small>
                      </div>
                      <button
                        disabled={busy}
                        onClick={(e) => {
                          const element = e.currentTarget;
                          void mutate(async () => {
                            await libraryApi.archive(game.id, false);
                            onEdit(game, element);
                          });
                        }}
                      >
                        Edit game
                      </button>
                      <button
                        disabled={busy}
                        aria-label={`Remove ${game.title} from list`}
                        onClick={() =>
                          void mutate(async () => {
                            await listsApi.remove(selected, game.id);
                            if (members.length === 1 && offset)
                              setOffset(offset - 100);
                          })
                        }
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="toolbar">
                  <button
                    disabled={busy || offset === 0}
                    onClick={() => setOffset(offset - 100)}
                  >
                    Previous games
                  </button>
                  <span>
                    {current.total
                      ? `${offset + 1}–${Math.min(offset + 100, current.total)} of ${current.total}`
                      : '0 games'}
                  </span>
                  <button
                    disabled={busy || offset + 100 >= current.total}
                    onClick={() => setOffset(offset + 100)}
                  >
                    Next games
                  </button>
                </div>
              </>
            )}
            <details>
              <summary>Add games to this list</summary>
              <label>
                Find an existing library game
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search your library"
                />
              </label>
              {results.map((game) => (
                <div className="toolbar" key={game.id}>
                  <span>
                    {game.title} · {game.platform}
                  </span>
                  <button
                    disabled={busy || members.some((m) => m.id === game.id)}
                    onClick={() =>
                      void mutate(() => listsApi.add(selected, game.id))
                    }
                  >
                    Add to list
                  </button>
                </div>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutate(async () => {
                    await listsApi.add(selected, null, title, platform);
                    setTitle('');
                    setPlatform('');
                  });
                }}
              >
                <h4>Or add a game by name</h4>
                <p className="muted">
                  New games are added to your library as Planned. An existing
                  title and platform will be reused.
                </p>
                <label>
                  Game title
                  <input
                    required
                    maxLength={200}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label>
                  Game platform
                  <input
                    maxLength={100}
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                  />
                </label>
                <button disabled={busy || !title.trim()}>
                  Add game to list
                </button>
              </form>
            </details>
          </div>
        ) : (
          <p className="empty">Choose a list to view its games and progress.</p>
        )}
      </div>
    </section>
  );
}
