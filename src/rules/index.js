import * as clientControlledMoney from './client-controlled-money.js';
import * as clientControlledItem from './client-controlled-item.js';
import * as debugOutputCheck from './debug-output-check.js';
import * as eventPrefixCheck from './event-prefix-check.js';
import * as manifestBasicCheck from './manifest-basic-check.js';
import * as manifestExportCheck from './manifest-export-check.js';
import * as manifestFilesCheck from './manifest-files-check.js';
import * as manifestMissingDependency from './manifest-missing-dependency.js';
import * as missingJobCheck from './missing-job-check.js';
import * as missingSourceValidation from './missing-source-validation.js';
import * as luacheck from './luacheck.js';
import * as nativeArgCount from './native-arg-count.js';
import * as nativeSideCheck from './native-side-check.js';
import * as netEventMissingCooldown from './net-event-missing-cooldown.js';
import * as netEventMissingDistanceCheck from './net-event-missing-distance-check.js';
import * as netEventPlayerValidation from './net-event-player-validation.js';
import * as noLoopWithoutWait from './no-loop-without-wait.js';
import * as nuiCallbackCheck from './nui-callback-check.js';
import * as nuiInnerhtmlCheck from './nui-innerhtml-check.js';
import * as rawSqlFromClient from './raw-sql-from-client.js';
import * as sqlInjectionCheck from './sql-injection-check.js';

export const rules = [
  manifestBasicCheck,
  manifestFilesCheck,
  luacheck,
  nativeSideCheck,
  nativeArgCount,
  noLoopWithoutWait,
  eventPrefixCheck,
  sqlInjectionCheck,
  debugOutputCheck,
  clientControlledMoney,
  clientControlledItem,
  missingSourceValidation,
  netEventPlayerValidation,
  netEventMissingCooldown,
  netEventMissingDistanceCheck,
  missingJobCheck,
  rawSqlFromClient,
  nuiInnerhtmlCheck,
  nuiCallbackCheck,
  manifestMissingDependency,
  manifestExportCheck
];

export const RULE_METADATA = Object.fromEntries(rules.map((rule) => [rule.meta.id, rule.meta]));