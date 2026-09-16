'use strict';

import './core.js';
import { analyticsActions } from './analytics.js';
import { databaseActions } from './database.js';
import { installActionDelegation } from './events.js';
import { featureActions } from './features.js';
import { hookActions } from './hooks.js';
import { runtimeActions } from './runtime.js';

installActionDelegation([
    runtimeActions,
    hookActions,
    analyticsActions,
    databaseActions,
    featureActions,
]);
