export type ThreadListServerCacheOptions = {
    ttlMs?: number;
    nowMs?: () => number;
};
export type ThreadListServerCache<T> = {
    get: () => T[] | null;
    set: (threads: T[]) => void;
    clear: () => void;
};
export declare function createThreadListServerCache<T>(options?: ThreadListServerCacheOptions): ThreadListServerCache<T>;
