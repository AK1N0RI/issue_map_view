import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensionDirectory = path.join(projectDirectory, 'src');
const outputDirectory = path.join(projectDirectory, 'dist');
const manifest = JSON.parse(await readFile(path.join(extensionDirectory, 'manifest.json'), 'utf8'));
const packageJson = JSON.parse(await readFile(path.join(projectDirectory, 'package.json'), 'utf8'));
assert.equal(manifest.version, packageJson.version, 'Extension and package versions must match');

async function listFiles(directory, relativeDirectory = '') {
  const entries = await readdir(path.join(directory, relativeDirectory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Extension packages cannot contain symlinks: ${relativePath}`);
    }
    if (entry.isDirectory()) {
      files.push(...await listFiles(directory, relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    } else {
      throw new Error(`Unsupported extension package entry: ${relativePath}`);
    }
  }
  return files.sort();
}

await mkdir(outputDirectory, { recursive: true });
const archivePath = path.join(outputDirectory, `issue-map-view-v${manifest.version}.zip`);
await rm(archivePath, { force: true });
const extensionFiles = await listFiles(extensionDirectory);
assert.ok(extensionFiles.includes('manifest.json'), 'The extension package must contain manifest.json');
const archive = spawnSync('zip', ['-q', '-X', archivePath, ...extensionFiles], {
  cwd: extensionDirectory,
  encoding: 'utf8',
});
if (archive.error) {
  throw archive.error;
}
if (archive.status !== 0) {
  throw new Error(archive.stderr || `zip exited with status ${archive.status}`);
}

const checksum = createHash('sha256')
  .update(await readFile(archivePath))
  .digest('hex');
await writeFile(
  path.join(outputDirectory, 'SHA256SUMS.txt'),
  `${checksum}  ${path.basename(archivePath)}\n`
);

console.log(`Created Chrome Web Store package: ${path.relative(projectDirectory, archivePath)}`);
console.log(`SHA-256: ${checksum}`);
