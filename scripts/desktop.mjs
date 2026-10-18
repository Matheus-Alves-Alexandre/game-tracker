import { spawn } from 'node:child_process';
import path from 'node:path';
import { toolchainEnvironment } from './environment.mjs';

const child = spawn(
  process.execPath,
  [
    path.resolve('node_modules/@tauri-apps/cli/tauri.js'),
    ...process.argv.slice(2),
  ],
  {
    env: toolchainEnvironment(),
    stdio: 'inherit',
  },
);
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
