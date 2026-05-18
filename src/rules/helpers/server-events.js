const SENSITIVE_OPERATIONS = [
  {
    category: 'money',
    pattern: /\b(addMoney|addAccountMoney|removeMoney|AddMoney|RemoveMoney)\s*\(([^)]*)\)/g
  },
  {
    category: 'item',
    pattern: /\b(addInventoryItem|removeInventoryItem|AddItem|RemoveItem|GiveWeaponToPed)\s*\(([^)]*)\)/g
  },
  {
    category: 'item',
    pattern: /\box_inventory:(AddItem|RemoveItem)\s*\(([^)]*)\)/g
  },
  {
    category: 'job',
    pattern: /\b(SetJob|setJob|setGroup|SetGroup)\s*\(([^)]*)\)/g
  },
  {
    category: 'sql',
    pattern: /\b(?:MySQL(?:\.Async)?|exports\.oxmysql)\.(query|insert|update|execute|prepare)\s*\(([^\n]*)/g
  }
];

const PLAYER_VALIDATION_PATTERN = /\b(?:ESX\.GetPlayerFromId\s*\(\s*source\s*\)|QBCore\.Functions\.GetPlayer\s*\(\s*source\s*\)|QBOX\.Players\.Get\s*\(\s*source\s*\)|if\s+not\s+\w+\s+then\s+return\s+end|if\s+\w+\s*==\s*nil\s+then\s+return\s+end)/i;
const COOLDOWN_PATTERN = /\b(?:cooldown|rateLimit|rate_limit|lastUsed|lastTrigger|GetGameTimer|os\.clock|SetTimeout|Citizen\.SetTimeout|cooldowns?)\b/i;
const DISTANCE_PATTERN = /\b(?:GetEntityCoords|GetDistanceBetweenCoords|vector3|vec3|distance|coords|#\s*\()\b/i;
const JOB_CHECK_PATTERN = /\b(?:job|Job|group|Group|IsPlayerAceAllowed|HasPermission|getGroup|PlayerData\.job|xPlayer\.job)\b/;

export function collectServerEventSecuritySignals(context) {
  const signals = [];

  for (const analysis of context.scriptAnalyses) {
    if (analysis.kind !== 'server' || analysis.language !== 'lua') {
      continue;
    }

    for (const handler of analysis.eventHandlers) {
      for (const operation of SENSITIVE_OPERATIONS) {
        for (const match of handler.body.matchAll(operation.pattern)) {
          const operationArgs = match[2] || '';
          const clientControlledParams = handler.params.filter((param) => {
            if (!param || ['source', 'cb'].includes(param)) {
              return false;
            }

            return new RegExp(`\\b${escapeRegex(param)}\\b`).test(operationArgs);
          });

          const operationLocation = analysis.locate(handler.bodyStartIndex + match.index);
          signals.push({
            analysis,
            eventName: handler.name,
            handlerType: handler.sourceFunction,
            framework: detectFramework(context.config.framework, handler.body),
            category: operation.category,
            operationName: match[1],
            operationArgs,
            clientControlledParams,
            hasSourceValidation: hasSourceValidation(handler),
            hasPlayerValidation: PLAYER_VALIDATION_PATTERN.test(handler.body),
            hasCooldown: COOLDOWN_PATTERN.test(handler.body),
            hasDistanceCheck: DISTANCE_PATTERN.test(handler.body),
            hasJobCheck: JOB_CHECK_PATTERN.test(handler.body),
            usesStringConcat: /\.\./.test(operationArgs),
            line: operationLocation.line,
            column: operationLocation.column
          });
        }
      }
    }
  }

  return signals;
}

function hasSourceValidation(handler) {
  return handler.params.includes('source')
    || /\blocal\s+\w+\s*=\s*source\b/.test(handler.body)
    || /\bsource\b/.test(handler.body);
}

function detectFramework(configuredFramework, body) {
  if (configuredFramework) {
    return configuredFramework;
  }

  if (/\bESX\./.test(body)) {
    return 'esx';
  }

  if (/\bQBCore\./.test(body)) {
    return 'qbcore';
  }

  if (/\bQBOX\./.test(body)) {
    return 'qbox';
  }

  return 'standalone';
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}