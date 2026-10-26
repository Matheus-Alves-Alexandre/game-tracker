import { useEffect, useRef, useState } from 'react';
import { catalogApi } from './library-api';
import { sagaApi } from './saga-api';
import type { SagaGame, SagaGroup } from './saga-api';

function extra(game: SagaGame) {
  const type = game.kind.toLowerCase();
  return (
    game.edition ||
    [
      'dlc',
      'expansion',
      'expanded',
      'bundle',
      'remaster',
      'remake',
      'pack',
      'port',
      'update',
      'mod',
    ].some((word) => type.includes(word))
  );
}
export default function SagaImport({
  listId,
  onChanged,
}: {
  listId: string;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState('');
  const [groups, setGroups] = useState<SagaGroup[]>([]);
  const [group, setGroup] = useState<SagaGroup | null>(null);
  const [games, setGames] = useState<SagaGame[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showExtras, setShowExtras] = useState(false);
  const [platform, setPlatform] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const visible = games.filter((g) => showExtras || !extra(g));
  const chosen = visible.filter((g) => selected.has(g.id));
  async function act(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (reason) {
      setError(String(reason));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function page(item: SagaGroup, offset: number) {
    const result = await sagaApi.games(item, offset);
    setGames((old) =>
      offset
        ? [...new Map([...old, ...result.games].map((g) => [g.id, g])).values()]
        : result.games,
    );
    setNext(result.nextOffset);
    setGroup(item);
  }
  return (
    <details>
      <summary>Find a saga on IGDB</summary>
      <section aria-label="Saga import" aria-busy={busy}>
        <p className="muted">
          Connect Twitch / IGDB in Settings first. Choose a series or franchise,
          then review its games before adding them to this list. Catalog
          membership can be incomplete.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              setGames([]);
              setGroup(null);
              setSelected(new Set());
              setNext(null);
              setGroups([]);
              const found = await sagaApi.search(title);
              setGroups(found);
              if (!found.length)
                setNotice(
                  'No linked sagas found. Try a game title or use manual entry.',
                );
            });
          }}
        >
          <label>
            Saga or game name
            <input
              required
              minLength={2}
              maxLength={120}
              value={title}
              disabled={busy}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Borderlands"
            />
          </label>
          <button disabled={busy || title.trim().length < 2}>
            Search sagas
          </button>
        </form>
        {groups.map((item) => (
          <button
            key={`${item.kind}-${item.id}`}
            disabled={busy}
            onClick={() =>
              void act(async () => {
                setGames([]);
                setGroup(null);
                setNext(null);
                setSelected(new Set());
                await page(item, 0);
              })
            }
          >
            {item.name} ({item.kind})
          </button>
        ))}
        {group && (
          <>
            <h4>{group.name}</h4>
            <label>
              <input
                type="checkbox"
                checked={showExtras}
                disabled={busy}
                onChange={(e) => setShowExtras(e.target.checked)}
              />
              Include DLCs, expansions, remasters, editions and collections
            </label>
            <p>
              {games.length} catalog entries loaded · {chosen.length} selected
              (maximum 100 per import).
            </p>
            {!visible.length && (
              <p>
                No games match this filter. Include extras or load the next
                page.
              </p>
            )}
            <button
              disabled={busy}
              onClick={() =>
                setSelected(new Set(visible.slice(0, 100).map((g) => g.id)))
              }
            >
              Select visible games
            </button>
            <button disabled={busy} onClick={() => setSelected(new Set())}>
              Clear selection
            </button>
            <ul className="list-members">
              {visible.map((game) => (
                <li key={game.id}>
                  <input
                    type="checkbox"
                    aria-label={`Import ${game.name}`}
                    checked={selected.has(game.id)}
                    disabled={
                      busy || (!selected.has(game.id) && chosen.length >= 100)
                    }
                    onChange={(e) =>
                      setSelected((old) => {
                        const updated = new Set(old);
                        if (e.target.checked) updated.add(game.id);
                        else updated.delete(game.id);
                        return updated;
                      })
                    }
                  />
                  {game.coverImageId && (
                    <img
                      loading="lazy"
                      width={45}
                      height={60}
                      alt=""
                      src={`https://images.igdb.com/igdb/image/upload/t_cover_small/${game.coverImageId}.jpg`}
                    />
                  )}
                  <div>
                    <strong>{game.name}</strong>
                    <small>
                      {game.releasedAt
                        ? new Date(game.releasedAt * 1000).getUTCFullYear()
                        : 'Year unknown'}{' '}
                      · {game.kind} ·{' '}
                      {game.platforms.join(', ') || 'Platforms unknown'}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
            {next !== null && next < 2000 && (
              <button
                disabled={busy}
                onClick={() => void act(() => page(group, next))}
              >
                Load more saga games
              </button>
            )}
            {next !== null && next >= 2000 && (
              <p role="status">
                Catalog limit reached (2,000 entries). Try a more specific
                series.
              </p>
            )}
            <label>
              Platform for imported games
              <input
                required
                maxLength={100}
                value={platform}
                disabled={busy}
                onChange={(e) => setPlatform(e.target.value)}
                placeholder="Use your library label, e.g. PC"
              />
            </label>
            <p className="muted">
              Existing games on this platform keep their notes and progress. New
              games start as Planned.
            </p>
            <button
              disabled={
                busy ||
                !chosen.length ||
                !platform.trim() ||
                chosen.length > 100
              }
              onClick={() =>
                void act(async () => {
                  const added = await sagaApi.import(
                    listId,
                    chosen,
                    platform.trim(),
                  );
                  onChanged();
                  setNotice(`${added} games added. Caching selected covers…`);
                  let unavailable = 0;
                  for (const game of chosen)
                    if (game.coverImageId) {
                      if (!mounted.current || unavailable >= 3) break;
                      try {
                        await catalogApi.cacheCover(game.coverImageId);
                      } catch {
                        unavailable++;
                      }
                    }
                  if (!mounted.current) return;
                  onChanged();
                  setSelected(new Set());
                  setNotice(
                    `${added} games added. ${chosen.length - added} already in this list.${unavailable ? ' Some covers could not be cached; games were saved.' : ''}`,
                  );
                })
              }
            >
              Add selected games
            </button>
          </>
        )}
      </section>
    </details>
  );
}
