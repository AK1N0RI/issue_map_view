import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.dirname(testDirectory);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const suite = process.argv[2] ?? 'all';

if (!['all', 'module', 'e2e', 'live'].includes(suite)) {
  throw new Error(`Unknown test suite "${suite}". Use all, module, e2e, or live.`);
}

function run(command, args, cwd = projectDirectory) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const cucumberExecutable = path.join(
  testDirectory,
  'node_modules',
  '@cucumber',
  'cucumber',
  'bin',
  'cucumber.js'
);
const playwrightCli = path.join(testDirectory, 'node_modules', 'playwright', 'cli.js');

if (!existsSync(cucumberExecutable) || (suite !== 'module' && !existsSync(playwrightCli))) {
  run(npmCommand, ['ci', '--prefix', 'test']);
}

if (suite === 'e2e' || suite === 'all') {
  const { chromium } = await import('playwright');
  if (!existsSync(chromium.executablePath())) {
    run(process.execPath, [playwrightCli, 'install', 'chromium']);
  }
  if (!existsSync(chromium.executablePath())) {
    throw new Error('Playwright Chromium installation did not produce an executable.');
  }
}

const npmArguments = ['--prefix', 'test', 'run'];
if (suite === 'all') {
  npmArguments.push('test');
} else {
  npmArguments.push(`test:${suite}`);
}
run(npmCommand, npmArguments);
