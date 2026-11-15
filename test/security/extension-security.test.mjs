import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const extensionDirectory = path.join(projectDirectory, 'src');
const manifest = JSON.parse(await readFile(path.join(extensionDirectory, 'manifest.json'), 'utf8'));

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

const extensionFiles = await listFiles(extensionDirectory);
const javascriptFiles = extensionFiles.filter((file) => file.endsWith('.js'));
const htmlFiles = extensionFiles.filter((file) => file.endsWith('.html'));
const source = await Promise.all(javascriptFiles.map((file) => readFile(file, 'utf8')));
const html = await Promise.all(htmlFiles.map((file) => readFile(file, 'utf8')));

test('extension uses Manifest V3 and has a restrictive extension-page CSP', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(
    manifest.content_security_policy?.extension_pages,
    "script-src 'self'; object-src 'self'"
  );
  assert.ok(!manifest.permissions.includes('nativeMessaging'));
});

test('extension icons are local PNG files at each required size', async () => {
  for (const iconSet of [manifest.icons, manifest.action.default_icon]) {
    for (const [size, iconPath] of Object.entries(iconSet)) {
      assert.ok(['16', '32', '48', '128'].includes(size), `Unexpected icon size: ${size}`);
      assert.ok(iconPath.endsWith('.png'), `Icon ${size} must be a PNG`);
      const image = await readFile(path.join(extensionDirectory, iconPath));
      assert.deepEqual(
        image.subarray(0, 8),
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        `${iconPath} must contain a PNG image`
      );
      assert.equal(image.readUInt32BE(16), Number(size), `${iconPath} width must match its size`);
      assert.equal(image.readUInt32BE(20), Number(size), `${iconPath} height must match its size`);
    }
  }
});

test('extension HTML loads only local external scripts and has no inline event handlers', () => {
  for (const document of html) {
    for (const [, scriptPath] of document.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
      assert.ok(!/^(?:https?:)?\/\//i.test(scriptPath), `Remote script is prohibited: ${scriptPath}`);
      assert.ok(!scriptPath.startsWith('/'), `Absolute script path is prohibited: ${scriptPath}`);
      assert.ok(
        extensionFiles.includes(path.resolve(extensionDirectory, scriptPath)),
        `Script does not exist in the extension package: ${scriptPath}`
      );
    }
    assert.doesNotMatch(document, /\son[a-z]+\s*=/i, 'Inline HTML event handlers are prohibited');
    assert.doesNotMatch(document, /<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/i);
  }
});

test('extension source does not dynamically evaluate or load remote executable code', () => {
  const combinedSource = source.join('\n');
  assert.doesNotMatch(combinedSource, /\beval\s*\(/);
  assert.doesNotMatch(combinedSource, /\bnew\s+Function\s*\(/);
  assert.doesNotMatch(combinedSource, /\bFunction\s*\(/);
  assert.doesNotMatch(combinedSource, /\b(?:setTimeout|setInterval)\s*\(\s*["'`]/);
  assert.doesNotMatch(combinedSource, /createElement\s*\(\s*["']script["']\s*\)/i);
  assert.doesNotMatch(combinedSource, /\bimport\s*\(\s*["']https?:\/\//i);
});

test('web-accessible resources are explicit and restricted to GitHub pages', () => {
  for (const entry of manifest.web_accessible_resources || []) {
    assert.ok(!entry.resources.includes('*'), 'Wildcard web-accessible resources are prohibited');
    for (const resource of entry.resources) {
      assert.ok(extensionFiles.includes(path.resolve(extensionDirectory, resource)));
    }
    for (const match of entry.matches) {
      assert.match(match, /^https:\/\/(?:\*\.|)github\.com\/\*/);
    }
  }
});
