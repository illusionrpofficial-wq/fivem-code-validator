import path from 'node:path';
import { access, readdir } from 'node:fs/promises';

const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules', '.idea', '.vscode', 'coverage']);

export async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function relativePosix(rootPath, filePath) {
  return path.relative(rootPath, filePath).split(path.sep).join('/');
}

export async function walkFiles(rootPath) {
  const files = [];
  await visitDirectory(rootPath, files);
  return files;
}

export function expandPatterns(rootPath, patterns, allFiles) {
  const files = [];
  const missingPatterns = [];
  const externalPatterns = [];
  const seen = new Set();

  for (const patternValue of patterns) {
    if (patternValue.startsWith('@') || patternValue.startsWith('/')) {
      externalPatterns.push(patternValue);
      continue;
    }

    const matchingFiles = resolvePattern(rootPath, patternValue, allFiles);
    if (matchingFiles.length === 0) {
      missingPatterns.push(patternValue);
      continue;
    }

    for (const filePath of matchingFiles) {
      if (!seen.has(filePath)) {
        seen.add(filePath);
        files.push(filePath);
      }
    }
  }

  return {
    files,
    missingPatterns,
    externalPatterns
  };
}

export function matchesAnyGlobPattern(patterns, relativePath) {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return false;
  }

  return patterns.some((patternValue) => matchesGlobPattern(patternValue, relativePath));
}

export function matchesGlobPattern(patternValue, relativePath) {
  return globToRegExp(patternValue.replace(/\\/g, '/')).test(relativePath.replace(/\\/g, '/'));
}

async function visitDirectory(directoryPath, files) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        await visitDirectory(path.join(directoryPath, entry.name), files);
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    files.push(path.join(directoryPath, entry.name));
  }
}

function resolvePattern(rootPath, patternValue, allFiles) {
  const normalizedPattern = patternValue.replace(/\\/g, '/');
  if (!/[?*]/.test(normalizedPattern)) {
    const literalPath = path.resolve(rootPath, normalizedPattern);
    return allFiles.filter((filePath) => relativePosix(rootPath, filePath) === relativePosix(rootPath, literalPath));
  }

  const matcher = globToRegExp(normalizedPattern);
  return allFiles.filter((filePath) => matcher.test(relativePosix(rootPath, filePath)));
}

function globToRegExp(patternValue) {
  const escaped = patternValue
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*')
    .replace(/\?/g, '.');

  return new RegExp(`^${escaped}$`);
}