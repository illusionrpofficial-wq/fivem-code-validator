import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const CLIENT_FUNCTIONS_URL = 'https://docs.fivem.net/docs/scripting-reference/runtimes/lua/client-functions/';
const SERVER_FUNCTIONS_URL = 'https://docs.fivem.net/docs/scripting-reference/runtimes/lua/server-functions/';
const FUNCTION_LINK_PATTERN = /href="(?:https:\/\/docs\.fivem\.net)?\/docs\/scripting-reference\/runtimes\/lua\/functions\/([^"?#]+?)\/?"/gi;

const CITIZEN_ALIAS_GLOBALS = Object.freeze({
  'Citizen.CreateThread': 'CreateThread',
  'Citizen.SetTimeout': 'SetTimeout',
  'Citizen.Wait': 'Wait'
});

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const cachePath = path.resolve(currentDirectory, '../data/runtime-globals-cache.json');

export async function loadRuntimeGlobalCatalog(options = {}) {
  const bundledCatalog = JSON.parse(await readFile(cachePath, 'utf8'));
  const cachedFunctions = normalizeCachedFunctions(bundledCatalog.functions || {});
  const mergedFunctions = {
    client: new Set(cachedFunctions.client),
    server: new Set(cachedFunctions.server)
  };

  let remoteLoaded = false;
  let remoteError = null;

  if (!options.offline && !options.disableRemoteRuntimeGlobals) {
    const [clientResult, serverResult] = await Promise.allSettled([
      fetchFunctionList(CLIENT_FUNCTIONS_URL),
      fetchFunctionList(SERVER_FUNCTIONS_URL)
    ]);

    const errors = [];

    if (clientResult.status === 'fulfilled') {
      addAll(mergedFunctions.client, clientResult.value);
    } else {
      errors.push(`client: ${formatError(clientResult.reason)}`);
    }

    if (serverResult.status === 'fulfilled') {
      addAll(mergedFunctions.server, serverResult.value);
    } else {
      errors.push(`server: ${formatError(serverResult.reason)}`);
    }

    remoteLoaded = errors.length === 0;
    remoteError = errors.length > 0 ? errors.join('; ') : null;
  }

  const globals = buildGlobalCatalog(mergedFunctions, bundledCatalog.functions?.undocumented || {});

  return {
    globals,
    meta: {
      cacheClientCount: cachedFunctions.client.length,
      cacheServerCount: cachedFunctions.server.length,
      totalReadCount: globals.unknown.read.length,
      remoteLoaded,
      remoteError
    }
  };
}

function normalizeCachedFunctions(functions) {
  return {
    client: uniqueStringArray(functions.client),
    server: uniqueStringArray(functions.server)
  };
}

function buildGlobalCatalog(functions, undocumented) {
  const clientRead = expandFunctionNames(functions.client);
  const serverRead = expandFunctionNames(functions.server);

  for (const name of uniqueStringArray(undocumented.all)) {
    if (!isValidGlobalName(name)) {
      continue;
    }

    clientRead.add(name);
    serverRead.add(name);
  }

  for (const name of uniqueStringArray(undocumented.client)) {
    if (isValidGlobalName(name)) {
      clientRead.add(name);
    }
  }

  for (const name of uniqueStringArray(undocumented.server)) {
    if (isValidGlobalName(name)) {
      serverRead.add(name);
    }
  }

  const sharedRead = new Set([...clientRead, ...serverRead]);
  const mutable = uniqueStringArray(undocumented.mutable)
    .filter(isValidGlobalName)
    .sort(sortStrings);

  return {
    client: {
      read: [...clientRead].sort(sortStrings),
      mutable
    },
    server: {
      read: [...serverRead].sort(sortStrings),
      mutable
    },
    shared: {
      read: [...sharedRead].sort(sortStrings),
      mutable
    },
    unknown: {
      read: [...sharedRead].sort(sortStrings),
      mutable
    }
  };
}

function expandFunctionNames(functionNames) {
  const globals = new Set();

  for (const functionName of functionNames) {
    const normalizedName = String(functionName || '').trim();
    if (!normalizedName) {
      continue;
    }

    if (isValidGlobalName(normalizedName)) {
      globals.add(normalizedName);
      continue;
    }

    if (normalizedName.startsWith('Citizen.')) {
      globals.add('Citizen');
      const alias = CITIZEN_ALIAS_GLOBALS[normalizedName];
      if (alias && isValidGlobalName(alias)) {
        globals.add(alias);
      }
    }
  }

  return globals;
}

async function fetchFunctionList(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return parseFunctionList(await response.text());
}

function parseFunctionList(html) {
  const names = new Set();

  for (const match of html.matchAll(FUNCTION_LINK_PATTERN)) {
    const name = decodeURIComponent(match[1] || '')
      .replace(/\/+$/, '')
      .trim();

    if (!name) {
      continue;
    }

    names.add(name);
  }

  return [...names];
}

function uniqueStringArray(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean))];
}

function addAll(target, values) {
  for (const value of values) {
    target.add(value);
  }
}

function isValidGlobalName(value) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function sortStrings(left, right) {
  return left.localeCompare(right);
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}