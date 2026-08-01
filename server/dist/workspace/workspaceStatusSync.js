"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncWorkspaceStatusForThreadRunningStateChange = syncWorkspaceStatusForThreadRunningStateChange;
const node_path_1 = __importDefault(require("node:path"));
const workspaceStatusVisibility_1 = require("./workspaceStatusVisibility");
const windowsVerbatimPath_1 = require("./windowsVerbatimPath");
/**
 * 规范化线程 cwd（尽量与 UI 的工作目录条目保持一致），用于作为目录级状态聚合 key。
 */
function normalizeThreadCwd(cwdRaw) {
    /**
     * sanitized：去除 Windows `\\?\` 前缀并裁剪空白。
     */
    const sanitized = (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(String(cwdRaw ?? "").trim());
    if (!sanitized)
        return "";
    return node_path_1.default.resolve(sanitized);
}
/**
 * 从 thread 数据读取 cwd 字段（支持多形态 payload），缺失则返回空字符串。
 */
function readThreadCwd(thread) {
    const raw = thread?.cwd;
    return typeof raw === "string" ? raw : "";
}
/**
 * 从 thread 读取线程摘要；供线程列表 SQLite 做补写，避免“目录状态已有但列表无摘要”。
 */
function buildThreadSummaryFromThread(input) {
    /**
     * threadRecord：宽松读取 thread 字段，兼容不同来源的 thread 形态。
     */
    const threadRecord = input.thread && typeof input.thread === "object" ? input.thread : null;
    /**
     * normalizedThreadId：优先采用 thread 自带 id，缺失时回退到运行态变更里的 threadId。
     */
    const normalizedThreadId = String(threadRecord?.id ?? input.threadId ?? "").trim();
    if (!normalizedThreadId)
        return null;
    /**
     * preview：线程摘要预览；允许为空，后续可由其他入口补齐。
     */
    const preview = String(threadRecord?.preview ?? "");
    /**
     * createdAt：线程创建时间；异常值回退到 0。
     */
    const createdAtRaw = Number(threadRecord?.createdAt ?? 0);
    const createdAt = Number.isFinite(createdAtRaw) ? Math.max(0, Math.floor(createdAtRaw)) : 0;
    /**
     * updatedAt：线程更新时间；缺失时退回 createdAt，保证排序字段稳定。
     */
    const updatedAtRaw = Number(threadRecord?.updatedAt ?? createdAt);
    const updatedAt = Number.isFinite(updatedAtRaw) ? Math.max(0, Math.floor(updatedAtRaw)) : createdAt;
    /**
     * cwd：优先采用 thread 自带 cwd，缺失时回退到已标准化的 fallbackCwd。
     */
    const cwd = normalizeThreadCwd(String(threadRecord?.cwd ?? input.fallbackCwd ?? ""));
    if (!cwd)
        return null;
    /**
     * modelProvider：优先使用结构化 provider，缺失时回退到 model 字段。
     */
    const modelProvider = String(threadRecord?.modelProvider ?? threadRecord?.model ?? "");
    return {
        id: normalizedThreadId,
        preview,
        createdAt,
        updatedAt,
        cwd,
        modelProvider,
    };
}
/**
 * 将 CodexTaskTracker 产生的“线程运行态边沿”同步到工作目录状态仓库。
 */
async function syncWorkspaceStatusForThreadRunningStateChange(change, deps) {
    /**
     * thread：尽力读取线程元信息（至少需要 cwd）。
     */
    const thread = await deps.codex.readThread(change.threadId, false).catch(() => null);
    /**
     * threadCwd：标准化后的线程 cwd；空值则无法落库目录级状态。
     */
    const threadCwd = normalizeThreadCwd(readThreadCwd(thread));
    if (!threadCwd)
        return;
    /**
     * threadSummary：运行态同步已拿到 thread 元信息时，顺手补写线程摘要，避免列表与左轨状态源分叉。
     */
    const threadSummary = buildThreadSummaryFromThread({
        threadId: change.threadId,
        thread,
        fallbackCwd: threadCwd,
    });
    if (threadSummary && deps.threadListStore) {
        deps.threadListStore.upsertThreadSummary(threadSummary);
    }
    /**
     * users：全量用户列表，用于计算对该 cwd 可见的用户集合。
     */
    const users = await deps.userStore.listUsers();
    /**
     * visibleUsernames：对该 cwd 有权限的用户列表（去重保序）。
     */
    const visibleUsernames = (0, workspaceStatusVisibility_1.resolveVisibleUsernamesForCwd)(threadCwd, users);
    if (!visibleUsernames.length)
        return;
    await deps.workspaceStatusStore.setThreadRunningForUsers({
        usernames: visibleUsernames,
        threadId: change.threadId,
        cwd: threadCwd,
        isRunning: change.isRunning,
        updatedAtMs: change.changedAtMs,
    });
    if (change.isRunning)
        return;
    /**
     * activeViewUsernames：当前正在查看该线程的用户列表。
     * 说明：用于实现“刚结束全局未读”语义；只要有任意用户正在看，则视为已被看到（不再写入 completedUnread）。
     */
    const activeViewUsernamesRaw = deps.listActiveThreadViewUsernames ? deps.listActiveThreadViewUsernames(change.threadId) : [];
    const activeViewUsernameSet = new Set(activeViewUsernamesRaw.map((u) => String(u ?? "").trim()).filter(Boolean));
    /**
     * activeVisibleUsernames：当前“正在看且有权限”的用户列表。
     * 若非空，则表示该线程完成时已被任意用户看到，因此无需写入 completedUnread（全局已读语义）。
     */
    const activeVisibleUsernames = visibleUsernames.filter((username) => activeViewUsernameSet.has(username));
    if (activeVisibleUsernames.length)
        return;
    await deps.workspaceStatusStore.markThreadCompletedUnreadForUsers({
        usernames: visibleUsernames,
        threadId: change.threadId,
        cwd: threadCwd,
        updatedAtMs: change.changedAtMs,
    });
}
//# sourceMappingURL=workspaceStatusSync.js.map