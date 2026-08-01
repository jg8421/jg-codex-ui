"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodexAppServer = void 0;
const appServerProcess_1 = require("./appServerProcess");
const codexRuntimeStderr_1 = require("./codexRuntimeStderr");
const jsonrpc_1 = require("./jsonrpc");
const commandLogger_1 = require("../tools/commandLogger");
class CodexAppServer {
    proc;
    rpc;
    ready;
    readyState = "starting";
    readyError = null;
    lastExit = null;
    // 缓存最近一次 stderr 文本，供 `/api/status` 与 WS status 快照展示。
    lastStderrLine = null;
    // 最近一次 stderr 记录时间（ms）。
    lastStderrAtMs = null;
    /**
     * `thread/start` 结果缓存：
     *
     * 背景：
     * - 某些 codex 版本/模式下，`thread/start` 返回的 threadId 可能在短时间内无法被 `thread/resume` / `thread/read` 找到；
     * - 但前端需要立刻用该 threadId 走 `open_thread(threadId)` 来对齐 UI/WS 状态。
     *
     * 策略：
     * - 将 start 返回的 thread 对象按 threadId 做短 TTL 缓存；
     * - 当 resume/read 报 “thread not found” 时回退到该缓存，避免新建线程立刻不可用。
     */
    startedThreadCacheById = new Map();
    startedThreadCacheTtlMs = 60_000;
    startedThreadCacheMax = 200;
    /**
     * `thread/read` 方法支持情况缓存：
     * - unknown：未探测
     * - supported：支持 `thread/read`
     * - unsupported：不支持 `thread/read`（Windows/旧版本）
     */
    threadReadSupport = "unknown";
    constructor(opts) {
        this.proc = new appServerProcess_1.AppServerProcess({
            codexBin: opts.codexBin,
            args: opts.appServerArgs,
            cwd: opts.cwd,
            historyPersistence: opts.historyPersistence,
            disableResponseStorage: opts.disableResponseStorage,
        });
        this.rpc = new jsonrpc_1.JsonRpcClient({ send: (m) => this.proc.send(m) }, { idPrefix: "web-" });
        this.proc.on("message", (msg) => {
            this.logRelevantCodexMessage(msg);
            void this.rpc.handleMessage(msg);
        });
        this.proc.on("stderr", (rawStderrChunk) => {
            // latestStderrLine：统一从 chunk 中提取最后一个非空行，供缓存和过滤复用。
            const latestStderrLine = (0, codexRuntimeStderr_1.getLatestCodexStderrLine)(rawStderrChunk);
            if (!latestStderrLine)
                return;
            // shouldIgnoreWarning：已知 bubblewrap 回退告警不应污染状态快照，也不应继续输出到服务端日志。
            const shouldIgnoreWarning = (0, codexRuntimeStderr_1.isIgnorableCodexRuntimeWarning)(latestStderrLine);
            if (shouldIgnoreWarning)
                return;
            this.rememberLatestStderrLine(latestStderrLine);
            // eslint-disable-next-line no-console
            console.warn(String(rawStderrChunk).trimEnd());
        });
        this.proc.on("exit", (code, signal) => {
            this.lastExit = { code, signal };
            // eslint-disable-next-line no-console
            console.error(`codex app-server exited (code=${code}, signal=${signal})`);
        });
        this.ready = this.initialize()
            .then(() => {
            this.readyState = "ready";
        })
            .catch((err) => {
            this.readyState = "error";
            this.readyError = String(err);
            // eslint-disable-next-line no-console
            console.error(`Failed to initialize codex app-server: ${String(err)}`);
            throw err;
        });
    }
    onNotification(handler) {
        return this.rpc.onNotification((method, params) => handler({ method, params }));
    }
    onServerRequest(handler) {
        this.rpc.onServerRequest(handler);
    }
    async listThreads(limit) {
        await this.ready;
        // 会话列表上限参数：仅在调用方显式传入正整数时透传，默认不带 limit 避免 30 条截断。
        const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(Number(limit))) : null;
        // 仅在有显式 limit 时附带参数，保持默认行为为“由后端返回完整列表”。
        const requestParams = normalizedLimit ? { limit: normalizedLimit } : {};
        const res = (await this.rpc.request("thread/list", requestParams));
        const data = Array.isArray(res?.data) ? res.data : [];
        return data.map((t) => ({
            id: String(t.id),
            preview: String(t.preview ?? ""),
            createdAt: Number(t.createdAt ?? 0),
            updatedAt: Number(t.updatedAt ?? 0),
            cwd: String(t.cwd ?? ""),
            modelProvider: String(t.modelProvider ?? ""),
        }));
    }
    async startThread(params) {
        await this.ready;
        const res = await this.rpc.request("thread/start", {
            cwd: params.cwd,
            approvalPolicy: params.approvalPolicy,
            sandbox: params.sandbox,
            experimentalRawEvents: false,
            persistExtendedHistory: true,
            model: params.model,
            serviceTier: params.serviceTier,
        });
        const r = res;
        const thread = r?.thread ?? r;
        if (r?.thread && thread && typeof thread === "object") {
            const merged = {
                ...thread,
                model: r.model,
                approvalPolicy: r.approvalPolicy,
                sandbox: r.sandbox,
            };
            this.cacheStartedThread(merged);
            return merged;
        }
        this.cacheStartedThread(thread);
        return thread;
    }
    async resumeThread(threadId) {
        await this.ready;
        try {
            const res = await this.rpc.request("thread/resume", { threadId, persistExtendedHistory: true });
            const thread = res.thread ?? res;
            this.cacheStartedThread(thread);
            return thread;
        }
        catch (err) {
            if (this.isThreadUnavailableError(err)) {
                const cached = this.getCachedStartedThread(threadId);
                if (cached)
                    return cached;
            }
            throw err;
        }
    }
    async readThread(threadId, includeTurns) {
        await this.ready;
        if (this.threadReadSupport === "unsupported") {
            return this.readThreadFallback(threadId, includeTurns);
        }
        try {
            const res = await this.rpc.request("thread/read", { threadId, includeTurns });
            this.threadReadSupport = "supported";
            const thread = res.thread ?? res;
            this.cacheStartedThread(thread);
            return thread;
        }
        catch (err) {
            if (this.isJsonRpcMethodNotFoundError(err)) {
                this.threadReadSupport = "unsupported";
                return this.readThreadFallback(threadId, includeTurns);
            }
            if (includeTurns && this.isIncludeTurnsUnavailableError(err)) {
                try {
                    return await this.readThread(threadId, false);
                }
                catch (fallbackErr) {
                    if (this.isThreadUnavailableError(fallbackErr)) {
                        const cached = this.getCachedStartedThread(threadId);
                        if (cached)
                            return cached;
                    }
                    throw fallbackErr;
                }
            }
            if (this.isThreadUnavailableError(err)) {
                const cached = this.getCachedStartedThread(threadId);
                if (cached)
                    return cached;
            }
            throw err;
        }
    }
    /**
     * 当 `thread/read` 不可用时的降级读取：
     * - includeTurns=true：通过 resume 获取线程对象（best-effort 包含 turns）
     * - includeTurns=false：通过 listThreads 查到最小信息（主要用于 cwd 权限校验/广播过滤）
     */
    async readThreadFallback(threadId, includeTurns) {
        const cached = this.getCachedStartedThread(threadId);
        if (cached)
            return cached;
        if (includeTurns) {
            return this.resumeThread(threadId);
        }
        const candidates = await this.listThreads(2000).catch(() => []);
        const found = candidates.find((t) => String(t?.id ?? "") === threadId) ?? null;
        if (found)
            return found;
        // listThreads 未命中时最后回退到 resume（可能更重，但能尽力拿到 cwd）。
        // If not found in list, fallback to resume as a last resort.
        return this.resumeThread(threadId);
    }
    /**
     * 判断“线程不可用”错误：
     * - thread not found/no such thread/no rollout found
     * - thread 尚未 materialize（部分 codex 版本在首条用户消息前不允许 resume/read turns）
     */
    isThreadUnavailableError(err) {
        const e = err;
        const message = String(e?.message ?? "").toLowerCase();
        if (!message)
            return false;
        return (message.includes("thread not found") ||
            message.includes("no such thread") ||
            message.includes("no rollout found for thread id") ||
            message.includes("not materialized yet"));
    }
    /**
     * 判断“includeTurns 暂不可用”错误。
     */
    isIncludeTurnsUnavailableError(err) {
        const e = err;
        const message = String(e?.message ?? "").toLowerCase();
        if (!message)
            return false;
        return message.includes("includeturns is unavailable") || message.includes("include turns is unavailable");
    }
    /**
     * 判断 JSON-RPC “method not found” 错误。
     */
    isJsonRpcMethodNotFoundError(err) {
        const e = err;
        const code = typeof e?.code === "number" ? e.code : null;
        if (code === -32601)
            return true;
        const message = String(e?.message ?? "").toLowerCase();
        return message.includes("method not found") || message.includes("unknown method");
    }
    /**
     * 记录最新 stderr 行。
     */
    rememberLatestStderrLine(stderrLine) {
        // normalizedLine：统一 trim，避免状态快照中出现多余空白。
        const normalizedLine = String(stderrLine ?? "").trim();
        if (!normalizedLine)
            return;
        this.lastStderrLine = normalizedLine;
        this.lastStderrAtMs = Date.now();
    }
    /**
     * 将 `thread/start`（或其它读取路径）得到的 thread 写入短 TTL 缓存。
     */
    cacheStartedThread(thread) {
        const id = String(thread?.id ?? "").trim();
        if (!id)
            return;
        const now = Date.now();
        // best-effort 清理过期缓存，避免长时间运行导致内存增长。
        for (const [key, value] of this.startedThreadCacheById.entries()) {
            if (now - value.ts > this.startedThreadCacheTtlMs)
                this.startedThreadCacheById.delete(key);
        }
        this.startedThreadCacheById.set(id, { ts: now, thread });
        if (this.startedThreadCacheById.size <= this.startedThreadCacheMax)
            return;
        const entries = Array.from(this.startedThreadCacheById.entries()).sort((a, b) => a[1].ts - b[1].ts);
        const toDrop = entries.length - this.startedThreadCacheMax;
        for (let i = 0; i < toDrop; i += 1)
            this.startedThreadCacheById.delete(entries[i][0]);
    }
    /**
     * 获取 thread/start 缓存命中项（过期自动清理）。
     */
    getCachedStartedThread(threadId) {
        const id = String(threadId ?? "").trim();
        if (!id)
            return null;
        const cached = this.startedThreadCacheById.get(id) ?? null;
        if (!cached)
            return null;
        const now = Date.now();
        if (now - cached.ts > this.startedThreadCacheTtlMs) {
            this.startedThreadCacheById.delete(id);
            return null;
        }
        return cached.thread;
    }
    async startTurn(threadId, text, opts) {
        await this.ready;
        (0, commandLogger_1.logCodexTurnStart)({
            threadId,
            text,
            model: opts?.model,
            effort: opts?.effort,
            serviceTier: opts?.serviceTier,
            approvalPolicy: opts?.approvalPolicy,
            sandbox: opts?.sandbox,
        });
        try {
            return await this.rpc.request("turn/start", {
                threadId,
                input: [{ type: "text", text, text_elements: [] }],
                model: opts?.model,
                effort: opts?.effort,
                serviceTier: opts?.serviceTier,
                approvalPolicy: opts?.approvalPolicy,
                sandboxPolicy: sandboxModeToSandboxPolicy(opts?.sandbox),
                collaborationMode: opts?.collaborationMode,
            });
        }
        catch (error) {
            (0, commandLogger_1.logCodexTurnError)({
                threadId,
                method: "turn/start",
                error,
            });
            throw error;
        }
    }
    async interruptTurn(threadId, turnId) {
        await this.ready;
        return this.rpc.request("turn/interrupt", { threadId, turnId });
    }
    respond(id, result) {
        this.rpc.respond(id, result);
    }
    getStatus() {
        const child = this.proc.child;
        const pid = typeof child.pid === "number" ? child.pid : null;
        const running = pid !== null && child.exitCode === null && !child.killed;
        return {
            pid,
            running,
            ready: this.readyState === "ready",
            readyState: this.readyState,
            readyError: this.readyError ?? undefined,
            lastExit: this.lastExit ?? undefined,
            lastStderrLine: this.lastStderrLine ?? undefined,
            lastStderrAtMs: this.lastStderrAtMs ?? undefined,
        };
    }
    dispose() {
        this.proc.dispose();
    }
    async listModels() {
        await this.ready;
        return this.rpc.request("model/list", {});
    }
    async listExperimentalFeatures() {
        await this.ready;
        return this.rpc.request("experimentalFeature/list", {});
    }
    async readConfig() {
        await this.ready;
        return this.rpc.request("config/read", {});
    }
    async listCollaborationModes() {
        await this.ready;
        return this.rpc.request("collaborationMode/list", {});
    }
    async setConfigValue(params) {
        await this.ready;
        return this.rpc.request("config/value/write", params);
    }
    async listSkills() {
        await this.ready;
        return this.rpc.request("skills/list", {});
    }
    async setSkillEnabled(params) {
        await this.ready;
        return this.rpc.request("skills/config/write", params);
    }
    async setThreadName(params) {
        await this.ready;
        return this.rpc.request("thread/name/set", params);
    }
    async startReview(params) {
        await this.ready;
        return this.rpc.request("review/start", params);
    }
    async startCompact(params) {
        await this.ready;
        return this.rpc.request("thread/compact/start", params);
    }
    async forkThread(params) {
        await this.ready;
        return this.rpc.request("thread/fork", { ...params, persistExtendedHistory: true });
    }
    async archiveThread(params) {
        await this.ready;
        return this.rpc.request("thread/archive", params);
    }
    async unarchiveThread(params) {
        await this.ready;
        return this.rpc.request("thread/unarchive", params);
    }
    async rollbackThread(params) {
        await this.ready;
        return this.rpc.request("thread/rollback", params);
    }
    async cleanBackgroundTerminals(params) {
        await this.ready;
        return this.rpc.request("thread/backgroundTerminals/clean", params);
    }
    async initialize() {
        const params = {
            clientInfo: { name: "codex-cli-web", title: "codex-cli-web", version: "0.0.0" },
            // Required for persistExtendedHistory (Codex app-server will reject
            // persistFullHistory/persistExtendedHistory requests without this).
            capabilities: { experimentalApi: true },
        };
        await this.rpc.request("initialize", params);
        this.rpc.notify("initialized");
    }
    /**
     * 仅提取“对排查用户消息执行过程有价值”的通知并打日志。
     */
    logRelevantCodexMessage(message) {
        const rpcMessage = message;
        const method = typeof rpcMessage?.method === "string" ? rpcMessage.method : "";
        const params = rpcMessage?.params;
        if (method === "item/started") {
            const item = params?.item;
            const itemType = typeof item?.type === "string" ? item.type : "";
            if (itemType !== "commandExecution")
                return;
            const command = String(item?.command ?? "").trim();
            if (!command)
                return;
            (0, commandLogger_1.logCodexCommandExecution)({
                threadId: this.extractThreadIdFromParams(params),
                turnId: typeof params?.turnId === "string" ? params.turnId : null,
                itemId: typeof item?.id === "string" ? item.id : null,
                command,
            });
            return;
        }
        if (method === "item/completed") {
            const item = params?.item;
            const itemType = typeof item?.type === "string" ? item.type : "";
            if (itemType !== "commandExecution")
                return;
            const command = String(item?.command ?? "").trim();
            const exitCode = typeof item?.exitCode === "number" ? item.exitCode : null;
            const status = typeof item?.status === "string" ? item.status.trim() : "";
            const failedByExitCode = typeof exitCode === "number" && Number.isFinite(exitCode) && exitCode !== 0;
            const failedByStatus = status === "failed" || status === "error";
            if (!command || (!failedByExitCode && !failedByStatus))
                return;
            (0, commandLogger_1.logCodexCommandExecutionError)({
                threadId: this.extractThreadIdFromParams(params),
                turnId: typeof params?.turnId === "string" ? params.turnId : null,
                itemId: typeof item?.id === "string" ? item.id : null,
                command,
                exitCode,
                status,
                details: typeof item?.aggregatedOutput === "string" ? item.aggregatedOutput : "",
            });
        }
    }
    /**
     * 从 app-server 通知参数中尽力提取 threadId，兼容不同字段命名。
     */
    extractThreadIdFromParams(params) {
        const value = params;
        if (typeof value?.threadId === "string")
            return value.threadId;
        if (typeof value?.thread_id === "string")
            return value.thread_id;
        if (typeof value?.thread?.id === "string")
            return value.thread.id;
        if (typeof value?.conversationId === "string")
            return value.conversationId;
        if (typeof value?.conversation_id === "string")
            return value.conversation_id;
        if (typeof value?.conversation?.id === "string")
            return value.conversation.id;
        return null;
    }
}
exports.CodexAppServer = CodexAppServer;
function sandboxModeToSandboxPolicy(mode) {
    if (mode === "read-only")
        return { type: "readOnly" };
    if (mode === "workspace-write")
        return { type: "workspaceWrite" };
    if (mode === "danger-full-access")
        return { type: "dangerFullAccess" };
    return null;
}
//# sourceMappingURL=codexAppServer.js.map