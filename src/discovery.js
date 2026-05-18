import path from 'node:path';

import { fileExists, matchesAnyGlobPattern, relativePosix, walkFiles } from './utils/fs.js';

const SCRIPT_EXTENSIONS = new Set(['.lua', '.js', '.mjs', '.cjs', '.ts']);
const WEB_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.cjs', '.ts', '.css']);

export async function discoverResourceInputs(resourcePath, manifest, config) {
  const allFiles = await walkFiles(resourcePath);
  const targetKinds = new Map();

  if (manifest.exists) {
    addTargets(targetKinds, manifest.resolutions.clientScripts.files, 'client');
    addTargets(targetKinds, manifest.resolutions.serverScripts.files, 'server');
    addTargets(targetKinds, manifest.resolutions.sharedScripts.files, 'shared');
  } else {
    for (const filePath of allFiles) {
      if (!SCRIPT_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
        continue;
      }

      addTargets(targetKinds, [filePath], guessScriptKind(resourcePath, filePath));
    }
  }

  const webTargets = new Set();

  if (manifest.exists) {
    for (const filePath of manifest.resolutions.files.files) {
      if (WEB_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
        webTargets.add(filePath);
      }
    }

    if (manifest.resolutions.uiPage.filePath) {
      webTargets.add(manifest.resolutions.uiPage.filePath);
    }
  }

  if (config.webDir) {
    const webDirPath = path.join(resourcePath, config.webDir);
    if (await fileExists(webDirPath)) {
      for (const filePath of allFiles) {
        if (relativePosix(webDirPath, filePath).startsWith('..')) {
          continue;
        }

        if (WEB_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
          webTargets.add(filePath);
        }
      }
    }
  }

  const analysisTargets = [];
  let ignoredTargetCount = 0;

  for (const [filePath, kind] of targetKinds.entries()) {
    const target = createAnalysisTarget(resourcePath, filePath, kind);
    if (matchesAnyGlobPattern(config.ignore, target.relativePath)) {
      ignoredTargetCount += 1;
      continue;
    }

    analysisTargets.push(target);
  }

  for (const filePath of webTargets) {
    if (!targetKinds.has(filePath)) {
      const target = createAnalysisTarget(resourcePath, filePath, 'ui');
      if (matchesAnyGlobPattern(config.ignore, target.relativePath)) {
        ignoredTargetCount += 1;
        continue;
      }

      analysisTargets.push(target);
    }
  }

  analysisTargets.sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  return {
    allFiles,
    analysisTargets,
    ignoredTargetCount
  };
}

function addTargets(targetKinds, files, kind) {
  for (const filePath of files) {
    if (!targetKinds.has(filePath)) {
      targetKinds.set(filePath, kind);
      continue;
    }

    const existingKind = targetKinds.get(filePath);
    if (existingKind !== kind) {
      targetKinds.set(filePath, 'shared');
    }
  }
}

function createAnalysisTarget(resourcePath, filePath, kind) {
  const extension = path.extname(filePath).toLowerCase();

  return {
    absolutePath: filePath,
    relativePath: relativePosix(resourcePath, filePath),
    kind,
    language: getLanguage(extension)
  };
}

function getLanguage(extension) {
  if (extension === '.lua') {
    return 'lua';
  }

  if (['.js', '.mjs', '.cjs', '.ts'].includes(extension)) {
    return 'javascript';
  }

  if (extension === '.html') {
    return 'html';
  }

  return 'text';
}

function guessScriptKind(resourcePath, filePath) {
  const relativePath = relativePosix(resourcePath, filePath).toLowerCase();
  if (relativePath.startsWith('server/') || relativePath.includes('/server/') || relativePath.startsWith('server_')) {
    return 'server';
  }

  if (relativePath.startsWith('client/') || relativePath.includes('/client/') || relativePath.startsWith('client_')) {
    return 'client';
  }

  return 'unknown';
}