import path from 'node:path';
import { readFile } from 'node:fs/promises';

import { expandPatterns, fileExists, relativePosix, walkFiles } from './utils/fs.js';

export async function parseManifest(resourcePath, manifestName) {
  const manifestPath = path.resolve(resourcePath, manifestName);
  const manifestExists = await fileExists(manifestPath);
  const relativeManifestPath = relativePosix(resourcePath, manifestPath);

  if (!manifestExists) {
    return {
      exists: false,
      filePath: manifestPath,
      relativePath: relativeManifestPath,
      content: '',
      fxVersion: null,
      games: [],
      lua54: null,
      uiPage: null,
      clientScripts: [],
      serverScripts: [],
      sharedScripts: [],
      files: [],
      dependencies: [],
      exports: [],
      serverExports: [],
      resolutions: emptyResolutions()
    };
  }

  const content = await readFile(manifestPath, 'utf8');
  const allFiles = await walkFiles(resourcePath);

  const clientScripts = collectDirectiveValues(content, ['client_script', 'client_scripts']);
  const serverScripts = collectDirectiveValues(content, ['server_script', 'server_scripts']);
  const sharedScripts = collectDirectiveValues(content, ['shared_script', 'shared_scripts']);
  const files = collectDirectiveValues(content, ['file', 'files']);
  const dependencies = collectDirectiveValues(content, ['dependency', 'dependencies']);
  const exportsList = collectDirectiveValues(content, ['export', 'exports']);
  const serverExports = collectDirectiveValues(content, ['server_export', 'server_exports']);
  const games = collectDirectiveValues(content, ['game', 'games']);
  const fxVersion = collectDirectiveValues(content, ['fx_version'])[0] || null;
  const lua54 = collectDirectiveValues(content, ['lua54'])[0] || null;
  const uiPage = collectDirectiveValues(content, ['ui_page'])[0] || null;

  return {
    exists: true,
    filePath: manifestPath,
    relativePath: relativeManifestPath,
    content,
    fxVersion,
    games,
    lua54,
    uiPage,
    clientScripts,
    serverScripts,
    sharedScripts,
    files,
    dependencies,
    exports: exportsList,
    serverExports,
    resolutions: {
      clientScripts: expandPatterns(resourcePath, clientScripts, allFiles),
      serverScripts: expandPatterns(resourcePath, serverScripts, allFiles),
      sharedScripts: expandPatterns(resourcePath, sharedScripts, allFiles),
      files: expandPatterns(resourcePath, files, allFiles),
      uiPage: resolveUiPage(resourcePath, uiPage, allFiles)
    }
  };
}

function collectDirectiveValues(content, directiveNames) {
  const values = [];
  const seen = new Set();
  const namesPattern = directiveNames.join('|');

  const blockPattern = new RegExp(`\\b(?:${namesPattern})\\s*\\{([\\s\\S]*?)\\}`, 'g');
  for (const match of content.matchAll(blockPattern)) {
    for (const value of extractQuotedStrings(match[1])) {
      if (!seen.has(value)) {
        seen.add(value);
        values.push(value);
      }
    }
  }

  const singlePattern = new RegExp(`\\b(?:${namesPattern})\\s*(?:\\(\\s*)?['\"]([^'\"]+)['\"]`, 'g');
  for (const match of content.matchAll(singlePattern)) {
    const value = match[1];
    if (!seen.has(value)) {
      seen.add(value);
      values.push(value);
    }
  }

  return values;
}

function extractQuotedStrings(block) {
  const values = [];
  const quotePattern = /['\"]([^'\"]+)['\"]/g;

  for (const match of block.matchAll(quotePattern)) {
    values.push(match[1]);
  }

  return values;
}

function resolveUiPage(resourcePath, uiPage, allFiles) {
  if (!uiPage || uiPage.startsWith('@')) {
    return {
      exists: false,
      filePath: null
    };
  }

  const resolvedPath = path.resolve(resourcePath, uiPage);
  const matchedFile = allFiles.find((filePath) => relativePosix(resourcePath, filePath) === relativePosix(resourcePath, resolvedPath));

  return {
    exists: Boolean(matchedFile),
    filePath: matchedFile || resolvedPath
  };
}

function emptyResolutions() {
  return {
    clientScripts: { files: [], missingPatterns: [], externalPatterns: [] },
    serverScripts: { files: [], missingPatterns: [], externalPatterns: [] },
    sharedScripts: { files: [], missingPatterns: [], externalPatterns: [] },
    files: { files: [], missingPatterns: [], externalPatterns: [] },
    uiPage: { exists: false, filePath: null }
  };
}