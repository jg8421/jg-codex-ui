"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodexTaskTracker = void 0;
class CodexTaskTracker {
    /**
     * 线程运行态边沿回调：用于把运行中/完成状态同步到外部存储。
     */
    onThreadRunningStateChange;
    /**
     * 每个线程当前活跃的 turn 集合：用于判断线程是否仍处于运行中。
     */
    activeByThread = new Map();
    /**
     * 每个线程本轮进入运行态的后端起点时间。
     */
    activeSinceMsByThread = new Map();
    /**
     * 最近一次收到 Codex 通知的时间。
     */
    lastEventAtMs = null;
    constructor(options = {}) {
        this.onThreadRunningStateChange = options.onThreadRunningStateChange ?? null;
    }
    onNotification(n) {
        /**
         * 当前通知时间：同时作为 lastEventAtMs 和首次运行起点来源，避免一次通知内多次取时不一致。
         */
        const notificationAtMs = Date.now();
        this.lastEventAtMs = notificationAtMs;
        const params = n.params;
        const threadId = extractThreadId(params);
        if (!threadId)
            return;
        // Codex app-server v2 emits `error` notifications with per-turn ids.
        // If the server will not retry the turn, we can treat it as completion.
        if (n.method === "error") {
            const turnId = extractTurnId(params);
            const willRetry = Boolean(params?.willRetry);
            if (turnId && !willRetry)
                this.markComplete(threadId, turnId, notificationAtMs);
            return;
        }
        if (n.method === "item/started" || n.method === "turn/started") {
            const turnId = extractTurnId(params);
            if (!turnId)
                return;
            this.markActive(threadId, turnId, notificationAtMs);
            return;
        }
        if (n.method === "turn/completed" ||
            n.method === "turn/failed" ||
            n.method === "turn/cancelled" ||
            n.method === "turn/interrupted") {
            const turnId = extractTurnId(params);
            if (turnId) {
                this.markComplete(threadId, turnId, notificationAtMs);
            }
            else {
                /**
                 * wasRunning：无 turnId 时按线程级回退清理；仅在线程原本活跃时发出停止回调。
                 */
                const wasRunning = Boolean(this.activeByThread.get(threadId)?.size);
                this.activeByThread.delete(threadId);
                this.activeSinceMsByThread.delete(threadId);
                if (wasRunning) {
                    this.onThreadRunningStateChange?.({
                        threadId,
                        isRunning: false,
                        changedAtMs: notificationAtMs,
                    });
                }
            }
            return;
        }
    }
    getSnapshot() {
        /**
         * 当前活跃线程列表：保持稳定排序，避免前端 diff 抖动。
         */
        const activeThreads = Array.from(this.activeByThread.keys()).sort();
        /**
         * 每个线程的活跃 turn 数量。
         */
        const activeByThread = {};
        /**
         * 每个线程本轮运行起点：只下发仍活跃线程，避免陈旧数据残留。
         */
        const activeSinceMsByThread = {};
        /**
         * 全局活跃 turn 总数：用于判断整体 busy。
         */
        let activeTurnCount = 0;
        for (const [threadId, turns] of this.activeByThread.entries()) {
            activeByThread[threadId] = turns.size;
            const activeSinceMs = this.activeSinceMsByThread.get(threadId);
            if (typeof activeSinceMs === "number")
                activeSinceMsByThread[threadId] = activeSinceMs;
            activeTurnCount += turns.size;
        }
        return {
            busy: activeTurnCount > 0,
            activeTurnCount,
            activeThreads,
            activeByThread,
            activeSinceMsByThread,
            lastEventAtMs: this.lastEventAtMs,
        };
    }
    getActiveTurnIds(threadId) {
        const set = this.activeByThread.get(threadId);
        if (!set)
            return [];
        return Array.from(set);
    }
    reset() {
        this.activeByThread.clear();
        this.activeSinceMsByThread.clear();
        this.lastEventAtMs = null;
    }
    markActive(threadId, turnId, activeAtMs) {
        /**
         * 线程当前活跃 turn 集合：首次活跃时创建，后续复用。
         */
        const set = this.activeByThread.get(threadId) ?? new Set();
        /**
         * 线程是否刚从 idle 进入 active：仅此时写入后端运行起点。
         */
        const wasIdle = set.size === 0;
        set.add(turnId);
        this.activeByThread.set(threadId, set);
        if (wasIdle && !this.activeSinceMsByThread.has(threadId)) {
            this.activeSinceMsByThread.set(threadId, activeAtMs);
            this.onThreadRunningStateChange?.({
                threadId,
                isRunning: true,
                changedAtMs: activeAtMs,
            });
        }
    }
    markComplete(threadId, turnId, completedAtMs) {
        /**
         * 当前线程活跃集合：不存在时说明状态已经被清理，直接忽略重复完成事件。
         */
        const set = this.activeByThread.get(threadId);
        if (!set)
            return;
        set.delete(turnId);
        if (set.size === 0) {
            this.activeByThread.delete(threadId);
            this.activeSinceMsByThread.delete(threadId);
            this.onThreadRunningStateChange?.({
                threadId,
                isRunning: false,
                changedAtMs: completedAtMs,
            });
        }
    }
}
exports.CodexTaskTracker = CodexTaskTracker;
function extractThreadId(params) {
    const p = params;
    if (p && typeof p.threadId === "string")
        return p.threadId;
    if (p && typeof p.conversationId === "string")
        return p.conversationId;
    // Be liberal in what we accept: official app-server payloads sometimes use snake_case.
    if (p && typeof p.thread_id === "string")
        return p.thread_id;
    if (p && typeof p.conversation_id === "string")
        return p.conversation_id;
    if (p && typeof p.thread?.id === "string")
        return p.thread.id;
    if (p && typeof p.conversation?.id === "string")
        return p.conversation.id;
    return null;
}
function extractTurnId(params) {
    const p = params;
    const candidates = [
        p?.turnId,
        p?.turn_id,
        p?.turn?.id,
        p?.turn,
        p?.id,
        p?.item?.turnId,
        p?.item?.turn_id,
        p?.item?.turn?.id,
    ];
    // Upstream event payloads are not fully stable; accept several known shapes.
    for (const candidate of candidates) {
        if (candidate === null || candidate === undefined)
            continue;
        const trimmed = String(candidate).trim();
        if (trimmed)
            return trimmed;
    }
    return null;
}
//# sourceMappingURL=codexTaskTracker.js.map