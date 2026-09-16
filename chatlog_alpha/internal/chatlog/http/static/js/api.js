'use strict';

export class APIError extends Error {
    constructor(message, details = {}) {
        super(message, details.cause ? { cause: details.cause } : undefined);
        this.name = 'APIError';
        this.status = Number(details.status || 0);
        this.url = String(details.url || '');
        this.data = details.data;
        this.response = details.response || null;
    }
}

function responseURL(response, requestedURL) {
    return response.url || String(requestedURL || '');
}

async function errorFromResponse(response, requestedURL) {
    const text = await response.clone().text();
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch (_) {
            data = text;
        }
    }
    const serverMessage = data && typeof data === 'object'
        ? data.error || data.message
        : data;
    return new APIError(
        String(serverMessage || `请求失败（HTTP ${response.status}）`),
        {
            status: response.status,
            url: responseURL(response, requestedURL),
            data,
            response,
        },
    );
}

function requestHeaders(rawHeaders, accept, hasJSONBody) {
    const headers = new Headers(rawHeaders || {});
    if (accept && !headers.has('Accept')) headers.set('Accept', accept);
    if (hasJSONBody && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return headers;
}

export async function request(url, options = {}) {
    const {
        accept = '',
        cache = 'no-store',
        headers: rawHeaders,
        json,
        signal: upstreamSignal,
        timeoutMs = 0,
        ...fetchOptions
    } = options;
    if (json !== undefined && fetchOptions.body !== undefined) {
        throw new TypeError('request accepts either json or body, not both');
    }

    const hasJSONBody = json !== undefined;
    const headers = requestHeaders(rawHeaders, accept, hasJSONBody);
    const timeout = Number(timeoutMs);
    const controller = timeout > 0 ? new AbortController() : null;
    const signal = controller ? controller.signal : upstreamSignal;
    let timedOut = false;
    let timer = null;
    const abortFromUpstream = () => controller?.abort();

    if (controller) {
        if (upstreamSignal?.aborted) controller.abort();
        else upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });
        timer = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeout);
    }

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            cache,
            headers,
            body: hasJSONBody ? JSON.stringify(json) : fetchOptions.body,
            signal,
        });
        if (!response.ok) throw await errorFromResponse(response, url);
        return response;
    } catch (error) {
        if (error instanceof APIError) throw error;
        if (timedOut) {
            throw new APIError(`请求超时（${timeout} ms）`, { url, cause: error });
        }
        if (error?.name === 'AbortError' || upstreamSignal?.aborted) throw error;
        throw new APIError(error?.message || '网络请求失败', { url, cause: error });
    } finally {
        if (timer) clearTimeout(timer);
        upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    }
}

export async function requestJSON(url, options = {}) {
    const response = await request(url, { ...options, accept: options.accept || 'application/json' });
    const text = await response.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new APIError('响应不是有效的 JSON', {
            status: response.status,
            url: responseURL(response, url),
            data: text,
            response,
            cause: error,
        });
    }
}

export async function requestText(url, options = {}) {
    const response = await request(url, { ...options, accept: options.accept || 'text/plain, */*' });
    return response.text();
}

export async function requestBlob(url, options = {}) {
    const response = await request(url, { ...options, accept: options.accept || '*/*' });
    return response.blob();
}
