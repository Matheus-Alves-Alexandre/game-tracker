import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowUpRight, Clock3, Star, Trophy, Gamepad2 } from 'lucide-react';
import { libraryApi, formatPlaytime, statusLabel } from './library-api';
import type { Dashboard, Game, HomeData } from './library-api';
import Cover from './Cover';

export default function Home({
  revision,
  dashboard,
  onOpen,
  onLibrary,
}: {
  revision: number;
  dashboard: Dashboard | null;
  onOpen: (game: Game, opener: HTMLButtonElement) => void;
  onLibrary: () => void;
}) {
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    void libraryApi
      .home()
      .then((value) => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active)
          setError(
            'Could not load your home. Your library is still available.',
          );
      });
    return () => {
      active = false;
    };
  }, [revision, retry]);
  const featured = data?.featured;
  const stats = data?.dashboard ?? dashboard;
  const eligible = data?.platinumEligible ?? 0;
  const achieved = stats?.platinum ?? 0;
  const platinumPercent = eligible
    ? Math.round((100 * achieved) / eligible)
    : 0;
  return (
    <div className="home-dashboard">
      {error && (
        <p role="alert">
          {error}{' '}
          <button onClick={() => setRetry((value) => value + 1)}>
            Retry home
          </button>
        </p>
      )}
      <div className="home-content">
        <section className="featured-game" aria-label="Featured game">
          <div className="feature-copy">
            <span className="feature-label">
              <Gamepad2 size={14} />
              {featured
                ? statusLabel(featured.status)
                : 'Your collection starts here'}
            </span>
            <p className="eyebrow">IN YOUR LIBRARY</p>
            <h2>{featured?.title ?? 'Every game has a story.'}</h2>
            <p>
              {featured
                ? featured.status === 'completed'
                  ? 'A finished chapter worth remembering. Keep your score and the moments that stayed with you.'
                  : 'Keep your progress, memories and next goals together.'
                : 'Add your first game, keep your own scores and build a library that stays with you.'}
            </p>
            {featured && (
              <>
                <div className="feature-scores">
                  <span>
                    <Star size={15} />
                    {featured.rating == null
                      ? 'Not rated yet'
                      : `Your rating ${featured.rating}/5`}
                  </span>
                  <span>
                    {featured.igdbRating == null
                      ? 'IGDB not linked'
                      : `IGDB community ${featured.igdbRating.toFixed(0)}/100`}
                  </span>
                </div>
                <button
                  className="primary"
                  onClick={(event) => onOpen(featured, event.currentTarget)}
                >
                  Open game <ArrowUpRight size={17} />
                </button>
              </>
            )}
          </div>
          <Cover imageId={featured?.coverImageId} className="feature-cover" />
        </section>
        <section className="home-section" aria-label="Your top-rated games">
          <div className="section-title">
            <div>
              <p className="eyebrow">YOUR PICKS</p>
              <h3>Your top-rated games</h3>
            </div>
            <button className="text-button" onClick={onLibrary}>
              View library <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="rated-grid">
            {data?.topRated?.length ? (
              data.topRated.map((game) => (
                <button
                  className="rated-card"
                  key={game.id}
                  onClick={(event) => onOpen(game, event.currentTarget)}
                >
                  <Cover imageId={game.coverImageId} />
                  <span className="card-rating">
                    <Star size={13} />
                    {game.rating}/5
                  </span>
                  <strong>{game.title}</strong>
                  <small>{game.platform || 'Platform not set'}</small>
                </button>
              ))
            ) : (
              <p className="home-empty">
                Your personal ratings will appear here. Rate a game in its edit
                popup.
              </p>
            )}
          </div>
        </section>
        <section className="home-section" aria-label="Recently completed games">
          <div className="section-title">
            <div>
              <p className="eyebrow">THE FINISH LINE</p>
              <h3>Recently completed</h3>
            </div>
          </div>
          <div className="completed-list">
            {data?.recentlyCompleted?.length ? (
              data.recentlyCompleted.map((game) => (
                <button
                  key={game.id}
                  onClick={(event) => onOpen(game, event.currentTarget)}
                >
                  <Cover imageId={game.coverImageId} />
                  <span>
                    <strong>{game.title}</strong>
                    <small>Finished {game.completedOn}</small>
                  </span>
                  <span className="completed-time">
                    {formatPlaytime(game.playtimeSeconds)}
                  </span>
                  <ArrowUpRight size={18} />
                </button>
              ))
            ) : (
              <p className="home-empty">
                Completed games with a recorded finish date will appear here.
              </p>
            )}
          </div>
        </section>
      </div>
      <aside className="home-statistics" aria-label="Your statistics">
        <div className="section-title">
          <h3>Your statistics</h3>
          <Trophy size={18} />
        </div>
        <div
          className="platinum-ring"
          style={{ '--progress': `${platinumPercent}%` } as CSSProperties}
        >
          <div>
            <Trophy size={23} />
            <strong>{eligible ? `${platinumPercent}%` : '—'}</strong>
            <span>Platinum achieved</span>
          </div>
        </div>
        <p className="ring-caption">
          {data
            ? `${achieved} of ${eligible} eligible games. Games marked “Not applicable” are excluded.`
            : 'Loading your statistics…'}
        </p>
        <dl className="home-metrics">
          <div>
            <dt>
              <Gamepad2 size={17} />
              Library
            </dt>
            <dd>{stats?.total ?? '—'} games</dd>
          </div>
          <div>
            <dt>
              <Clock3 size={17} />
              Recorded playtime
            </dt>
            <dd>{data ? formatPlaytime(data.totalSeconds) : '—'}</dd>
          </div>
          <div>
            <dt>
              <Star size={17} />
              Your average rating
            </dt>
            <dd>
              {stats?.averageRating == null
                ? 'Not rated'
                : `${stats.averageRating.toFixed(2)}/5`}
            </dd>
          </div>
        </dl>
        <div className="coverage-note">
          <strong>Your data, clearly counted.</strong>
          <p>
            Playtime recorded for {data?.recordedTimes ?? 0} of{' '}
            {stats?.total ?? 0} games. {data?.rated ?? 0} games rated. Missing
            values are never counted as zero.
          </p>
        </div>
        <small>
          Stats cover your active library. Archived games are excluded. IGDB
          community scores are separate from your own ratings.
        </small>
      </aside>
    </div>
  );
}
