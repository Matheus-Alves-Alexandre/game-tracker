import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  formatPlaytime,
  libraryApi,
  statuses,
  statusLabel,
} from './library-api';
import type { Dashboard, Game, GameInput, Status } from './library-api';
import license from '../LICENSE?raw';
import './library.css';
import Modal from './Modal';

const emptyGame: GameInput = {
  id: null,
  title: '',
  platform: '',
  status: 'planned',
  rating: null,
  playtimeSeconds: null,
  completedOn: null,
  platinumStatus: 'not_achieved',
  notes: '',
};
export default function Library() {
  const [games, setGames] = useState<Game[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<GameInput | null>(null);
  const [about, setAbout] = useState(false);
  const [archived, setArchived] = useState<Game | null>(null);
  const [archiveView, setArchiveView] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      () => {
        setLoading(true);
        setError('');
        Promise.all([
          libraryApi.list(search, status, offset, archiveView),
          libraryApi.dashboard(),
        ])
          .then(([items, stats]) => {
            if (active) {
              setGames(items);
              setDashboard(stats);
            }
          })
          .catch((reason: unknown) => {
            if (active) setError(String(reason));
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      },
      search ? 200 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, status, offset, revision, archiveView]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editor || saving) return;
    setSaving(true);
    setError('');
    try {
      await libraryApi.save(editor);
      setLoading(true);
      setEditor(null);
      setRevision((value) => value + 1);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  }
  async function archive(game: Game, value: boolean) {
    if (archiving) return;
    setArchiving(true);
    setError('');
    try {
      await libraryApi.archive(game.id, value);
      setLoading(true);
      setArchived(value ? game : null);
      setOffset(0);
      setRevision((v) => v + 1);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setArchiving(false);
    }
  }
  async function support() {
    try {
      await libraryApi.support();
    } catch (reason) {
      setError(String(reason));
    }
  }
  function change<K extends keyof GameInput>(key: K, value: GameInput[K]) {
    setEditor((current) => (current ? { ...current, [key]: value } : current));
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" inert={editor !== null || about}>
        <div className="brand-mark" aria-hidden="true">
          GT
        </div>
        <h1>Game Tracker</h1>
        <p className="muted">Your games. Your journey.</p>
        <nav aria-label="Main navigation">
          <button
            className={!archiveView ? 'nav-active' : ''}
            aria-current={!archiveView ? 'page' : undefined}
            onClick={() => {
              if (!archiveView) return;
              setArchiveView(false);
              setOffset(0);
              setLoading(true);
            }}
          >
            Library
          </button>
          <button
            className={archiveView ? 'nav-active' : ''}
            aria-current={archiveView ? 'page' : undefined}
            onClick={() => {
              if (archiveView) return;
              setArchiveView(true);
              setOffset(0);
              setLoading(true);
            }}
          >
            Archived games
          </button>
          <button
            onClick={(event) => {
              opener.current = event.currentTarget;
              setAbout(true);
            }}
          >
            About & support
          </button>
        </nav>
        <div className="local-note">
          <span className="status-dot" /> Local library
          <br />
          <small>Stored on this computer</small>
        </div>
      </aside>
      <main inert={editor !== null || about}>
        <header>
          <div>
            <p className="eyebrow">YOUR COLLECTION</p>
            <h2>Make room for your next adventure.</h2>
            <p className="muted">
              Keep track of what you play, finish, and come back to.
            </p>
          </div>
          <button
            className="primary"
            onClick={(event) => {
              opener.current = event.currentTarget;
              setError('');
              setEditor({ ...emptyGame });
            }}
          >
            + Add game
          </button>
        </header>
        <section className="stats" aria-label="Library overview">
          {[
            ['Games', dashboard?.total],
            ['Completed', dashboard?.completed],
            ['Playing', dashboard?.playing],
            ['Platinum', dashboard?.platinum],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value ?? '—'}</strong>
            </div>
          ))}
        </section>
        {error && !editor && !about && (
          <div className="error" role="alert">
            {error}{' '}
            {!editor && (
              <button onClick={() => setRevision((v) => v + 1)}>Retry</button>
            )}
          </div>
        )}
        {archived && (
          <div className="notice" role="status">
            Archived {archived.title}.{' '}
            <button
              disabled={archiving}
              onClick={() => archive(archived, false)}
            >
              Undo archive
            </button>
          </div>
        )}
        <section className="library" aria-label="Game library">
          <div className="toolbar">
            <h3>{archiveView ? 'Archived games' : 'Library'}</h3>
            <label className="search-label">
              Search games
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setLoading(true);
                  setSearch(event.target.value);
                  setOffset(0);
                }}
                placeholder="Search title or platform"
              />
            </label>
            <label>
              Status filter
              <select
                value={status}
                onChange={(event) => {
                  setLoading(true);
                  setStatus(event.target.value);
                  setOffset(0);
                }}
              >
                <option value="">All statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {loading ? (
            <p role="status" className="empty">
              Loading your library…
            </p>
          ) : games.length === 0 ? (
            <div className="empty">
              <h3>
                {search || status
                  ? 'No matching games'
                  : archiveView
                    ? 'No archived games'
                    : 'Your next chapter starts here'}
              </h3>
              <p>
                {search || status
                  ? 'Try a different search or status.'
                  : archiveView
                    ? 'Archived games stay here until you restore them.'
                    : 'Add your first game to start building your library.'}
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>Status</th>
                    <th>Playtime</th>
                    <th>Rating</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((game) => (
                    <tr key={game.id}>
                      <td>
                        <button
                          className="game-title"
                          disabled={archiveView}
                          onClick={(event) => {
                            opener.current = event.currentTarget;
                            setError('');
                            setEditor({ ...game });
                          }}
                        >
                          {game.title}
                        </button>
                        <small>{game.platform || 'Platform not set'}</small>
                      </td>
                      <td>
                        <span className={`pill ${game.status}`}>
                          {statusLabel(game.status)}
                        </span>
                      </td>
                      <td>{formatPlaytime(game.playtimeSeconds)}</td>
                      <td>
                        {game.rating === null
                          ? 'Not rated'
                          : `${game.rating}/5`}
                      </td>
                      <td>
                        <button
                          aria-label={`${archiveView ? 'Restore' : 'Archive'} ${game.title}`}
                          disabled={archiving}
                          onClick={() => archive(game, !archiveView)}
                        >
                          {archiveView ? 'Restore' : 'Archive'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <footer>
            <small>
              {dashboard?.averageRating == null
                ? 'No ratings yet'
                : `Average rating: ${dashboard.averageRating.toFixed(2)}/5`}{' '}
              · 100 games per page
            </small>
            <div>
              <button
                disabled={offset === 0 || loading}
                onClick={() => setOffset((v) => v - 100)}
              >
                Previous
              </button>
              <button
                disabled={games.length < 100 || loading}
                onClick={() => setOffset((v) => v + 100)}
              >
                Next
              </button>
            </div>
          </footer>
        </section>
      </main>
      {editor && (
        <Modal
          returnFocusTo={opener.current}
          labelId="editor-title"
          busy={saving}
          onClose={() => setEditor(null)}
        >
          <h2 id="editor-title">{editor.id ? 'Edit game' : 'Add game'}</h2>
          <form onSubmit={save}>
            <label>
              Title
              <input
                name="title"
                required
                maxLength={300}
                value={editor.title}
                onChange={(e) => change('title', e.target.value)}
              />
            </label>
            <div className="form-grid">
              <label>
                Platform
                <input
                  name="platform"
                  maxLength={100}
                  placeholder="PC, PlayStation, Switch…"
                  value={editor.platform}
                  onChange={(e) => change('platform', e.target.value)}
                />
              </label>
              <label>
                Status
                <select
                  name="status"
                  value={editor.status}
                  onChange={(e) => {
                    change('status', e.target.value as Status);
                    if (e.target.value !== 'completed')
                      change('completedOn', null);
                  }}
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Rating
                <select
                  name="rating"
                  value={editor.rating ?? ''}
                  onChange={(e) =>
                    change(
                      'rating',
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                >
                  <option value="">Not rated</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}/5
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Playtime (total minutes)
                <input
                  name="minutes"
                  type="number"
                  min="0"
                  max="60000000"
                  step="1"
                  value={
                    editor.playtimeSeconds === null
                      ? ''
                      : Math.floor(editor.playtimeSeconds / 60)
                  }
                  onChange={(e) =>
                    change(
                      'playtimeSeconds',
                      e.target.value === ''
                        ? null
                        : Number(e.target.value) * 60,
                    )
                  }
                />
              </label>
              <label>
                Platinum
                <select
                  name="platinum"
                  value={editor.platinumStatus}
                  onChange={(e) => change('platinumStatus', e.target.value)}
                >
                  <option value="not_achieved">Not achieved</option>
                  <option value="planned">Planning to achieve</option>
                  <option value="achieved">Achieved</option>
                  <option value="not_applicable">Not applicable</option>
                </select>
              </label>
              <label>
                Completion date
                <input
                  name="completedOn"
                  type="date"
                  disabled={editor.status !== 'completed'}
                  value={editor.completedOn ?? ''}
                  onChange={(e) =>
                    change('completedOn', e.target.value || null)
                  }
                />
              </label>
            </div>
            <label>
              Notes
              <textarea
                name="notes"
                rows={3}
                maxLength={10000}
                value={editor.notes}
                onChange={(e) => change('notes', e.target.value)}
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditor(null)}
              >
                Cancel
              </button>
              <button className="primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save game'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {about && (
        <Modal
          returnFocusTo={opener.current}
          labelId="about-title"
          onClose={() => setAbout(false)}
        >
          <h2 id="about-title">About Game Tracker</h2>
          <p>
            A local-first game library, built with Rust, Tauri, React and
            SQLite.
          </p>
          <p>Copyright © 2026 Matheus-Alves-Alexandre and contributors.</p>
          <p>
            Licensed under GNU AGPL-3.0-only. You may use, modify and
            redistribute it under that license. Provided without warranty.
          </p>
          <details>
            <summary>Read the license</summary>
            <pre className="license">{license}</pre>
          </details>
          <p>Source code: github.com/Matheus-Alves-Alexandre/game-tracker</p>
          <p>
            Support development with an optional donation. All features remain
            available.
          </p>
          <div className="dialog-actions">
            {error && <p role="alert">{error}</p>}
            <button onClick={() => setAbout(false)}>Close</button>
            <button className="primary" onClick={support}>
              Buy me a coffee ↗
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
