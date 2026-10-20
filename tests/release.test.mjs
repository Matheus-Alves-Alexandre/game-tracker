import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { preparePreview, previewVersion } from '../scripts/release-version.mjs';

test('preview versions are unique, repeatable and bounded for Windows', () => {
  assert.equal(previewVersion('0.1.0', 42), '0.1.0-alpha.42');
  assert.notEqual(previewVersion('0.1.0', 42), previewVersion('0.1.0', 43));
  for (const number of [undefined, 0, -1, 65536, '42;exit', 1.5])
    assert.throws(() => previewVersion('0.1.0', number));
  assert.throws(() => previewVersion('not-a-version', 1));
});

test('build/source manifests share the preview version without changing dependencies', async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'game-tracker-version-'),
  );
  try {
    const files = [
      'package.json',
      'package-lock.json',
      'src-tauri/Cargo.toml',
      'src-tauri/Cargo.lock',
      'src-tauri/tauri.conf.json',
    ];
    await fs.mkdir(path.join(root, 'src-tauri'));
    for (const file of files)
      await fs.copyFile(
        new URL(`../${file}`, import.meta.url),
        path.join(root, file),
      );
    const before = JSON.parse(
      await fs.readFile(path.join(root, 'package-lock.json')),
    );
    const version = await preparePreview(root, 42);
    const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json')));
    const lock = JSON.parse(
      await fs.readFile(path.join(root, 'package-lock.json')),
    );
    const tauri = JSON.parse(
      await fs.readFile(path.join(root, 'src-tauri/tauri.conf.json')),
    );
    assert.equal(pkg.version, version);
    assert.equal(lock.version, version);
    assert.equal(lock.packages[''].version, version);
    assert.equal(tauri.version, version);
    assert.deepEqual(
      lock.packages['node_modules/react'],
      before.packages['node_modules/react'],
    );
    for (const file of ['src-tauri/Cargo.toml', 'src-tauri/Cargo.lock'])
      assert.ok(
        (await fs.readFile(path.join(root, file), 'utf8')).includes(
          `version = "${version}"`,
        ),
      );
    const manifests = await Promise.all(
      files.map((file) => fs.readFile(path.join(root, file), 'utf8')),
    );
    await assert.rejects(preparePreview(root, 43));
    assert.deepEqual(
      await Promise.all(
        files.map((file) => fs.readFile(path.join(root, file), 'utf8')),
      ),
      manifests,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
