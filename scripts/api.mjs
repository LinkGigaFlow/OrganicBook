// Ejecuta tareas de apps/api usando su entorno virtual (.venv), en Windows, macOS o Linux.
// Uso: node scripts/api.mjs <setup|dev|test>
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'api');
const isWin = process.platform === 'win32';
const venvPython = join(apiDir, '.venv', isWin ? 'Scripts/python.exe' : 'bin/python');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: apiDir, stdio: 'inherit' });
  if (r.error) {
    console.error(r.error.message);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function setup() {
  if (!existsSync(venvPython)) run(isWin ? 'python' : 'python3', ['-m', 'venv', '.venv']);
  run(venvPython, ['-m', 'pip', 'install', '-q', '-e', '.[dev]']);
}

const task = process.argv[2];
if (task === 'setup') {
  setup();
} else {
  if (!existsSync(venvPython)) setup();
  if (task === 'dev') {
    run(venvPython, ['-m', 'uvicorn', 'app.main:app', '--reload', '--port', '8000']);
  } else if (task === 'test') {
    run(venvPython, ['-m', 'pytest', ...process.argv.slice(3)]);
  } else {
    console.error('Uso: node scripts/api.mjs <setup|dev|test>');
    process.exit(1);
  }
}
