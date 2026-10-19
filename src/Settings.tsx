import { Gamepad2, Image, PlugZap, ShieldCheck } from 'lucide-react';
import { CatalogConnection } from './CatalogLookup';

export default function Settings() {
  return (
    <section className="settings-page" aria-label="Application settings">
      <aside className="settings-navigation" aria-label="Settings sections">
        <a href="#integration-settings" aria-current="page">
          <PlugZap size={18} />
          Integrations
        </a>
        <p>
          Connect the services you use. Your local library works independently.
        </p>
      </aside>
      <div id="integration-settings" className="settings-content">
        <div className="settings-intro">
          <p className="eyebrow">CONNECTED SERVICES</p>
          <h3>Integrations</h3>
          <p className="muted">
            Manage your game providers and access credentials in one place.
          </p>
        </div>
        <section
          className="integration-card"
          aria-labelledby="twitch-integration-title"
        >
          <header>
            <div className="integration-identity">
              <span className="integration-icon">
                <Image size={23} />
              </span>
              <div>
                <h4 id="twitch-integration-title">Twitch / IGDB</h4>
                <p>Game search, cover artwork and community ratings</p>
              </div>
            </div>
            <span className="integration-badge">Available</span>
          </header>
          <CatalogConnection />
          <div className="integration-privacy">
            <ShieldCheck size={16} />
            <span>
              Session only. Your Client Secret is not saved to the library or
              included in exports.
            </span>
          </div>
        </section>
        <section
          className="integration-card integration-planned"
          aria-labelledby="steam-integration-title"
        >
          <header>
            <div className="integration-identity">
              <span className="integration-icon">
                <Gamepad2 size={23} />
              </span>
              <div>
                <h4 id="steam-integration-title">Steam</h4>
                <p>Library, playtime and achievements</p>
              </div>
            </div>
            <span className="integration-badge planned">Coming soon</span>
          </header>
          <p>
            Steam synchronization is not available yet. Its connection settings
            will appear here when that integration is ready.
          </p>
          <small>No Steam key is requested or stored in this version.</small>
        </section>
      </div>
    </section>
  );
}
