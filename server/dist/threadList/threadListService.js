"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createThreadListService = createThreadListService;
/**
 * 规范化单条线程摘要，保证服务层输出稳定。
 */
function normalizeThreadSummaryRecord(input) {
    const normalizedCreatedAt = Number.isFinite(input.createdAt) ? Math.max(0, Math.floor(Number(input.createdAt))) : 0;
    const normalizedUpdatedAt = Number.isFinite(input.updatedAt)
        ? Math.max(0, Math.floor(Number(input.updatedAt)))
        : normalizedCreatedAt;
    return {
        id: String(input.id ?? "").trim(),
        preview: String(input.preview ?? ""),
        createdAt: normalizedCreatedAt,
        updatedAt: normalizedUpdatedAt,
        cwd: String(input.cwd ?? ""),
        modelProvider: String(input.modelProvider ?? ""),
    };
}
/**
 * 统一按更新时间倒序整理线程摘要，保证服务层输出稳定。
 */
function sortThreadSummaryRecords(threadSummaries) {
    return threadSummaries
        .map((threadSummary) => normalizeThreadSummaryRecord(threadSummary))
        .filter((threadSummary) => Boolean(threadSummary.id))
        .sort((leftThreadSummary, rightThreadSummary) => {
        const updatedAtDiff = rightThreadSummary.updatedAt - leftThreadSummary.updatedAt;
        if (updatedAtDiff !== 0)
            return updatedAtDiff;
        const createdAtDiff = rightThreadSummary.createdAt - leftThreadSummary.createdAt;
        if (createdAtDiff !== 0)
            return createdAtDiff;
        return leftThreadSummary.id.localeCompare(rightThreadSummary.id);
    });
}
/**
 * 从 CLI 拉取线程摘要并 upsert 写回 SQLite（按 threadId 覆盖），避免清库导致旧线程丢失。
 */
async function syncThreadSummariesFromCli(input) {
    const cliThreadSummaries = sortThreadSummaryRecords(await input.listThreadsFromCli());
    input.store.upsertThreadSummaries(cliThreadSummaries);
}
/**
 * 合并两组线程摘要：按 id 去重，优先保留 primary 的条目（稳定）。
 */
function mergeThreadSummaryRecordsById(primary, secondary) {
    const out = [];
    const seen = new Set();
    for (const thread of primary) {
        const threadId = String(thread.id ?? "").trim();
        if (!threadId)
            continue;
        if (seen.has(threadId))
            continue;
        seen.add(threadId);
        out.push(thread);
    }
    for (const thread of secondary) {
        const threadId = String(thread.id ?? "").trim();
        if (!threadId)
            continue;
        if (seen.has(threadId))
            continue;
        seen.add(threadId);
        out.push(thread);
    }
    return out;
}
/**
 * 创建会话列表服务。
 */
function createThreadListService(options) {
    // warmupPromise：空库默认读取时的后台预热 single-flight，避免并发请求重复拉 CLI。
    let warmupPromise = null;
    // lastWarmupFailed：记录最近一次后台预热是否失败，供前端展示轻提示。
    let lastWarmupFailed = false;
    return {
        async listThreads(listOptions) {
            const persistedThreadSummaries = options.store.listThreadSummaries();
            if (persistedThreadSummaries.length > 0)
                lastWarmupFailed = false;
            if (listOptions.refresh) {
                await syncThreadSummariesFromCli(options);
                const mergedThreadSummaries = options.store.listThreadSummaries();
                lastWarmupFailed = false;
                return {
                    threads: mergedThreadSummaries,
                    warmingUp: false,
                    warmupFailed: false,
                };
            }
            if (persistedThreadSummaries.length > 0) {
                return {
                    threads: persistedThreadSummaries,
                    warmingUp: false,
                    warmupFailed: false,
                };
            }
            if (lastWarmupFailed) {
                return {
                    threads: [],
                    warmingUp: false,
                    warmupFailed: true,
                };
            }
            if (!warmupPromise) {
                warmupPromise = syncThreadSummariesFromCli(options)
                    .then(() => {
                    lastWarmupFailed = false;
                    return undefined;
                })
                    .catch(() => {
                    lastWarmupFailed = true;
                    return undefined;
                })
                    .finally(() => {
                    warmupPromise = null;
                });
            }
            return {
                threads: [],
                warmingUp: true,
                warmupFailed: false,
            };
        },
        async listThreadsPage(listOptions) {
            const normalizedLimitRaw = Number(listOptions.limit ?? 0);
            const normalizedLimit = Number.isFinite(normalizedLimitRaw) ? Math.min(200, Math.max(1, Math.floor(normalizedLimitRaw))) : 30;
            const normalizedCwd = typeof listOptions.cwd === "string" ? listOptions.cwd.trim() : "";
            const cwdFilter = normalizedCwd ? normalizedCwd : null;
            /**
             * includeThreadIds：去重且保序；仅保留非空 id。
             */
            const includeThreadIds = [];
            const seenInclude = new Set();
            for (const rawThreadId of listOptions.includeThreadIds ?? []) {
                const normalizedThreadId = String(rawThreadId ?? "").trim();
                if (!normalizedThreadId)
                    continue;
                if (seenInclude.has(normalizedThreadId))
                    continue;
                seenInclude.add(normalizedThreadId);
                includeThreadIds.push(normalizedThreadId);
            }
            /**
             * 预热判定：只看“全库是否为空”，不要按 cwd 过滤。
             * 否则切到一个“当前还没有线程”的工作区会错误触发 warmup。
             */
            const persistedThreadSummaries = options.store.listThreadSummariesPage({ limit: 1, cursor: null, cwd: null }).threads;
            if (persistedThreadSummaries.length > 0)
                lastWarmupFailed = false;
            if (listOptions.refresh) {
                await syncThreadSummariesFromCli(options);
                lastWarmupFailed = false;
                const page = options.store.listThreadSummariesPage({ limit: normalizedLimit, cursor: listOptions.cursor, cwd: cwdFilter });
                const included = includeThreadIds.length ? options.store.getThreadSummariesByIds(includeThreadIds) : [];
                return {
                    threads: mergeThreadSummaryRecordsById(page.threads, included),
                    nextCursor: page.nextCursor,
                    warmingUp: false,
                    warmupFailed: false,
                };
            }
            if (persistedThreadSummaries.length > 0) {
                const page = options.store.listThreadSummariesPage({ limit: normalizedLimit, cursor: listOptions.cursor, cwd: cwdFilter });
                const included = includeThreadIds.length ? options.store.getThreadSummariesByIds(includeThreadIds) : [];
                return {
                    threads: mergeThreadSummaryRecordsById(page.threads, included),
                    nextCursor: page.nextCursor,
                    warmingUp: false,
                    warmupFailed: false,
                };
            }
            if (lastWarmupFailed) {
                return {
                    threads: [],
                    nextCursor: null,
                    warmingUp: false,
                    warmupFailed: true,
                };
            }
            if (!warmupPromise) {
                warmupPromise = syncThreadSummariesFromCli(options)
                    .then(() => {
                    lastWarmupFailed = false;
                    return undefined;
                })
                    .catch(() => {
                    lastWarmupFailed = true;
                    return undefined;
                })
                    .finally(() => {
                    warmupPromise = null;
                });
            }
            return {
                threads: [],
                nextCursor: null,
                warmingUp: true,
                warmupFailed: false,
            };
        },
    };
}
//# sourceMappingURL=threadListService.js.map