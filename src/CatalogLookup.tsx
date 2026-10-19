import { useEffect, useRef, useState } from 'react';
import { Search, PlugZap } from 'lucide-react';
import { catalogApi } from './library-api';
import type { Candidate } from './library-api';

export function CatalogConnection() {
  const [client, setClient] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    void catalogApi
      .connected()
      .then(setConnected)
      .catch(() => {});
  }, []);
  async function connect() {
    setBusy(true);
    setError('');
    try {
      const pending = catalogApi.connect(client.trim(), secret.trim());
      setSecret('');
      await pending;
      setClient('');
      setConnected(true);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="catalog-connection" aria-label="IGDB connection">
      <details className="credential-guide">
        <summary>How to get Twitch credentials</summary>
        <p>
          Create a Confidential application in the Twitch developer console,
          enable two-factor authentication and use http://localhost as its
          redirect URL. Paste its Client ID and Client Secret below.
        </p>
        <button
          type="button"
          onClick={() => {
            void catalogApi.setup().catch((reason) => setError(String(reason)));
          }}
        >
          Open Twitch developer console ↗
        </button>
      </details>
      <p>
        Connect your own Twitch developer application to search IGDB.
        Credentials are used only for this session. The secret is not saved;
        closing the app disconnects it.
      </p>
      {connected ? (
        <>
          <p role="status">Connected to IGDB for this session.</p>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await catalogApi.disconnect();
                setConnected(false);
              } catch (reason) {
                setError(String(reason));
              } finally {
                setBusy(false);
              }
            }}
          >
            Disconnect IGDB
          </button>
        </>
      ) : (
        <>
          <label>
            Client ID
            <input
              autoComplete="off"
              spellCheck={false}
              value={client}
              onChange={(event) => setClient(event.target.value)}
              maxLength={256}
            />
          </label>
          <label>
            Client Secret
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              maxLength={256}
            />
          </label>
          <button
            type="button"
            className="primary"
            disabled={busy || !client.trim() || !secret.trim()}
            onClick={connect}
          >
            <PlugZap size={16} />
            {busy ? 'Connecting…' : 'Connect to IGDB'}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <small>
        Metadata and artwork from IGDB. Network requests happen only when you
        connect, search or choose a cover.
      </small>
    </section>
  );
}

export default function CatalogLookup({
  title,
  onSelect,
}: {
  title: string;
  onSelect: (candidate: Candidate) => void;
}) {
  const [query, setQuery] = useState(title.slice(0, 120));
  const [connected, setConnected] = useState(false);
  const [results, setResults] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const current = useRef(0);
  useEffect(() => {
    void catalogApi
      .connected()
      .then(setConnected)
      .catch(() => {});
    return () => {
      current.current++;
    };
  }, []);
  async function search() {
    if (busy) return;
    const request = ++current.current;
    setBusy(true);
    setError('');
    setResults([]);
    setSearched(false);
    try {
      const items = await catalogApi.search(query);
      if (current.current === request) {
        setResults(items);
        setSearched(true);
      }
    } catch (reason) {
      if (current.current === request) setError(String(reason));
    } finally {
      if (current.current === request) setBusy(false);
    }
  }
  async function choose(candidate: Candidate) {
    if (busy) return;
    setBusy(true);
    setError('');
    const request = ++current.current;
    try {
      if (candidate.coverImageId)
        await catalogApi.cacheCover(candidate.coverImageId);
      if (current.current === request) {
        onSelect(candidate);
        setResults([]);
        setSearched(false);
      }
    } catch (reason) {
      if (current.current === request) setError(String(reason));
    } finally {
      if (current.current === request) setBusy(false);
    }
  }
  return (
    <details className="catalog-lookup">
      <summary>Find a game & cover on IGDB</summary>
      {!connected ? (
        <p>
          Connect Twitch / IGDB in Settings → Integrations before searching. You
          can save this game manually, then return to Settings to connect.
        </p>
      ) : (
        <>
          <p>
            Choose the correct edition. Your platform, progress, rating and
            notes will stay unchanged. Save the editor to keep the selection.
          </p>
          <label>
            Search IGDB
            <input
              value={query}
              maxLength={120}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void search();
                }
              }}
            />
          </label>
          <button
            type="button"
            disabled={busy || query.trim().length < 2}
            onClick={search}
          >
            <Search size={16} />
            {busy ? 'Working…' : 'Search IGDB'}
          </button>
          {searched && !results.length && (
            <p role="status">No matching games. Try another title.</p>
          )}
          <div className="catalog-results">
            {results.map((candidate) => (
              <button
                type="button"
                className="catalog-candidate"
                key={candidate.id}
                disabled={busy}
                onClick={() => choose(candidate)}
              >
                {candidate.coverImageId && (
                  <img
                    loading="lazy"
                    width="64"
                    height="90"
                    alt=""
                    src={`https://images.igdb.com/igdb/image/upload/t_cover_small/${candidate.coverImageId}.jpg`}
                  />
                )}
                <span>
                  <strong>{candidate.name}</strong>
                  <small>
                    {candidate.releasedAt
                      ? new Date(candidate.releasedAt * 1000).getUTCFullYear()
                      : 'Release date unknown'}{' '}
                    · {candidate.platforms.join(', ') || 'Platforms unknown'}
                  </small>
                  <small>
                    {candidate.communityRating === null
                      ? 'No IGDB community rating'
                      : `IGDB community: ${candidate.communityRating.toFixed(0)}/100 (${candidate.ratingCount} ratings)`}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error} You can reconnect in Settings → Integrations or keep editing
          offline.
        </p>
      )}
    </details>
  );
}
