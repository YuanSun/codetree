'use strict';

import { showToast } from './ui.js';

export function createActionHandlers(functions) {
    return Object.fromEntries(Object.entries(functions).map(([name, fn]) => [
        name,
        ({ args }) => fn(...args),
    ]));
}

function mergeActionHandlers(actionSets) {
    const handlers = new Map();
    actionSets.forEach(actionSet => {
        Object.entries(actionSet).forEach(([name, handler]) => {
            if (handlers.has(name)) throw new Error(`Duplicate console action: ${name}`);
            handlers.set(name, handler);
        });
    });
    return handlers;
}

function parseActionArgs(element) {
    const raw = element.dataset.actionArgs;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Action arguments must be a JSON array');
    return parsed;
}

export function installActionDelegation(actionSets) {
    const handlers = mergeActionHandlers(actionSets);
    const eventBindings = [
        ['click', 'click'],
        ['change', 'change'],
        ['input', 'input'],
        ['keydown', 'keydown'],
        ['focusin', 'focus'],
    ];

    eventBindings.forEach(([eventName, actionEvent]) => {
        document.addEventListener(eventName, event => {
            const origin = event.target instanceof Element ? event.target : null;
            const element = origin?.closest(`[data-on-${actionEvent}]`);
            if (!element || !document.documentElement.contains(element)) return;
            const expectedKey = element.dataset.actionKey;
            if (expectedKey && event.key !== expectedKey) return;
            if (element.dataset.actionPreventDefault === 'true') event.preventDefault();

            const actionName = element.dataset[`on${actionEvent[0].toUpperCase()}${actionEvent.slice(1)}`];
            const handler = handlers.get(actionName);
            if (!handler) {
                console.error(`Unknown console action: ${actionName}`);
                return;
            }
            try {
                const result = handler({
                    args: parseActionArgs(element),
                    element,
                    event,
                });
                Promise.resolve(result).catch(error => {
                    console.error(`Console action ${actionName} failed:`, error);
                    showToast(error?.message || '操作失败', 'error');
                });
            } catch (error) {
                console.error(`Console action ${actionName} failed:`, error);
                showToast(error?.message || '操作失败', 'error');
            }
        });
    });
}
