import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const RUNTIME_NATIVES_URL = 'https://runtime.fivem.net/doc/natives.json';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const cachePath = path.resolve(currentDirectory, '../data/natives-cache.json');

export async function loadNativeCatalog(options = {}) {
  const bundledCatalog = JSON.parse(await readFile(cachePath, 'utf8'));
  const natives = new Map();

  let remoteLoaded = false;
  let remoteError = null;

  if (!options.offline && !options.disableRemoteNatives) {
    try {
      const response = await fetch(RUNTIME_NATIVES_URL, {
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      for (const native of flattenRuntimeNatives(payload)) {
        upsertNative(natives, normalizeNativeEntry(native, 'runtime'));
      }

      remoteLoaded = true;
    } catch (error) {
      remoteError = error instanceof Error ? error.message : String(error);
    }
  }

  for (const native of bundledCatalog.natives) {
    upsertNative(natives, normalizeNativeEntry(native, 'cache'));
  }

  return {
    natives,
    meta: {
      cacheCount: bundledCatalog.natives.length,
      totalCount: natives.size,
      remoteLoaded,
      remoteError
    }
  };
}

export function normalizeNativeName(value) {
  return String(value || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
}

function flattenRuntimeNatives(payload) {
  const natives = [];
  for (const namespaceGroup of Object.values(payload)) {
    natives.push(...Object.values(namespaceGroup));
  }

  return natives;
}

function normalizeNativeEntry(native, source) {
  const minArgs = typeof native.minArgs === 'number'
    ? native.minArgs
    : Array.isArray(native.params)
      ? native.params.length
      : null;

  const maxArgs = typeof native.maxArgs === 'number'
    ? native.maxArgs
    : typeof minArgs === 'number'
      ? minArgs
      : null;

  return {
    key: normalizeNativeName(native.name),
    name: native.name,
    apiset: native.apiset || 'unknown',
    minArgs,
    maxArgs,
    source,
    enforceArgCount: Boolean(native.enforceArgCount),
    description: native.description || ''
  };
}

function upsertNative(natives, entry) {
  const existing = natives.get(entry.key);
  if (!existing) {
    natives.set(entry.key, entry);
    return;
  }

  natives.set(entry.key, {
    ...existing,
    ...entry,
    apiset: entry.apiset !== 'unknown' ? entry.apiset : existing.apiset,
    minArgs: typeof entry.minArgs === 'number' ? entry.minArgs : existing.minArgs,
    maxArgs: typeof entry.maxArgs === 'number' ? entry.maxArgs : existing.maxArgs,
    enforceArgCount: entry.enforceArgCount || existing.enforceArgCount,
    description: entry.description || existing.description
  });
}