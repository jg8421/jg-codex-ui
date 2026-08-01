"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createThreadListServerCache = createThreadListServerCache;
const DEFAULT_THREAD_LIST_SERVER_CACHE_TTL_MS = 30_000;
function normalizeTtlMs(ttlMs) {
    if (!Number.isFinite(ttlMs))
        return DEFAULT_THREAD_LIST_SERVER_CACHE_TTL_MS;
    return Math.max(0, Math.floor(Number(ttlMs)));
}
function cloneThreads(threads) {
    return [...threads];
}
function createThreadListServerCache(options = {}) {
    const nowMs = typeof options.nowMs === "function" ? options.nowMs : Date.now;
    const ttlMs = normalizeTtlMs(options.ttlMs);
    let cacheEntry = null;
    return {
        get() {
            if (!cacheEntry)
                return null;
            if (ttlMs <= 0) {
                cacheEntry = null;
                return null;
            }
            if (nowMs() - cacheEntry.cachedAtMs > ttlMs) {
                cacheEntry = null;
                return null;
            }
            return cloneThreads(cacheEntry.threads);
        },
        set(threads) {
            cacheEntry = {
                threads: cloneThreads(threads),
                cachedAtMs: nowMs(),
            };
        },
        clear() {
            cacheEntry = null;
        },
    };
}
//# sourceMappingURL=threadListServerCache.js.map