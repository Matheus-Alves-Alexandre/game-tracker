export const repository = 'Matheus-Alves-Alexandre/game-tracker';
export const installerName = 'game-tracker-windows-x64-setup.exe';
const releasesUrl = `https://github.com/${repository}/releases`;

export function findInstaller(release) {
  if (release.draft || release.prerelease || !Array.isArray(release.assets))
    return null;
  const asset = release.assets.find((item) => item.name === installerName);
  if (!asset || !Number.isFinite(asset.size) || asset.size <= 0) return null;
  const url = new URL(asset.browser_download_url);
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
      `https://api.github.com/repos/${repository}/releases/latest`,
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
    const release = await response.json();
    const installer = findInstaller(release);
    if (!installer) throw new Error('No verified Windows installer available');
    version.textContent = `${release.tag_name} · WINDOWS X64`;
    status.textContent = `${(installer.size / (1024 * 1024)).toFixed(1)} MB installer · Download the latest published version.`;
    button.href = `${releasesUrl}/latest/download/${installerName}`;
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
