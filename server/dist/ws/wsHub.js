"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsHub = void 0;
const path_1 = __importDefault(require("path"));
const ws_1 = __importDefault(require("ws"));
const env_1 = require("../env");
const session_1 = require("../auth/session");
const roles_1 = require("../auth/roles");
const threadContextUsage_1 = require("../status/threadContextUsage");
const accessControl_1 = require("../workspace/accessControl");
const approvalCwdAccess_1 = require("../workspace/approvalCwdAccess");
const cwdSwitchLogger_1 = require("../workspace/cwdSwitchLogger");
const threadListVisibility_1 = require("../workspace/threadListVisibility");
const threadSanitize_1 = require("../workspace/threadSanitize");
const workspaceStatusVisibility_1 = require("../workspace/workspaceStatusVisibility");
const windowsVerbatimPath_1 = require("../workspace/windowsVerbatimPath");
const executionPolicy_1 = require("../security/executionPolicy");
const sqliteHistoryStore_1 = require("../history/sqlite/sqliteHistoryStore");
const codexEventProjector_1 = require("../chat/codexEventProjector");
const fileChangeExtractor_1 = require("../chat/fileChangeExtractor");
const threadTurnsProjector_1 = require("../chat/threadTurnsProjector");
const threadStartSummary_1 = require("../threadList/threadStartSummary");
const threadListCliLimit_1 = require("../threadList/threadListCliLimit");
const wsScope_1 = require("./wsScope");
function sanitizeStatusSnapshotForWs(snapshot) {
    // `codexTask.lastEventAtMs` updates on every Codex notification, even when the meaningful execution state
    // (active turn counts, active threads) hasn't changed. If we include it, WS status JSON always changes and
    // the hub will broadcast `status` far more often than the UI needs.
    const codexTask = snapshot?.codexTask;
    if (!codexTask || typeof codexTask !== "object")
        return snapshot;
    if (!Object.prototype.hasOwnProperty.call(codexTask, "lastEventAtMs"))
        return snapshot;
    return {
        ...snapshot,
        codexTask: {
            ...codexTask,
            lastEventAtMs: null,
        },
    };
}
async function resolveCwdForNewThread(requestedCwd, user) {
    // 统一复用 accessControl：保证 HTTP 与 WS 的工作区权限一致。
    const raw = typeof requestedCwd === "string" ? requestedCwd : "";
    return (0, accessControl_1.assertCwdAllowedForUser)({ cwd: raw, user });
}
function getErrorMessage(err) {
    if (err instanceof Error) {
        const msg = String(err.message || "").trim();
        if (msg)
            return msg;
        const name = String(err.name || "").trim();
        if (name)
            return name;
        return "Request failed";
    }
    if (typeof err === "string") {
        const msg = err.trim();
        return msg || "Request failed";
    }
    const maybeMessage = typeof err?.message === "string" ? String(err.message).trim() : "";
    if (maybeMessage)
        return maybeMessage;
    try {
        return JSON.stringify(err);
    }
    catch {
        return "Request failed";
    }
}
function getErrorDetails(err) {
    if (err instanceof Error)
        return String(err.stack || err.message || err.name || "Request failed");
    return String(err);
}
function describeClientAction(msg) {
    // Keep this short; it appears in the UI error banner.
    return typeof msg?.type === "string" ? String(msg.type) : "request";
}
class WsHub {
    wss;
    codex;
    sessionSecret;
    getStatusSnapshot;
    clients = new Set();
    readyClients = new Set();
    // 每个 WS 连接的 scope：用于区分全局连接与线程连接（兼容旧客户端默认为 all）。
    wsScopeByClient = new Map();
    // thread scope 连接“锁定”的 threadId：防止复用同一连接跨线程接收流式输出。
    activeThreadIdByClient = new Map();
    threadOwners = new Map();
    threadOwnerUsername = new Map();
    threadOwnerUsernameMax = 1000;
    // 线程关联的 cwd 缓存：用于在 submit/interrupt 等操作中做权限校验。
    threadCwdById = new Map();
    pending = new Map();
    seenSubmitIdsByThread = new Map();
    submitDedupTtlMs = 10 * 60_000;
    submitDedupMaxPerThread = 500;
    wsUser = new Map();
    wsByUser = new Map();
    openThreadResultsByUser = new Map();
    openThreadDedupTtlMs = 10 * 60_000;
    openThreadDedupMaxPerUser = 200;
    threadTurnsByUser = new Map();
    threadTurnsCacheTtlMs = 30 * 60_000;
    threadTurnsCacheMaxPerUser = 200;
    // 从 Codex session `.jsonl` 读取 token_count，用于补齐线程“初始上下文使用率”（CLI 可见，Web 默认拿不到）。
    threadContextUsageReader = new threadContextUsage_1.ThreadContextUsageReader();
    // 后端聊天投影器：把 Codex 通知转换为 UI 友好的 chat_ops，降低前端解析压力。
    chatProjector = new codexEventProjector_1.ChatProjector();
    // 线程创建时间（ms）缓存：用于 turns slice 生成稳定的 ChatItem 时间戳。
    threadCreatedAtMsById = new Map();
    // 首次 `open_thread` 时下发给客户端的 turns 数量上限。
    // 默认限制为 200，避免打开超长线程时一次性返回全部 turns 导致前端解析/渲染卡顿；可通过 env 调整。
    initialThreadTurnLimit = (0, env_1.getWebOpenThreadTurnsLimit)();
    loadThreadTurnsDefaultLimit = 50;
    loadThreadTurnsMaxLimit = 200;
    seenInterruptIdsByThread = new Map();
    interruptDedupTtlMs = 2 * 60_000;
    interruptDedupMaxPerThread = 500;
    statusTimer = null;
    lastStatusJson = null;
    getActiveTurnIds;
    pendingTimeoutMs;
    heartbeatTimer = null;
    userStore;
    userWorkspaceStore;
    userSettingsStore;
    workspaceStatusStore;
    historyIngest;
    // threadListStore：用于把 WS 新建线程同步写回 SQLite，会话列表默认读库时可立即可见。
    threadListStore = null;
    // threadListStoreInitError：记录最近一次初始化失败，避免每次新建线程都重复尝试打开 DB。
    threadListStoreInitError = null;
    workspaceRoutingSnapshot = null;
    workspaceRoutingSnapshotPromise = null;
    workspaceRoutingSnapshotTtlMs = 30_000;
    constructor(wss, codex, sessionSecret, getStatusSnapshot, opts = {}) {
        this.wss = wss;
        this.codex = codex;
        this.sessionSecret = sessionSecret;
        this.getStatusSnapshot = getStatusSnapshot;
        this.userStore = opts.userStore ?? null;
        this.userWorkspaceStore = opts.userWorkspaceStore ?? null;
        this.userSettingsStore = opts.userSettingsStore ?? null;
        this.workspaceStatusStore = opts.workspaceStatusStore ?? null;
        this.historyIngest = opts.historyIngest ?? null;
        this.getActiveTurnIds = opts.getActiveTurnIds ?? (() => []);
        this.pendingTimeoutMs = Number.isFinite(opts.pendingTimeoutMs) ? Math.max(0, Math.floor(opts.pendingTimeoutMs)) : 3 * 60_000;
        this.codex.onNotification(({ method, params }) => {
            const threadId = extractThreadId(params);
            if (threadId && this.historyIngest) {
                void this.historyIngest.recordCodexEvent({ threadId, method, params }).catch(() => {
                    // 历史落库失败不应阻断实时事件广播链路。
                });
            }
            if (!threadId)
                return;
            const nowMs = Date.now();
            const payload = { method, params };
            const projection = this.chatProjector.projectNotification({ threadId, payload, nowMs });
            const messages = [];
            if (projection.ops.length) {
                messages.push({ type: "chat_ops", threadId, ops: projection.ops });
            }
            if (projection.todoUpdate) {
                messages.push({ type: "todo_plan_update", update: projection.todoUpdate });
            }
            if (typeof projection.usagePercent === "number") {
                messages.push({ type: "thread_context_usage", threadId, usagePercent: projection.usagePercent });
            }
            if (!messages.length)
                return;
            this.broadcastMessagesToAuthorizedUsers(threadId, messages);
        });
        this.codex.onServerRequest(async (req) => this.handleCodexServerRequest(req));
        this.wss.on("connection", (ws, req) => this.onConnection(ws, req));
        this.startStatusPump(500);
        this.startHeartbeat(Number.isFinite(opts.heartbeatIntervalMs) ? Math.max(100, Math.floor(opts.heartbeatIntervalMs)) : 30_000);
    }
    /**
     * 返回当前“正在查看指定线程”的用户名列表：
     * - 基于 thread scope 连接被锁定到 threadId 的事实判断；
     * - 用于在线程完成时判断是否已有用户正在查看，从而决定是否需要写入 completedUnread（全局未读语义）。
     */
    listThreadViewUsernames(threadIdRaw) {
        /**
         * threadId：规范化后的线程 id。
         */
        const threadId = String(threadIdRaw ?? "").trim();
        if (!threadId)
            return [];
        /**
         * usernames：最终输出的用户名列表（去重保序）。
         */
        const usernames = [];
        const seen = new Set();
        for (const [ws, activeThreadId] of this.activeThreadIdByClient.entries()) {
            if (activeThreadId !== threadId)
                continue;
            if (ws.readyState !== ws_1.default.OPEN)
                continue;
            const username = String(this.wsUser.get(ws)?.username ?? "").trim();
            if (!username || seen.has(username))
                continue;
            seen.add(username);
            usernames.push(username);
        }
        return usernames;
    }
    dispose() {
        if (this.statusTimer)
            clearInterval(this.statusTimer);
        this.statusTimer = null;
        if (this.heartbeatTimer)
            clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
        if (this.threadListStore)
            this.threadListStore.close();
        this.threadListStore = null;
    }
    /**
     * 懒加载 SQLite 线程列表存储，供 WS 新建线程后立即持久化摘要。
     */
    resolveThreadListStore() {
        if (this.threadListStore)
            return this.threadListStore;
        if (this.threadListStoreInitError)
            return null;
        try {
            this.threadListStore = (0, sqliteHistoryStore_1.createSqliteHistoryStore)({ dbPath: (0, env_1.getWebHistoryDbPath)() });
            return this.threadListStore;
        }
        catch (err) {
            this.threadListStoreInitError = String(err?.message ?? err ?? "init failed");
            return null;
        }
    }
    /**
     * 将 WS 新建线程的摘要写入 SQLite，保持与 HTTP 创建入口一致。
     */
    persistStartedThreadSummary(input) {
        const threadStartSummary = (0, threadStartSummary_1.buildThreadStartSummary)({
            thread: input.thread,
            fallbackCwd: input.fallbackCwd,
            fallbackModelProvider: input.fallbackModelProvider,
        });
        if (!threadStartSummary)
            return;
        const threadListStore = this.resolveThreadListStore();
        if (!threadListStore)
            return;
        threadListStore.upsertThreadSummary(threadStartSummary);
    }
    onConnection(ws, req) {
        // 防御性处理：任何畸形 header 都不应导致握手阶段抛错（DoS 风险）。
        let session = null;
        try {
            const cookies = (0, session_1.parseCookieHeader)(req.headers.cookie);
            const raw = cookies[session_1.SESSION_COOKIE_NAME];
            session = raw ? (0, session_1.verifySessionCookieValueWithRole)(raw, this.sessionSecret) : { username: "local-user", role: "admin" };
        }
        catch {
            session = null;
        }
        if (!session) {
            ws.close(1008, "unauthorized");
            return;
        }
        const scope = (0, wsScope_1.parseWsScopeFromRequest)(req);
        this.wsScopeByClient.set(ws, scope);
        this.clients.add(ws);
        setIsAlive(ws, true);
        ws.on("pong", () => setIsAlive(ws, true));
        void (async () => {
            const user = await this.resolveWsUserInfo(session);
            this.wsUser.set(ws, user);
            this.addUserClient(user.username, ws);
            await this.sendReady(ws);
            this.readyClients.add(ws);
            if (this.shouldReceiveGlobalMessages(ws)) {
                this.sendStatus(ws);
                setTimeout(() => void this.flushPendingForWs(ws), 0);
            }
        })();
        ws.on("message", async (data) => {
            let msg;
            try {
                msg = JSON.parse(data.toString("utf8"));
            }
            catch {
                return;
            }
            try {
                await this.handleAuthedMessage(ws, msg);
            }
            catch (err) {
                const action = describeClientAction(msg);
                const base = getErrorMessage(err);
                const message = base === "Request failed" ? `${action} failed` : `${action} failed: ${base}`;
                // 透传 clientMessageId，便于前端把失败原因绑定到具体 optimistic 消息。
                const clientMessageId = typeof msg?.clientMessageId === "string" ? String(msg.clientMessageId) : "";
                // 透传 requestId，便于前端将 list_threads 错误与最新请求做精确关联。
                const requestId = typeof msg?.requestId === "string" ? String(msg.requestId) : "";
                this.safeSend(ws, {
                    type: "error",
                    message,
                    details: getErrorDetails(err),
                    clientMessageId: clientMessageId || undefined,
                    requestId: requestId || undefined,
                });
            }
        });
        ws.on("close", () => {
            const username = this.wsUser.get(ws)?.username ?? "";
            this.clients.delete(ws);
            this.readyClients.delete(ws);
            this.wsUser.delete(ws);
            this.wsScopeByClient.delete(ws);
            this.activeThreadIdByClient.delete(ws);
            this.removeUserClient(username, ws);
            for (const [threadId, owner] of this.threadOwners.entries()) {
                if (owner === ws)
                    this.threadOwners.delete(threadId);
            }
        });
    }
    async resolveWsUserInfo(session) {
        const username = String(session.username ?? "").trim();
        const role = session.role;
        // 未配置 userStore 时保持兼容：不做用户级工作区限制（仍受全局 CODEX_ALLOWED_CWD_ROOTS 限制）。
        if (!this.userStore) {
            return { username, role, workspaces: [] };
        }
        const stored = await this.userStore.getUserByUsername(username);
        return stored
            ? { username: stored.username, role: stored.role, workspaces: (0, threadListVisibility_1.normalizeWorkspacePaths)(stored.workspaces) }
            : { username, role, workspaces: [] };
    }
    getWsUserInfo(ws) {
        const user = this.wsUser.get(ws);
        if (!user)
            throw new Error("unauthorized");
        return user;
    }
    getWsScope(ws) {
        return this.wsScopeByClient.get(ws) ?? "all";
    }
    // 是否允许该连接接收全局消息（status / user_input_* 等）。
    shouldReceiveGlobalMessages(ws) {
        const scope = this.getWsScope(ws);
        return scope === "all" || scope === "global";
    }
    // 是否允许该连接接收指定 threadId 的线程消息（chat_ops / todo / usage 等）。
    shouldReceiveThreadMessages(ws, threadId) {
        const scope = this.getWsScope(ws);
        if (scope === "all")
            return true;
        if (scope !== "thread")
            return false;
        return this.activeThreadIdByClient.get(ws) === threadId;
    }
    assertThreadSocketLockedToThread(ws, requestedThreadId) {
        if (this.getWsScope(ws) !== "thread")
            return;
        const threadId = String(requestedThreadId ?? "").trim();
        if (!threadId)
            return;
        const activeThreadId = this.activeThreadIdByClient.get(ws) ?? "";
        if (activeThreadId && activeThreadId !== threadId) {
            throw new Error("thread socket is locked to another thread");
        }
    }
    lockThreadSocketToThread(ws, threadId) {
        if (this.getWsScope(ws) !== "thread")
            return;
        const normalizedThreadId = String(threadId ?? "").trim();
        if (!normalizedThreadId)
            return;
        const activeThreadId = this.activeThreadIdByClient.get(ws) ?? "";
        if (activeThreadId && activeThreadId !== normalizedThreadId) {
            throw new Error("thread socket is locked to another thread");
        }
        this.activeThreadIdByClient.set(ws, normalizedThreadId);
    }
    async assertThreadAllowedForUser(ws, threadId) {
        const user = this.getWsUserInfo(ws);
        if ((0, roles_1.isAdminRole)(user.role))
            return;
        const cachedCwd = this.threadCwdById.get(threadId);
        const cwd = cachedCwd || String((await this.codex.readThread(threadId, false))?.cwd ?? "");
        if (!cwd)
            throw new Error("cwd not allowed");
        const canonical = await (0, accessControl_1.assertCwdAllowedForUser)({ cwd, user });
        this.threadCwdById.set(threadId, canonical);
    }
    startHeartbeat(intervalMs) {
        if (this.heartbeatTimer)
            clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
            for (const ws of this.clients) {
                if (ws.readyState !== ws_1.default.OPEN)
                    continue;
                if (!getIsAlive(ws)) {
                    ws.terminate();
                    continue;
                }
                setIsAlive(ws, false);
                try {
                    ws.ping();
                }
                catch {
                    ws.terminate();
                }
            }
        }, intervalMs);
    }
    async handleAuthedMessage(ws, msg) {
        if (msg.type === "get_status") {
            if (this.shouldReceiveGlobalMessages(ws)) {
                this.sendStatus(ws);
            }
            return;
        }
        if (msg.type === "list_threads") {
            // 会话列表必须按“当前用户权限 + 可选 cwd 过滤”返回，避免前端本地过滤造成越权可见。
            const requestedListThreadsRequestId = typeof msg.requestId === "string" ? msg.requestId.trim() : "";
            const { threads, workspaceFilterCwd } = await this.listThreadsForClient(ws, msg.cwd);
            this.safeSend(ws, {
                type: "threads",
                threads,
                requestId: requestedListThreadsRequestId || undefined,
                cwd: workspaceFilterCwd,
            });
            return;
        }
        if (msg.type === "open_thread") {
            this.assertThreadSocketLockedToThread(ws, String(msg?.threadId ?? ""));
            const user = this.getWsUserInfo(ws);
            const username = user.username;
            const clientMessageId = typeof msg.clientMessageId === "string" ? String(msg.clientMessageId) : "";
            if (username && clientMessageId) {
                const cached = this.getCachedOpenThreadResult(username, clientMessageId);
                if (cached) {
                    const cachedThreadId = String(cached.thread?.id ?? "");
                    if (cachedThreadId) {
                        this.lockThreadSocketToThread(ws, cachedThreadId);
                        this.setThreadOwner(cachedThreadId, ws, username);
                    }
                    const threadForClient = { ...cached.thread };
                    await this.attachThreadContextUsagePercent(threadForClient);
                    const chatItems = (0, threadTurnsProjector_1.projectThreadToChatItems)(threadForClient);
                    if (cachedThreadId) {
                        const createdAtMs = Number.isFinite(threadForClient?.createdAt)
                            ? Number(threadForClient.createdAt) * 1000
                            : Date.now();
                        this.threadCreatedAtMsById.set(cachedThreadId, createdAtMs);
                        this.markThreadSeenForUser(username, cachedThreadId);
                    }
                    this.safeSend(ws, { type: "thread_opened", thread: threadForClient, chatItems });
                    this.safeSend(ws, { type: "ack", ackType: "open_thread", clientMessageId, threadId: cachedThreadId || undefined });
                    return;
                }
            }
            let startedNewThread = false;
            let startedThreadCwd = null;
            let startedThreadModel = null;
            const thread = await (async () => {
                if (msg.threadId && msg.threadId.trim()) {
                    const resumed = await this.codex.resumeThread(msg.threadId);
                    const read = await this.codex.readThread(String(resumed.id ?? msg.threadId), true);
                    const resolvedThreadId = String(read?.id ?? resumed.id ?? msg.threadId);
                    const cwd = String(read?.cwd ?? "");
                    if (resolvedThreadId && cwd) {
                        const canonical = await (0, accessControl_1.assertCwdAllowedForUser)({ cwd, user });
                        this.threadCwdById.set(resolvedThreadId, canonical);
                        (0, cwdSwitchLogger_1.logCwdSwitch)({
                            event: "ws_open_thread_resume",
                            username,
                            role: user.role,
                            threadId: resolvedThreadId,
                            threadCwd: cwd,
                            canonicalCwd: canonical,
                            workspacesCount: user.workspaces.length,
                        });
                    }
                    return read;
                }
                // 统一在服务端按角色收敛执行策略：
                // - member 不允许通过 WS 提升到 `never`/`danger-full-access`；
                // - admin 保持原有可配置能力。
                const approvalPolicy = (0, executionPolicy_1.coerceApprovalPolicyForUser)({
                    userRole: user.role,
                    requested: msg.approvalPolicy,
                    fallback: (0, env_1.getCodexApprovalPolicy)(),
                });
                const sandbox = (0, executionPolicy_1.coerceSandboxModeForUser)({
                    userRole: user.role,
                    requested: msg.sandbox,
                    fallback: (0, env_1.getCodexSandboxMode)(),
                });
                const requestedCwd = typeof msg.cwd === "string" ? msg.cwd : "";
                const requestedModel = typeof msg.model === "string" ? msg.model : undefined;
                const cwd = await resolveCwdForNewThread(requestedCwd, user);
                const codexCwd = (0, windowsVerbatimPath_1.coerceCwdForCodex)(cwd);
                startedNewThread = true;
                startedThreadCwd = cwd;
                startedThreadModel = requestedModel ?? null;
                (0, cwdSwitchLogger_1.logCwdSwitch)({
                    event: "ws_open_thread_new",
                    username,
                    role: user.role,
                    requestedCwd,
                    canonicalCwd: cwd,
                    codexCwd,
                    workspacesCount: user.workspaces.length,
                });
                return this.codex.startThread({
                    cwd: codexCwd,
                    approvalPolicy,
                    sandbox,
                    model: requestedModel,
                });
            })();
            if (startedNewThread) {
                this.persistStartedThreadSummary({
                    thread,
                    fallbackCwd: startedThreadCwd ?? undefined,
                    fallbackModelProvider: startedThreadModel ?? undefined,
                });
            }
            const threadId = String(thread.id ?? msg.threadId ?? "");
            if (threadId) {
                this.lockThreadSocketToThread(ws, threadId);
                this.setThreadOwner(threadId, ws, username);
            }
            const threadCwd = String(thread?.cwd ?? "");
            if (threadId && threadCwd)
                this.threadCwdById.set(threadId, (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(threadCwd));
            const { threadForClient, turns } = this.trimThreadTurnsForClient(thread, this.initialThreadTurnLimit);
            if (username && threadId && turns.length)
                this.cacheThreadTurns(username, threadId, turns);
            await this.attachThreadContextUsagePercent(threadForClient);
            const chatItems = (0, threadTurnsProjector_1.projectThreadToChatItems)(threadForClient);
            if (threadId) {
                const createdAtMs = Number.isFinite(threadForClient?.createdAt)
                    ? Number(threadForClient.createdAt) * 1000
                    : Date.now();
                this.threadCreatedAtMsById.set(threadId, createdAtMs);
                this.markThreadSeenForUser(username, threadId);
            }
            this.safeSend(ws, { type: "thread_opened", thread: threadForClient, chatItems });
            if (username && clientMessageId)
                this.cacheOpenThreadResult(username, clientMessageId, threadForClient);
            if (clientMessageId)
                this.safeSend(ws, { type: "ack", ackType: "open_thread", clientMessageId, threadId: threadId || undefined });
            return;
        }
        if (msg.type === "load_thread_turns") {
            const username = this.getWsUserInfo(ws).username;
            const threadId = String(msg.threadId ?? "").trim();
            if (!threadId)
                return;
            await this.assertThreadAllowedForUser(ws, threadId);
            const clientMessageId = typeof msg.clientMessageId === "string" ? String(msg.clientMessageId) : "";
            const before = Number(msg.before);
            const requestedLimit = typeof msg.limit === "number" && Number.isFinite(msg.limit) ? Math.floor(msg.limit) : this.loadThreadTurnsDefaultLimit;
            const limit = Math.max(1, Math.min(this.loadThreadTurnsMaxLimit, requestedLimit));
            const turns = await this.getOrFetchThreadTurns(username, threadId);
            const total = turns.length;
            const safeBefore = Number.isFinite(before) ? Math.max(0, Math.min(total, Math.floor(before))) : total;
            const start = Math.max(0, safeBefore - limit);
            const slice = turns.slice(start, safeBefore);
            const createdAtMs = this.threadCreatedAtMsById.get(threadId) ?? Date.now();
            const chatItems = (0, threadTurnsProjector_1.projectTurnsToChatItems)(slice, { createdAtMs, turnsStart: start });
            this.safeSend(ws, { type: "thread_turns", threadId, turns: slice, turnsStart: start, turnsTotal: total, chatItems });
            if (clientMessageId)
                this.safeSend(ws, { type: "ack", ackType: "load_thread_turns", clientMessageId, threadId });
            return;
        }
        if (msg.type === "submit") {
            const threadId = String(msg.threadId ?? "").trim();
            if (!threadId)
                return;
            await this.assertThreadAllowedForUser(ws, threadId);
            const user = this.getWsUserInfo(ws);
            const clientMessageId = typeof msg.clientMessageId === "string" ? String(msg.clientMessageId) : "";
            if (clientMessageId) {
                const isDup = this.rememberSubmitId(threadId, clientMessageId);
                if (isDup) {
                    this.safeSend(ws, { type: "ack", ackType: "submit", threadId, clientMessageId });
                    return;
                }
            }
            const requestedApprovalPolicy = msg.approvalPolicy;
            const requestedSandbox = msg.sandbox;
            // turn 级别的权限也要按角色收敛，避免 member 通过消息覆写更高权限。
            const approvalPolicy = typeof requestedApprovalPolicy === "string" && requestedApprovalPolicy.trim()
                ? (0, executionPolicy_1.coerceApprovalPolicyForUser)({
                    userRole: user.role,
                    requested: requestedApprovalPolicy,
                    fallback: (0, env_1.getCodexApprovalPolicy)(),
                })
                : undefined;
            const sandbox = typeof requestedSandbox === "string" && requestedSandbox.trim()
                ? (0, executionPolicy_1.coerceSandboxModeForUser)({
                    userRole: user.role,
                    requested: requestedSandbox,
                    fallback: (0, env_1.getCodexSandboxMode)(),
                })
                : undefined;
            const turnOpts = {
                model: typeof msg.model === "string" ? msg.model : undefined,
                effort: typeof msg.effort === "string" ? msg.effort : typeof msg.reasoningEffort === "string" ? msg.reasoningEffort : undefined,
                serviceTier: msg.serviceTier === "fast" ? msg.serviceTier : undefined,
                approvalPolicy,
                sandbox,
                collaborationMode: msg.collaborationMode && typeof msg.collaborationMode === "object" ? msg.collaborationMode : undefined,
            };
            try {
                await this.codex.startTurn(threadId, msg.text, turnOpts);
            }
            catch (firstErr) {
                // When backend state is stale after reconnect/restart, try to recover the thread once before failing.
                const recoverable = this.isThreadNotFoundError(firstErr);
                if (!recoverable) {
                    if (clientMessageId)
                        this.forgetSubmitId(threadId, clientMessageId);
                    throw firstErr;
                }
                try {
                    await this.recoverThreadForSubmit(ws, threadId);
                    await this.codex.startTurn(threadId, msg.text, turnOpts);
                }
                catch (retryErr) {
                    if (clientMessageId)
                        this.forgetSubmitId(threadId, clientMessageId);
                    throw retryErr;
                }
            }
            if (clientMessageId)
                this.safeSend(ws, { type: "ack", ackType: "submit", threadId, clientMessageId });
            return;
        }
        if (msg.type === "interrupt") {
            const threadId = String(msg.threadId ?? "").trim();
            if (!threadId)
                return;
            await this.assertThreadAllowedForUser(ws, threadId);
            const clientMessageId = typeof msg.clientMessageId === "string" ? String(msg.clientMessageId) : "";
            if (clientMessageId) {
                const isDup = this.rememberInterruptId(threadId, clientMessageId);
                if (isDup) {
                    this.safeSend(ws, { type: "ack", ackType: "interrupt", clientMessageId, threadId });
                    return;
                }
            }
            const turnIds = await this.resolveInterruptTurnIds(ws, threadId);
            if (!turnIds.length) {
                if (clientMessageId)
                    this.safeSend(ws, { type: "ack", ackType: "interrupt", clientMessageId, threadId });
                return;
            }
            await Promise.allSettled(turnIds.map((turnId) => this.codex.interruptTurn(threadId, turnId)));
            if (clientMessageId)
                this.safeSend(ws, { type: "ack", ackType: "interrupt", clientMessageId, threadId });
            return;
        }
        if (msg.type === "respond_user_input") {
            const pending = this.pending.get(msg.requestId);
            const clientMessageId = typeof msg.clientMessageId === "string" ? String(msg.clientMessageId) : "";
            if (!pending) {
                if (clientMessageId) {
                    this.safeSend(ws, { type: "ack", ackType: "respond_user_input", clientMessageId, requestId: msg.requestId });
                }
                return;
            }
            const user = this.getWsUserInfo(ws);
            if (!this.isUserAuthorizedForPending(user, pending)) {
                if (clientMessageId) {
                    this.safeSend(ws, { type: "ack", ackType: "respond_user_input", clientMessageId, requestId: msg.requestId });
                }
                return;
            }
            clearTimeout(pending.timeout);
            this.pending.delete(msg.requestId);
            if (this.workspaceStatusStore && pending.threadId && pending.threadCwd && pending.visibleUsernames.length) {
                void this.workspaceStatusStore.setThreadPendingForUsers({
                    usernames: pending.visibleUsernames,
                    threadId: pending.threadId,
                    cwd: pending.threadCwd,
                    isPending: false,
                    updatedAtMs: Date.now(),
                });
            }
            const mappedResponse = mapUserResponseToCodexResult(pending.method, msg.response);
            pending.resolve(mappedResponse);
            if (pending.threadId && this.historyIngest) {
                void this.historyIngest
                    .recordCodexEvent({
                    threadId: pending.threadId,
                    method: "web/user_input_resolved",
                    params: {
                        threadId: pending.threadId,
                        requestId: msg.requestId,
                        method: pending.method,
                        response: msg.response,
                        mappedResponse,
                        requestParams: pending.params,
                    },
                })
                    .catch(() => {
                    // 历史落库失败不应影响用户输入响应链路。
                });
            }
            this.broadcastUserInputResolved(msg.requestId, pending, {
                response: msg.response,
                mappedResponse,
                requestParams: pending.params,
            });
            if (clientMessageId) {
                this.safeSend(ws, { type: "ack", ackType: "respond_user_input", clientMessageId, requestId: msg.requestId });
            }
            return;
        }
    }
    // 根据当前用户权限与可选 cwd 过滤条件，返回可见会话列表。
    async listThreadsForClient(ws, requestedCwd) {
        // 每个连接都绑定了认证用户，列表过滤必须以该用户为基准。
        const user = this.getWsUserInfo(ws);
        const routingSnapshot = await this.getWorkspaceRoutingSnapshot().catch(() => null);
        const workspaceFilterCwd = await (0, threadListVisibility_1.resolveThreadListWorkspaceFilter)(requestedCwd, user);
        // 显式拉取更多线程，避免 codex 默认条数截断导致旧会话（含置顶）在客户端列表中“消失”。
        const threads = await this.codex.listThreads(threadListCliLimit_1.THREAD_LIST_CLI_LIMIT);
        const visibleThreads = threads.filter((thread) => (0, threadListVisibility_1.shouldIncludeThreadForList)({
            thread,
            user,
            workspaceFilterCwd,
            routingSnapshot,
        }));
        const sanitizedThreads = visibleThreads.map((thread) => (0, threadSanitize_1.sanitizeThreadForClient)(thread));
        return {
            threads: sanitizedThreads,
            workspaceFilterCwd,
        };
    }
    async getWorkspaceRoutingSnapshot() {
        if (!this.userStore)
            return null;
        const now = Date.now();
        const cached = this.workspaceRoutingSnapshot;
        if (cached && now - cached.updatedAtMs <= this.workspaceRoutingSnapshotTtlMs) {
            return cached;
        }
        const inflight = this.workspaceRoutingSnapshotPromise;
        if (inflight)
            return inflight;
        const refreshP = this.userStore
            .listUsers()
            .then((users) => (0, threadListVisibility_1.buildWorkspaceRoutingSnapshot)(users))
            .then((snapshot) => {
            this.workspaceRoutingSnapshot = snapshot;
            return snapshot;
        })
            .finally(() => {
            this.workspaceRoutingSnapshotPromise = null;
        });
        this.workspaceRoutingSnapshotPromise = refreshP;
        return refreshP;
    }
    // 判断某个 cwd 是否在当前用户可见范围内（admin 全可见，member 仅分配根目录范围）。
    isCwdVisibleToUser(cwd, user, routingSnapshot) {
        return (0, threadListVisibility_1.isThreadCwdVisibleToUser)({
            cwd,
            user,
            routingSnapshot,
        });
    }
    /**
     * 解析对指定 cwd 可见的用户名列表：用于同步目录级状态到数据库。
     */
    async resolveVisibleUsernamesForThreadCwd(cwdRaw) {
        if (!this.userStore)
            return [];
        const users = await this.userStore.listUsers();
        return (0, workspaceStatusVisibility_1.resolveVisibleUsernamesForCwd)(cwdRaw, users);
    }
    /**
     * 线程被任意用户打开后，清除该线程的“刚结束”标记（全局已读语义）。
     */
    markThreadSeenForUser(usernameRaw, threadIdRaw) {
        const username = String(usernameRaw ?? "").trim();
        const threadId = String(threadIdRaw ?? "").trim();
        if (!username || !threadId)
            return;
        if (!this.workspaceStatusStore)
            return;
        void this.workspaceStatusStore.markThreadSeen(username, threadId, Date.now()).catch(() => {
            // best-effort only
        });
    }
    // 获取 thread cwd，并缓存到 threadCwdById；用于 WS 事件与审批路由等场景。
    async getOrFetchThreadCwd(threadId) {
        const cached = this.threadCwdById.get(threadId);
        if (cached) {
            const sanitizedCachedCwd = (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(String(cached));
            if (sanitizedCachedCwd !== cached)
                this.threadCwdById.set(threadId, sanitizedCachedCwd);
            return sanitizedCachedCwd;
        }
        const thread = await this.codex.readThread(threadId, false);
        const rawCwd = String(thread?.cwd ?? "").trim();
        const cwd = (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(rawCwd);
        if (!cwd)
            return null;
        this.threadCwdById.set(threadId, cwd);
        return cwd;
    }
    /**
     * 将消息广播给“对该 thread cwd 有权限”的在线用户，避免跨工作区泄露。
     * 说明：同一通知可能对应多条下发消息（chat_ops + todo + usage），因此这里支持批量发送。
     */
    broadcastMessagesToAuthorizedUsers(threadId, messages) {
        void (async () => {
            const normalizedThreadId = typeof threadId === "string" ? threadId.trim() : "";
            if (!normalizedThreadId)
                return;
            if (!messages.length)
                return;
            const threadCwd = await this.getOrFetchThreadCwd(normalizedThreadId).catch(() => null);
            if (!threadCwd)
                return;
            const resolvedThreadCwd = path_1.default.resolve(threadCwd);
            const routingSnapshot = await this.getWorkspaceRoutingSnapshot().catch(() => null);
            const workspaceRoot = routingSnapshot ? (0, threadListVisibility_1.resolveWorkspaceRootForCwd)(routingSnapshot, resolvedThreadCwd) : null;
            for (const ws of this.readyClients) {
                if (ws.readyState !== ws_1.default.OPEN)
                    continue;
                if (!this.shouldReceiveThreadMessages(ws, normalizedThreadId))
                    continue;
                const user = this.wsUser.get(ws);
                if (!user)
                    continue;
                if (workspaceRoot) {
                    if (!(0, roles_1.isAdminRole)(user.role) && !user.workspaces.includes(workspaceRoot))
                        continue;
                }
                else {
                    if (!this.isCwdVisibleToUser(resolvedThreadCwd, user, routingSnapshot))
                        continue;
                }
                for (const message of messages) {
                    this.safeSend(ws, message);
                }
            }
        })().catch(() => {
            // best-effort only
        });
    }
    async sendReady(ws) {
        try {
            // ready 阶段也使用与 list_threads 一致的过滤，避免首次连接时暴露越权会话。
            const { threads } = await this.listThreadsForClient(ws, null);
            this.safeSend(ws, { type: "ready", serverVersion: "0.0.0", threads });
        }
        catch (err) {
            this.safeSend(ws, { type: "error", message: "Failed to list threads", details: String(err) });
        }
    }
    rememberSubmitId(threadId, clientMessageId) {
        const now = Date.now();
        let map = this.seenSubmitIdsByThread.get(threadId);
        if (!map) {
            map = new Map();
            this.seenSubmitIdsByThread.set(threadId, map);
        }
        // Drop expired ids (best-effort; also keeps the map small).
        for (const [id, ts] of map.entries()) {
            if (now - ts > this.submitDedupTtlMs)
                map.delete(id);
        }
        const isDup = map.has(clientMessageId);
        map.set(clientMessageId, now);
        // Cap per-thread memory. Keep the newest ids.
        if (map.size > this.submitDedupMaxPerThread) {
            const entries = Array.from(map.entries()).sort((a, b) => a[1] - b[1]);
            const toDrop = entries.length - this.submitDedupMaxPerThread;
            for (let i = 0; i < toDrop; i += 1)
                map.delete(entries[i][0]);
        }
        return isDup;
    }
    forgetSubmitId(threadId, clientMessageId) {
        const map = this.seenSubmitIdsByThread.get(threadId);
        if (!map)
            return;
        map.delete(clientMessageId);
        if (!map.size)
            this.seenSubmitIdsByThread.delete(threadId);
    }
    getCachedOpenThreadResult(username, clientMessageId) {
        const now = Date.now();
        const map = this.openThreadResultsByUser.get(username);
        if (!map)
            return null;
        for (const [id, v] of map.entries()) {
            if (now - v.ts > this.openThreadDedupTtlMs)
                map.delete(id);
        }
        return map.get(clientMessageId) ?? null;
    }
    cacheOpenThreadResult(username, clientMessageId, thread) {
        const now = Date.now();
        let map = this.openThreadResultsByUser.get(username);
        if (!map) {
            map = new Map();
            this.openThreadResultsByUser.set(username, map);
        }
        map.set(clientMessageId, { ts: now, thread });
        if (map.size > this.openThreadDedupMaxPerUser) {
            const entries = Array.from(map.entries()).sort((a, b) => a[1].ts - b[1].ts);
            const toDrop = entries.length - this.openThreadDedupMaxPerUser;
            for (let i = 0; i < toDrop; i += 1)
                map.delete(entries[i][0]);
        }
    }
    trimThreadTurnsForClient(thread, limit) {
        const t = thread;
        const allTurns = Array.isArray(t?.turns) ? t.turns : [];
        const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
        const start = Math.max(0, allTurns.length - safeLimit);
        const sliced = safeLimit > 0 ? allTurns.slice(start) : [];
        const rawThreadForClient = {
            ...t,
            turns: sliced,
            turnsStart: start,
            turnsTotal: allTurns.length,
        };
        const threadForClient = (0, threadSanitize_1.sanitizeThreadForClient)(rawThreadForClient);
        return { threadForClient, turns: allTurns };
    }
    /**
     * 从线程 session 文件中读取最新 token_count，并写入 `contextUsagePercent` 字段。
     * 说明：前端会从 thread_opened payload 中读取该值，以解决“刚进来没有上下文使用率”的问题。
     */
    async attachThreadContextUsagePercent(thread) {
        const t = thread;
        const sessionPath = String(t?.path ?? "").trim();
        if (!sessionPath)
            return;
        const usagePercent = await this.threadContextUsageReader.readUsagePercent(sessionPath);
        if (usagePercent === null)
            return;
        t.contextUsagePercent = usagePercent;
    }
    cacheThreadTurns(username, threadId, turns) {
        if (!username || !threadId)
            return;
        const now = Date.now();
        let map = this.threadTurnsByUser.get(username);
        if (!map) {
            map = new Map();
            this.threadTurnsByUser.set(username, map);
        }
        // Drop expired entries best-effort.
        for (const [id, v] of map.entries()) {
            if (now - v.ts > this.threadTurnsCacheTtlMs)
                map.delete(id);
        }
        map.set(threadId, { ts: now, turns });
        if (map.size > this.threadTurnsCacheMaxPerUser) {
            const entries = Array.from(map.entries()).sort((a, b) => a[1].ts - b[1].ts);
            const toDrop = entries.length - this.threadTurnsCacheMaxPerUser;
            for (let i = 0; i < toDrop; i += 1)
                map.delete(entries[i][0]);
        }
    }
    getCachedThreadTurns(username, threadId) {
        const map = this.threadTurnsByUser.get(username);
        if (!map)
            return null;
        const v = map.get(threadId);
        if (!v)
            return null;
        if (Date.now() - v.ts > this.threadTurnsCacheTtlMs) {
            map.delete(threadId);
            return null;
        }
        return v.turns;
    }
    async getOrFetchThreadTurns(username, threadId) {
        const cached = this.getCachedThreadTurns(username, threadId);
        if (cached)
            return cached;
        const thread = await this.codex.readThread(threadId, true);
        const t = thread;
        const turns = Array.isArray(t?.turns) ? t.turns : [];
        if (username && turns.length)
            this.cacheThreadTurns(username, threadId, turns);
        return turns;
    }
    /**
     * 解析本次 interrupt 应该尝试中断的 turnId 列表。
     * 优先使用任务跟踪器提供的 active turnId；若为空，则回退为线程中最新的 turnId（尽力而为）。
     */
    async resolveInterruptTurnIds(ws, threadId) {
        const activeTurnIds = this.getActiveTurnIds(threadId).filter((turnId) => Boolean(String(turnId || "").trim()));
        if (activeTurnIds.length)
            return activeTurnIds;
        const fallbackTurnId = await this.getLatestThreadTurnId(ws, threadId);
        return fallbackTurnId ? [fallbackTurnId] : [];
    }
    /**
     * 从线程 turns 中提取“最新一个可用的 turnId”，用于 active turnId 缺失时的保底中断。
     * 注意：这是 best-effort，任何读取/解析异常都应返回 null，避免影响 ack 流程。
     */
    async getLatestThreadTurnId(ws, threadId) {
        const username = this.getWsUserInfo(ws).username;
        try {
            const turns = await this.getOrFetchThreadTurns(username, threadId);
            for (let index = turns.length - 1; index >= 0; index -= 1) {
                const turnId = extractThreadTurnId(turns[index]);
                if (turnId)
                    return turnId;
            }
            return null;
        }
        catch {
            return null;
        }
    }
    isThreadNotFoundError(err) {
        // Only auto-recover when the error clearly indicates thread lookup failure.
        const normalizedMessage = getErrorMessage(err).toLowerCase();
        return normalizedMessage.includes("thread") && normalizedMessage.includes("not found");
    }
    async recoverThreadForSubmit(ws, threadId) {
        // Re-hydrate thread state and send thread_opened so frontend state aligns with backend state.
        const resumed = await this.codex.resumeThread(threadId);
        const recoveredThreadId = String(resumed?.id ?? threadId);
        const thread = await this.codex.readThread(recoveredThreadId, true);
        const username = this.getWsUserInfo(ws).username;
        const effectiveThreadId = String(thread?.id ?? recoveredThreadId);
        if (effectiveThreadId)
            this.setThreadOwner(effectiveThreadId, ws, username);
        const threadCwd = String(thread?.cwd ?? "");
        if (effectiveThreadId && threadCwd)
            this.threadCwdById.set(effectiveThreadId, (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(threadCwd));
        const { threadForClient, turns } = this.trimThreadTurnsForClient(thread, this.initialThreadTurnLimit);
        if (username && effectiveThreadId && turns.length)
            this.cacheThreadTurns(username, effectiveThreadId, turns);
        await this.attachThreadContextUsagePercent(threadForClient);
        const chatItems = (0, threadTurnsProjector_1.projectThreadToChatItems)(threadForClient);
        if (effectiveThreadId) {
            const createdAtMs = Number.isFinite(threadForClient?.createdAt)
                ? Number(threadForClient.createdAt) * 1000
                : Date.now();
            this.threadCreatedAtMsById.set(effectiveThreadId, createdAtMs);
        }
        this.safeSend(ws, { type: "thread_opened", thread: threadForClient, chatItems });
    }
    rememberInterruptId(threadId, clientMessageId) {
        const now = Date.now();
        let map = this.seenInterruptIdsByThread.get(threadId);
        if (!map) {
            map = new Map();
            this.seenInterruptIdsByThread.set(threadId, map);
        }
        for (const [id, ts] of map.entries()) {
            if (now - ts > this.interruptDedupTtlMs)
                map.delete(id);
        }
        const isDup = map.has(clientMessageId);
        map.set(clientMessageId, now);
        if (map.size > this.interruptDedupMaxPerThread) {
            const entries = Array.from(map.entries()).sort((a, b) => a[1] - b[1]);
            const toDrop = entries.length - this.interruptDedupMaxPerThread;
            for (let i = 0; i < toDrop; i += 1)
                map.delete(entries[i][0]);
        }
        return isDup;
    }
    startStatusPump(intervalMs) {
        if (this.statusTimer)
            clearInterval(this.statusTimer);
        this.statusTimer = setInterval(() => {
            if (!this.readyClients.size)
                return;
            this.broadcastStatus();
        }, intervalMs);
    }
    sendStatus(ws) {
        const snapshot = sanitizeStatusSnapshotForWs(this.getStatusSnapshot());
        this.safeSend(ws, { type: "status", snapshot });
    }
    broadcastStatus() {
        const snapshot = sanitizeStatusSnapshotForWs(this.getStatusSnapshot());
        const msg = { type: "status", snapshot };
        const encoded = JSON.stringify(msg);
        if (encoded === this.lastStatusJson)
            return;
        this.lastStatusJson = encoded;
        for (const ws of this.readyClients) {
            if (ws.readyState !== ws_1.default.OPEN)
                continue;
            if (!this.shouldReceiveGlobalMessages(ws))
                continue;
            ws.send(encoded);
        }
    }
    broadcast(message) {
        const encoded = JSON.stringify(message);
        for (const ws of this.clients) {
            if (ws.readyState !== ws_1.default.OPEN)
                continue;
            ws.send(encoded);
        }
    }
    safeSend(ws, message) {
        if (ws.readyState !== ws_1.default.OPEN)
            return;
        ws.send(JSON.stringify(message));
    }
    async handleCodexServerRequest(req) {
        if (req.method === "item/tool/call") {
            const params = req.params;
            const tool = String(params?.tool ?? "unknown");
            return {
                success: false,
                contentItems: [{ type: "inputText", text: `Dynamic tool calls are not supported yet: ${tool}` }],
            };
        }
        const rawThreadId = extractThreadId(req.params);
        const normalizedThreadId = typeof rawThreadId === "string" ? rawThreadId.trim() : "";
        const threadId = normalizedThreadId ? normalizedThreadId : null;
        const threadCwdRaw = threadId ? await this.getOrFetchThreadCwd(threadId).catch(() => null) : null;
        const threadCwd = threadCwdRaw ? path_1.default.resolve(threadCwdRaw) : null;
        // user_input_required / resolved 必须按“最具体工作区”路由，避免父工作区收到子工作区的审批/交互请求。
        const routingSnapshot = threadCwd ? await this.getWorkspaceRoutingSnapshot().catch(() => null) : null;
        const workspaceRoot = threadCwd && routingSnapshot ? (0, threadListVisibility_1.resolveWorkspaceRootForCwd)(routingSnapshot, threadCwd) : null;
        const targetUsername = !threadCwd && threadId ? this.resolvePendingTargetUsername(threadId) : null;
        const visibleUsernames = threadCwd ? await this.resolveVisibleUsernamesForThreadCwd(threadCwd).catch(() => []) : targetUsername ? [targetUsername] : [];
        const approvalRequestCwd = (0, approvalCwdAccess_1.isApprovalRequestMethod)(req.method) ? (0, approvalCwdAccess_1.extractApprovalRequestCwd)(req.params, threadCwd) : null;
        const approvalEligibleUsernames = (0, approvalCwdAccess_1.isApprovalRequestMethod)(req.method) && approvalRequestCwd
            ? await this.resolveApprovalEligibleUsernames({
                candidateUsernames: visibleUsernames,
                approvalRequestCwd,
            })
            : null;
        const pendingVisibleUsernames = approvalEligibleUsernames ?? visibleUsernames;
        // 为 fileChange approval 预解析变更列表，避免前端在主线程解析 raw params。
        const fileChanges = req.method === "item/fileChange/requestApproval" ? (0, fileChangeExtractor_1.extractFileChangesFromAny)(req.params) : [];
        const normalizedFileChanges = fileChanges.length ? fileChanges : null;
        if ((0, approvalCwdAccess_1.isApprovalRequestMethod)(req.method) && approvalRequestCwd && visibleUsernames.length && approvalEligibleUsernames && !approvalEligibleUsernames.length) {
            const deniedResponse = autoDeclineResult(req.method);
            const requestParams = enrichApprovalRequestParamsForAudit(req.params, {
                approvalRequestCwd,
                denialReason: "approval cwd rejected by approvalCwdCheckMode",
            });
            if (threadId && this.historyIngest) {
                void this.historyIngest
                    .recordCodexEvent({
                    threadId,
                    method: "web/user_input_resolved",
                    params: {
                        threadId,
                        requestId: req.id,
                        method: req.method,
                        response: deniedResponse,
                        mappedResponse: deniedResponse,
                        requestParams,
                    },
                })
                    .catch(() => {
                    // 历史落库失败不应影响即时拒绝链路。
                });
            }
            this.broadcastUserInputResolved(req.id, {
                method: req.method,
                threadId,
                threadCwd,
                workspaceRoot,
                targetUsername,
            }, {
                response: deniedResponse,
                mappedResponse: deniedResponse,
                requestParams,
            });
            return deniedResponse;
        }
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.workspaceStatusStore && threadId && threadCwd && visibleUsernames.length) {
                    void this.workspaceStatusStore.setThreadPendingForUsers({
                        usernames: pendingVisibleUsernames,
                        threadId,
                        cwd: threadCwd,
                        isPending: false,
                        updatedAtMs: Date.now(),
                    });
                }
                this.pending.delete(req.id);
                resolve(autoDeclineResult(req.method));
            }, this.pendingTimeoutMs);
            const pending = {
                method: req.method,
                params: req.params,
                threadId,
                threadCwd,
                workspaceRoot,
                targetUsername,
                visibleUsernames: pendingVisibleUsernames,
                approvalEligibleUsernames,
                fileChanges: normalizedFileChanges,
                sentTo: new WeakSet(),
                resolve,
                reject,
                timeout,
            };
            this.pending.set(req.id, pending);
            if (this.workspaceStatusStore && threadId && threadCwd && pendingVisibleUsernames.length) {
                void this.workspaceStatusStore.setThreadPendingForUsers({
                    usernames: pendingVisibleUsernames,
                    threadId,
                    cwd: threadCwd,
                    isPending: true,
                    updatedAtMs: Date.now(),
                });
            }
            this.dispatchPendingToReadyClients(req.id, pending);
            if (threadId && this.historyIngest) {
                void this.historyIngest
                    .recordCodexEvent({
                    threadId,
                    method: "web/user_input_required",
                    params: {
                        threadId,
                        requestId: req.id,
                        method: req.method,
                        params: req.params,
                    },
                })
                    .catch(() => {
                    // 历史落库失败不应影响用户输入请求下发。
                });
            }
        });
    }
    resolvePendingTargetUsername(threadId) {
        const ownerWs = this.threadOwners.get(threadId) ?? null;
        if (ownerWs && ownerWs.readyState === ws_1.default.OPEN) {
            const username = String(this.wsUser.get(ownerWs)?.username ?? "").trim();
            if (username)
                return username;
        }
        const cached = String(this.threadOwnerUsername.get(threadId)?.username ?? "").trim();
        return cached || null;
    }
    setThreadOwner(threadId, ws, username) {
        this.threadOwners.set(threadId, ws);
        if (username) {
            this.threadOwnerUsername.set(threadId, { username, ts: Date.now() });
            this.pruneThreadOwnerUsernames();
        }
    }
    pruneThreadOwnerUsernames() {
        if (this.threadOwnerUsername.size <= this.threadOwnerUsernameMax)
            return;
        const entries = Array.from(this.threadOwnerUsername.entries()).sort((a, b) => a[1].ts - b[1].ts);
        const toDrop = entries.length - this.threadOwnerUsernameMax;
        for (let i = 0; i < toDrop; i += 1)
            this.threadOwnerUsername.delete(entries[i][0]);
    }
    addUserClient(username, ws) {
        if (!username)
            return;
        const set = this.wsByUser.get(username) ?? new Set();
        set.add(ws);
        this.wsByUser.set(username, set);
    }
    removeUserClient(username, ws) {
        if (!username)
            return;
        const set = this.wsByUser.get(username);
        if (!set)
            return;
        set.delete(ws);
        if (!set.size)
            this.wsByUser.delete(username);
    }
    isUserAuthorizedForPending(user, pending) {
        if (pending.approvalEligibleUsernames) {
            return pending.approvalEligibleUsernames.includes(user.username);
        }
        if ((0, roles_1.isAdminRole)(user.role))
            return true;
        if (pending.workspaceRoot)
            return user.workspaces.includes(pending.workspaceRoot);
        if (pending.threadCwd)
            return this.isCwdVisibleToUser(pending.threadCwd, user, null);
        if (pending.targetUsername)
            return user.username === pending.targetUsername;
        return false;
    }
    flushPendingForWs(ws) {
        if (ws.readyState !== ws_1.default.OPEN)
            return;
        if (!this.shouldReceiveGlobalMessages(ws))
            return;
        const user = this.wsUser.get(ws);
        if (!user)
            return;
        for (const [requestId, pending] of this.pending.entries()) {
            if (pending.sentTo.has(ws))
                continue;
            if (!this.isUserAuthorizedForPending(user, pending))
                continue;
            pending.sentTo.add(ws);
            this.safeSend(ws, {
                type: "user_input_required",
                requestId,
                threadId: pending.threadId,
                method: pending.method,
                params: pending.params,
                fileChanges: pending.fileChanges ?? undefined,
            });
        }
    }
    dispatchPendingToReadyClients(requestId, pending) {
        if (pending.threadCwd) {
            for (const ws of this.readyClients) {
                if (ws.readyState !== ws_1.default.OPEN)
                    continue;
                if (!this.shouldReceiveGlobalMessages(ws))
                    continue;
                if (pending.sentTo.has(ws))
                    continue;
                const user = this.wsUser.get(ws);
                if (!user)
                    continue;
                if (pending.approvalEligibleUsernames && !pending.approvalEligibleUsernames.includes(user.username))
                    continue;
                if (pending.workspaceRoot) {
                    if (!(0, roles_1.isAdminRole)(user.role) && !user.workspaces.includes(pending.workspaceRoot))
                        continue;
                }
                else {
                    if (!this.isCwdVisibleToUser(pending.threadCwd, user, null))
                        continue;
                }
                pending.sentTo.add(ws);
                this.safeSend(ws, {
                    type: "user_input_required",
                    requestId,
                    threadId: pending.threadId,
                    method: pending.method,
                    params: pending.params,
                    fileChanges: pending.fileChanges ?? undefined,
                });
            }
            return;
        }
        if (pending.targetUsername) {
            const set = this.wsByUser.get(pending.targetUsername);
            if (!set)
                return;
            for (const ws of set) {
                if (!this.readyClients.has(ws))
                    continue;
                if (ws.readyState !== ws_1.default.OPEN)
                    continue;
                if (!this.shouldReceiveGlobalMessages(ws))
                    continue;
                if (pending.sentTo.has(ws))
                    continue;
                const user = this.wsUser.get(ws);
                if (!user)
                    continue;
                if (pending.approvalEligibleUsernames && !pending.approvalEligibleUsernames.includes(user.username))
                    continue;
                pending.sentTo.add(ws);
                this.safeSend(ws, {
                    type: "user_input_required",
                    requestId,
                    threadId: pending.threadId,
                    method: pending.method,
                    params: pending.params,
                    fileChanges: pending.fileChanges ?? undefined,
                });
            }
        }
    }
    broadcastUserInputResolved(requestId, pending, resolved) {
        const msg = {
            type: "user_input_resolved",
            requestId,
            threadId: pending.threadId,
            method: pending.method,
            response: resolved?.response,
            mappedResponse: resolved?.mappedResponse,
            requestParams: resolved?.requestParams,
        };
        if (pending.threadCwd) {
            for (const ws of this.readyClients) {
                if (ws.readyState !== ws_1.default.OPEN)
                    continue;
                if (!this.shouldReceiveGlobalMessages(ws))
                    continue;
                const user = this.wsUser.get(ws);
                if (!user)
                    continue;
                if (pending.workspaceRoot) {
                    if (!(0, roles_1.isAdminRole)(user.role) && !user.workspaces.includes(pending.workspaceRoot))
                        continue;
                }
                else {
                    if (!this.isCwdVisibleToUser(pending.threadCwd, user, null))
                        continue;
                }
                this.safeSend(ws, msg);
            }
            return;
        }
        if (pending.targetUsername) {
            const set = this.wsByUser.get(pending.targetUsername);
            if (!set)
                return;
            for (const ws of set) {
                if (!this.readyClients.has(ws))
                    continue;
                if (ws.readyState !== ws_1.default.OPEN)
                    continue;
                if (!this.shouldReceiveGlobalMessages(ws))
                    continue;
                this.safeSend(ws, msg);
            }
        }
    }
    /**
     * 按各用户的审批 cwd 校验模式筛出真正允许处理审批的用户名列表。
     */
    async resolveApprovalEligibleUsernames(input) {
        if (!this.userStore)
            return [...input.candidateUsernames];
        /**
         * approvableUsernames：最终允许处理审批的用户名列表。
         */
        const approvableUsernames = [];
        for (const candidateUsername of input.candidateUsernames) {
            /**
             * normalizedUsername：当前遍历的用户名。
             */
            const normalizedUsername = String(candidateUsername ?? "").trim();
            if (!normalizedUsername)
                continue;
            /**
             * storedUser：用户名对应的持久化用户信息。
             */
            const storedUser = await this.userStore.getUserByUsername(normalizedUsername);
            if (!storedUser)
                continue;
            /**
             * userSettings：用户名对应的全局设置；缺失时按默认模式 `auth-workspaces` 处理。
             */
            const userSettings = this.userSettingsStore ? await this.userSettingsStore.getUserSettings(normalizedUsername) : null;
            /**
             * approvalCwdCheckMode：当前用户选择的审批 cwd 校验模式。
             */
            const approvalCwdCheckMode = userSettings?.approvalCwdCheckMode ?? "auth-workspaces";
            /**
             * userWorkspaceDirs：当前用户保存的工作目录列表；仅在 mode2 下参与判断。
             */
            const userWorkspaceDirs = approvalCwdCheckMode === "user-workspace-dirs" && this.userWorkspaceStore
                ? await this.userWorkspaceStore.listUserWorkspaceDirs(normalizedUsername)
                : [];
            const allowed = (0, approvalCwdAccess_1.isApprovalCwdAllowedForUser)({
                approvalRequestCwd: input.approvalRequestCwd,
                approvalCwdCheckMode,
                user: {
                    role: storedUser.role,
                    workspaces: storedUser.workspaces,
                },
                userWorkspaceDirs,
            });
            if (allowed)
                approvableUsernames.push(normalizedUsername);
        }
        return approvableUsernames;
    }
}
exports.WsHub = WsHub;
function getIsAlive(ws) {
    return Boolean(ws.isAlive);
}
function setIsAlive(ws, value) {
    ws.isAlive = value;
}
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
/**
 * 从 thread turns 列表的元素中提取 turnId。
 * 这里接受多个字段名，避免不同 codex/app-server 版本字段差异导致回退中断失效。
 */
function extractThreadTurnId(turn) {
    const t = turn;
    const raw = t?.id ?? t?.turnId ?? t?.turn_id ?? t?.turn?.id ?? null;
    if (raw === null || raw === undefined)
        return null;
    const normalizedTurnId = String(raw).trim();
    return normalizedTurnId || null;
}
function mapUserResponseToCodexResult(method, response) {
    const r = response;
    if (method === "item/commandExecution/requestApproval") {
        const d = r?.decision;
        if (d === "accept" || d === "acceptForSession" || d === "decline" || d === "cancel")
            return { decision: d };
        // Schema uses an object decision for execpolicy amendments:
        // { decision: { acceptWithExecpolicyAmendment: { execpolicy_amendment: string[] } } }
        if (d && typeof d === "object" && !Array.isArray(d)) {
            const inner = d.acceptWithExecpolicyAmendment;
            const amendment = inner?.execpolicy_amendment;
            if (inner && Array.isArray(amendment)) {
                return {
                    decision: {
                        acceptWithExecpolicyAmendment: { execpolicy_amendment: amendment.map(String) },
                    },
                };
            }
        }
        // Be tolerant of older UI payloads.
        if (d === "acceptWithExecpolicyAmendment") {
            const amendment = Array.isArray(r?.execpolicy_amendment)
                ? r.execpolicy_amendment
                : Array.isArray(r?.execPolicyAmendment)
                    ? r.execPolicyAmendment
                    : null;
            if (amendment) {
                return {
                    decision: { acceptWithExecpolicyAmendment: { execpolicy_amendment: amendment.map(String) } },
                };
            }
        }
        return { decision: "decline" };
    }
    if (method === "item/fileChange/requestApproval") {
        const decision = r?.decision;
        if (decision === "accept" || decision === "acceptForSession" || decision === "decline" || decision === "cancel") {
            return { decision };
        }
        return { decision: "decline" };
    }
    if (method === "item/tool/requestUserInput") {
        const answers = (r?.answers ?? {});
        const mapped = {};
        for (const [k, v] of Object.entries(answers)) {
            const arr = Array.isArray(v) ? v.map(String) : [String(v)];
            mapped[k] = { answers: arr };
        }
        return { answers: mapped };
    }
    if (method === "applyPatchApproval" || method === "execCommandApproval") {
        const d = r?.decision;
        if (d === "approved" || d === "approved_for_session" || d === "denied" || d === "abort")
            return { decision: d };
        if (d && typeof d === "object" && !Array.isArray(d)) {
            const inner = d.approved_execpolicy_amendment;
            const amendment = inner?.proposed_execpolicy_amendment;
            if (inner && Array.isArray(amendment)) {
                return { decision: { approved_execpolicy_amendment: { proposed_execpolicy_amendment: amendment.map(String) } } };
            }
        }
        // Tolerate older UIs that send a string and the amendment separately.
        if (d === "approved_execpolicy_amendment") {
            const amendment = Array.isArray(r?.proposed_execpolicy_amendment)
                ? r.proposed_execpolicy_amendment
                : Array.isArray(r?.proposedExecpolicyAmendment)
                    ? r.proposedExecpolicyAmendment
                    : null;
            if (amendment) {
                return { decision: { approved_execpolicy_amendment: { proposed_execpolicy_amendment: amendment.map(String) } } };
            }
        }
        return { decision: "denied" };
    }
    return {};
}
function autoDeclineResult(method) {
    if (method === "item/commandExecution/requestApproval" || method === "item/fileChange/requestApproval") {
        return { decision: "decline" };
    }
    if (method === "item/tool/requestUserInput") {
        return { answers: {} };
    }
    if (method === "applyPatchApproval" || method === "execCommandApproval") {
        return { decision: "denied" };
    }
    return {};
}
/**
 * 为审批拒绝审计补齐可读上下文，便于前端直接展示原因与 cwd。
 */
function enrichApprovalRequestParamsForAudit(rawParams, input) {
    const params = rawParams && typeof rawParams === "object" && !Array.isArray(rawParams) ? { ...rawParams } : {};
    if (typeof params.cwd !== "string" || !String(params.cwd).trim()) {
        params.cwd = input.approvalRequestCwd;
    }
    if (typeof params.reason !== "string" || !String(params.reason).trim()) {
        params.reason = input.denialReason;
    }
    return params;
}
//# sourceMappingURL=wsHub.js.map
