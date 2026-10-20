import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function previewVersion(base, runNumber) {
  if (!/^\d+\.\d+\.\d+$/.test(base) || !/^\d+$/.test(String(runNumber)))
    throw new Error('Invalid base version or CI run number.');
  const number = Number(runNumber);
  if (!Number.isSafeInteger(number) || number < 1 || number > 65535)
    throw new Error(
      'Preview number must fit the Windows installer version (1–65535).',
    );
  return `${base}-alpha.${number}`;
}

export async function preparePreview(root, runNumber) {
  const read = (name) => fs.readFile(path.join(root, name), 'utf8');
  const [packageText, lockText, tauriText, cargo, cargoLock] =
    await Promise.all([
      read('package.json'),
      read('package-lock.json'),
      read('src-tauri/tauri.conf.json'),
      read('src-tauri/Cargo.toml'),
      read('src-tauri/Cargo.lock'),
    ]);
  const pkg = JSON.parse(packageText);
  const lock = JSON.parse(lockText);
  const tauri = JSON.parse(tauriText);
  const cargoPattern = /^(version = ")[^"]+("\s*)$/m;
  const lockPattern =
    /(\[\[package\]\]\r?\nname = "game-tracker"\r?\nversion = ")[^"]+("\r?\n)/;
  if (
    tauri.version !== pkg.version ||
    lock.version !== pkg.version ||
    lock.packages[''].version !== pkg.version ||
    !cargo.match(cargoPattern)?.[0].includes(`version = "${pkg.version}"`) ||
    !cargoLock.match(lockPattern)?.[0].includes(`version = "${pkg.version}"`)
  )
    throw new Error('Package versions must match before preparing a preview.');
  const version = previewVersion(pkg.version, runNumber);
  pkg.version =
    lock.version =
    lock.packages[''].version =
    tauri.version =
      version;
  const files = {
    'package.json': JSON.stringify(pkg, null, 2) + '\n',
    'package-lock.json': JSON.stringify(lock, null, 2) + '\n',
    'src-tauri/tauri.conf.json': JSON.stringify(tauri, null, 2) + '\n',
    'src-tauri/Cargo.toml': cargo.replace(cargoPattern, `$1${version}$2`),
    'src-tauri/Cargo.lock': cargoLock.replace(lockPattern, `$1${version}$2`),
  };
  for (const [name, content] of Object.entries(files))
    await fs.writeFile(path.join(root, name), content);
  return version;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  console.log(await preparePreview(process.cwd(), process.env.CI_RUN_NUMBER));
