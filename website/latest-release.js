export const repository = 'Matheus-Alves-Alexandre/game-tracker';
export const installerName = 'game-tracker-windows-x64-setup.exe';
const releasesUrl = `https://github.com/${repository}/releases`;

export function findInstaller(release) {
  if (release.draft || !Array.isArray(release.assets)) return null;
  const asset = release.assets.find((item) => item.name === installerName);
  if (!asset || !Number.isFinite(asset.size) || asset.size <= 0) return null;
  let url;
  try {
    url = new URL(asset.browser_download_url);
  } catch {
    return null;
  }
  if (
    url.origin !== 'https://github.com' ||
    !url.pathname.startsWith(`/${repository}/releases/download/`)
  )
    return null;
  return asset;
}

export async function loadLatestRelease(document, fetcher = fetch) {
  const button = document.getElementById('download-button');
  const status = document.getElementById('release-status');
  const version = document.getElementById('release-version');
  try {
    const response = await fetcher(
      `https://api.github.com/repos/${repository}/releases?per_page=30`,
      {
        headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (response.status === 404) {
      button.textContent = 'First release coming soon';
      status.textContent =
        'The source is available now. The first verified installer has not been published yet.';
      return;
    }
    if (!response.ok) throw new Error('Release lookup unavailable');
    const releases = await response.json();
    if (!Array.isArray(releases)) throw new Error('Invalid release response');
    const release = releases.find((item) => findInstaller(item));
    if (!release) {
      button.textContent = 'First release coming soon';
      status.textContent =
        'No Windows installer has been published yet. View the source on GitHub.';
      return;
    }
    const installer = findInstaller(release);
    version.textContent = `${release.tag_name}${release.prerelease ? ' · PREVIEW' : ''} · WINDOWS X64`;
    status.textContent = `${(installer.size / (1024 * 1024)).toFixed(1)} MB installer · ${release.prerelease ? 'Development preview. Early unsigned build; installed apps do not update automatically.' : 'Download the latest published version.'}`;
    button.href = installer.browser_download_url;
    button.textContent = 'Download for Windows ↓';
    button.removeAttribute('aria-disabled');
    button.removeAttribute('tabindex');
  } catch {
    button.href = releasesUrl;
    button.textContent = 'View downloads on GitHub ↗';
    button.removeAttribute('aria-disabled');
    button.removeAttribute('tabindex');
    status.textContent =
      'We could not check the latest version. Open GitHub Releases to see available downloads.';
  }
}

if (typeof document !== 'undefined') void loadLatestRelease(document);
