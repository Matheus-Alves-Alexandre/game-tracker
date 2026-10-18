import fs from 'node:fs';
import path from 'node:path';

export function toolchainEnvironment() {
  const env = { ...process.env };
  const file = path.resolve('.tools/toolchain.json');
  if (fs.existsSync(file)) {
    const local = JSON.parse(fs.readFileSync(file, 'utf8'));
    const pathKey =
      Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
    env[pathKey] = [...(local.paths ?? []), env[pathKey] ?? ''].join(
      path.delimiter,
    );
    if (local.cargoHome) env.CARGO_HOME = local.cargoHome;
    if (local.rustupHome) env.RUSTUP_HOME = local.rustupHome;
  }
  return env;
}
