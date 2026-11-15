import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [packageJson, manifestJson] = await Promise.all([
  readFile(path.join(projectDirectory, 'package.json'), 'utf8'),
  readFile(path.join(projectDirectory, 'src/manifest.json'), 'utf8'),
]);
const packageVersion = JSON.parse(packageJson).version;
const extensionVersion = JSON.parse(manifestJson).version;
const releaseTag = process.argv[2] || process.env.GITHUB_REF_NAME;
const versionPattern = /^\d+\.\d+\.\d+$/;

assert.match(packageVersion, versionPattern, 'package.json must use a stable semantic version');
assert.equal(
  extensionVersion,
  packageVersion,
  'package.json and src/manifest.json versions must match'
);
if (releaseTag) {
  assert.equal(releaseTag, `v${extensionVersion}`, 'The release tag must match the extension version');
}

console.log(`Release version verified: ${extensionVersion}`);
