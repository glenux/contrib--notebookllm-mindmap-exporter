import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const distDir = resolve(rootDir, 'dist');

const sourceManifest = JSON.parse(
  readFileSync(resolve(rootDir, 'manifest.json'), 'utf8')
);

const browserManifests = {
  chrome: sourceManifest,
  firefox: {
    ...sourceManifest,
    browser_specific_settings: {
      gecko: {
        id: 'mindmap-exporter@rootsongjc.github.io',
        strict_min_version: '115.0'
      }
    }
  }
};

const extensionEntries = [
  'formats',
  'icon.png',
  'LICENSE',
  'mindmap-contract.js',
  'popup.css',
  'popup.html',
  'popup.js',
  'shared'
];

rmSync(distDir, { recursive: true, force: true });

for (const [browser, manifest] of Object.entries(browserManifests)) {
  const targetDir = resolve(distDir, browser);
  mkdirSync(targetDir, { recursive: true });

  for (const entry of extensionEntries) {
    cpSync(resolve(rootDir, entry), resolve(targetDir, entry), { recursive: true });
  }

  writeFileSync(
    resolve(targetDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
}

console.log('Built browser packages in dist/chrome and dist/firefox');
