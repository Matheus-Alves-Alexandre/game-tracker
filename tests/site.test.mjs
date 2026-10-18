import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import {
  findInstaller,
  installerName,
  loadLatestRelease,
} from '../website/latest-release.js';

const html = await readFile(
  new URL('../website/index.html', import.meta.url),
  'utf8',
);
const asset = {
  name: installerName,
  size: 2_000_000,
  browser_download_url: `https://github.com/Matheus-Alves-Alexandre/game-tracker/releases/download/v0.1.0/${installerName}`,
};

test('the download points to the stable latest asset after a published release', async () => {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  await loadLatestRelease(document, async () => ({
    ok: true,
    json: async () => ({ tag_name: 'v0.1.0', assets: [asset] }),
  }));
  const button = document.getElementById('download-button');
  assert.equal(button.getAttribute('aria-disabled'), null);
  assert.equal(
    button.href,
    `https://github.com/Matheus-Alves-Alexandre/game-tracker/releases/latest/download/${installerName}`,
  );
  assert.match(
    document.getElementById('release-version').textContent,
    /v0.1.0/,
  );
});
test('the initial site does not offer a broken download before a release exists', async () => {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  await loadLatestRelease(document, async () => ({ status: 404 }));
  assert.equal(
    document.getElementById('download-button').hasAttribute('href'),
    false,
  );
  assert.equal(
    document.getElementById('download-button').getAttribute('aria-disabled'),
    'true',
  );
});
test('release lookup failures keep a useful GitHub fallback', async () => {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  await loadLatestRelease(document, async () => {
    throw new Error('Rate limited');
  });
  assert.equal(
    document.getElementById('download-button').href,
    'https://github.com/Matheus-Alves-Alexandre/game-tracker/releases',
  );
  assert.equal(
    findInstaller({
      assets: [
        { ...asset, browser_download_url: 'https://example.org/untrusted.exe' },
      ],
    }),
    null,
  );
  assert.equal(findInstaller({ prerelease: true, assets: [asset] }), null);
});
