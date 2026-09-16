'use strict';

let navigate = null;

export function configureTabNavigation(handler) {
    if (typeof handler !== 'function') throw new TypeError('Tab navigation handler must be a function');
    navigate = handler;
}

export function navigateToTab(tabId) {
    if (!navigate) throw new Error('Tab navigation is not initialized');
    return navigate(tabId);
}
