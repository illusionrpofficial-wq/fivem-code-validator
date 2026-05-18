import path from 'node:path';

import { relativePosix } from '../utils/fs.js';

const WEB_ASSET_EXTENSIONS = new Set(['.html', '.js', '.css', '.json', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.woff', '.woff2']);

export const meta = {
  id: 'manifest-files-check',
  title: 'Manifest file references should resolve',
  defaultSeverity: 'error',
  description: 'Checks that scripts, files, and ui_page entries referenced by fxmanifest.lua exist and that common web assets are declared.'
};

export function apply(context) {
  if (!context.manifest.exists) {
    return [];
  }

  const findings = [];
  const resolutionEntries = [
    ['client_scripts', context.manifest.resolutions.clientScripts],
    ['server_scripts', context.manifest.resolutions.serverScripts],
    ['shared_scripts', context.manifest.resolutions.sharedScripts],
    ['files', context.manifest.resolutions.files]
  ];

  for (const [label, resolution] of resolutionEntries) {
    for (const missingPattern of resolution.missingPatterns) {
      findings.push({
        ruleId: meta.id,
        file: context.manifest.relativePath,
        line: 1,
        column: 1,
        message: `${label} references missing file: ${missingPattern}`
      });
    }
  }

  const declaredFiles = new Set(context.manifest.files.map((entry) => entry.replace(/\\/g, '/')));
  const uiPageRelative = context.manifest.uiPage ? context.manifest.uiPage.replace(/\\/g, '/') : null;

  if (context.manifest.uiPage && !context.manifest.resolutions.uiPage.exists) {
    findings.push({
      ruleId: meta.id,
      file: context.manifest.relativePath,
      line: 1,
      column: 1,
      message: `ui_page points to missing file: ${context.manifest.uiPage}`
    });
  }

  if (uiPageRelative && context.manifest.resolutions.uiPage.exists && !declaredFiles.has(uiPageRelative)) {
    findings.push({
      ruleId: meta.id,
      severity: 'warn',
      file: context.manifest.relativePath,
      line: 1,
      column: 1,
      message: `ui_page file is not listed in files: ${uiPageRelative}`
    });
  }

  for (const assetPath of collectUndeclaredWebAssets(context, declaredFiles, uiPageRelative)) {
    findings.push({
      ruleId: meta.id,
      severity: 'warn',
      file: context.manifest.relativePath,
      line: 1,
      column: 1,
      message: `${assetPath} exists but is not listed in files.`
    });
  }

  return dedupeFindings(findings);
}

function collectUndeclaredWebAssets(context, declaredFiles, uiPageRelative) {
  const webRoots = new Set();

  if (context.config.webDir) {
    webRoots.add(context.config.webDir.replace(/\\/g, '/'));
  }

  if (uiPageRelative) {
    webRoots.add(path.posix.dirname(uiPageRelative));
  }

  if (webRoots.size === 0) {
    return [];
  }

  const assets = [];
  for (const filePath of context.discovered.allFiles) {
    const relativePath = relativePosix(context.resourcePath, filePath);
    if (context.isIgnoredPath(relativePath)) {
      continue;
    }

    if (!isUnderAnyWebRoot(relativePath, webRoots)) {
      continue;
    }

    if (!WEB_ASSET_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) {
      continue;
    }

    if (relativePath === uiPageRelative || declaredFiles.has(relativePath)) {
      continue;
    }

    assets.push(relativePath);
  }

  return assets;
}

function isUnderAnyWebRoot(relativePath, webRoots) {
  for (const root of webRoots) {
    if (relativePath === root || relativePath.startsWith(`${root}/`)) {
      return true;
    }
  }

  return false;
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = `${finding.ruleId}:${finding.message}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}