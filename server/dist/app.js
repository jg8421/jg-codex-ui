"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const busboy_1 = __importDefault(require("busboy"));
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const env_1 = require("./env");
const httpAuth_1 = require("./auth/httpAuth");
const roles_1 = require("./auth/roles");
const bootstrapAdmin_1 = require("./auth/bootstrapAdmin");
const changePassword_1 = require("./auth/changePassword");
const password_1 = require("./auth/password");
const adminInit_1 = require("./auth/adminInit");
const adminUserMaintenanceService_1 = require("./admin/adminUserMaintenanceService");
const adminUserUploads_1 = require("./admin/adminUserUploads");
const userAdminRoutes_1 = require("./admin/userAdminRoutes");
const mcpAdminRoutes_1 = require("./admin/mcpAdminRoutes");
const threadBusySubmit_1 = require("./codex/threadBusySubmit");
const cwdSuggest_1 = require("./tools/cwdSuggest");
const accessControl_1 = require("./workspace/accessControl");
const threadAccess_1 = require("./workspace/threadAccess");
const cwdSwitchLogger_1 = require("./workspace/cwdSwitchLogger");
const windowsVerbatimPath_1 = require("./workspace/windowsVerbatimPath");
const executionPolicy_1 = require("./security/executionPolicy");
const threadListVisibility_1 = require("./workspace/threadListVisibility");
const threadSanitize_1 = require("./workspace/threadSanitize");
const userWorkspaceRoutes_1 = require("./workspace/userWorkspaceRoutes");
const workspaceStatusRoutes_1 = require("./workspace/workspaceStatusRoutes");
const userSettingsRoutes_1 = require("./settings/userSettingsRoutes");
const userSettingsTypes_1 = require("./settings/userSettingsTypes");
const commandLogger_1 = require("./tools/commandLogger");
const historyRoutes_1 = require("./history/http/historyRoutes");
const historyQueryService_1 = require("./history/query/historyQueryService");
const sqliteHistoryStore_1 = require("./history/sqlite/sqliteHistoryStore");
const gitRoutes_1 = require("./git/http/gitRoutes");
const gitAuthenticatedCommand_1 = require("./git/gitAuthenticatedCommand");
const gitPushMetadataStore_1 = require("./git/gitPushMetadataStore");
const gitCommitSummaryCliService_1 = require("./git/gitCommitSummaryCliService");
const gitCommitSummaryRuntimeOptions_1 = require("./git/gitCommitSummaryRuntimeOptions");
const threadListServerCache_1 = require("./threadList/threadListServerCache");
const threadListCliLimit_1 = require("./threadList/threadListCliLimit");
const threadListCursor_1 = require("./threadList/threadListCursor");
const threadListHttpQuery_1 = require("./threadList/threadListHttpQuery");
const threadListService_1 = require("./threadList/threadListService");
const threadStartSummary_1 = require("./threadList/threadStartSummary");
const session_1 = require("./auth/session");
function createInMemoryUserStore() {
    // 测试默认使用内存仓库，避免读写真实文件系统导致串扰。
    const usersByUsername = new Map();
    const normalizeUsername = (username) => String(username ?? "").trim();
    const normalizeRole = (role) => (role === "admin" ? "admin" : "member");
    return {
        async createUser(input) {
            const username = normalizeUsername(input.username);
            if (!username)
                throw new Error("username is required");
            if (usersByUsername.has(username))
                throw new Error("username already exists");
            const password = String(input.password ?? "");
            if (!password)
                throw new Error("password is required");
            // 这里复用 password.ts 的哈希逻辑，确保测试环境与生产一致。
            const { hashPassword } = await Promise.resolve().then(() => __importStar(require("./auth/password")));
            const passwordHash = await hashPassword(password);
            const user = { username, role: normalizeRole(input.role), passwordHash, workspaces: [] };
            usersByUsername.set(username, user);
            return user;
        },
        async getUserByUsername(username) {
            const normalized = normalizeUsername(username);
            return usersByUsername.get(normalized) ?? null;
        },
        async setUserPassword(username, password) {
            // 规范化用户名：作为 Map key 使用。
            const normalizedUsername = normalizeUsername(username);
            if (!normalizedUsername)
                throw new Error("username is required");
            // 新密码明文：仅用于计算 hash，不做持久化。
            const nextPassword = String(password ?? "");
            if (!nextPassword)
                throw new Error("password is required");
            // 定位目标用户；不存在则报错。
            const user = usersByUsername.get(normalizedUsername);
            if (!user)
                throw new Error("user not found");
            // 这里复用 password.ts 的哈希逻辑，确保测试环境与生产一致。
            const { hashPassword } = await Promise.resolve().then(() => __importStar(require("./auth/password")));
            // 计算新的 passwordHash 并回写。
            const nextPasswordHash = await hashPassword(nextPassword);
            user.passwordHash = nextPasswordHash;
            usersByUsername.set(normalizedUsername, user);
            return user;
        },
        async renameUser(username, nextUsername) {
            const normalizedUsername = normalizeUsername(username);
            if (!normalizedUsername)
                throw new Error("username is required");
            const normalizedNextUsername = normalizeUsername(nextUsername);
            if (!normalizedNextUsername)
                throw new Error("next username is required");
            const user = usersByUsername.get(normalizedUsername);
            if (!user)
                throw new Error("user not found");
            if (normalizedUsername === normalizedNextUsername)
                return user;
            if (usersByUsername.has(normalizedNextUsername))
                throw new Error("username already exists");
            usersByUsername.delete(normalizedUsername);
            const renamedUser = { ...user, username: normalizedNextUsername };
            usersByUsername.set(normalizedNextUsername, renamedUser);
            return renamedUser;
        },
        async deleteUser(username) {
            const normalizedUsername = normalizeUsername(username);
            if (!normalizedUsername)
                throw new Error("username is required");
            if (!usersByUsername.has(normalizedUsername))
                throw new Error("user not found");
            usersByUsername.delete(normalizedUsername);
        },
        async assignWorkspaces(username, workspaces) {
            const normalized = normalizeUsername(username);
            const user = usersByUsername.get(normalized);
            if (!user)
                throw new Error("user not found");
            const seen = new Set();
            user.workspaces = (workspaces ?? []).map(String).map((w) => w.trim()).filter(Boolean).filter((w) => {
                if (seen.has(w))
                    return false;
                seen.add(w);
                return true;
            });
            return user;
        },
        async listUsers() {
            return [...usersByUsername.values()];
        },
    };
}
function createInMemoryUserWorkspaceStore() {
    // 用户工作目录内存仓库：测试默认值，避免依赖真实文件系统。
    const workspaceDirsByUsername = new Map();
    const normalizeUsername = (username) => String(username ?? "").trim();
    return {
        async listUserWorkspaceDirs(username) {
            const normalizedUsername = normalizeUsername(username);
            if (!normalizedUsername)
                return [];
            const workspaceDirs = workspaceDirsByUsername.get(normalizedUsername) ?? [];
            return [...workspaceDirs];
        },
        async replaceUserWorkspaceDirs(username, workspaceDirs) {
            const normalizedUsername = normalizeUsername(username);
            if (!normalizedUsername)
                throw new Error("username is required");
            // 内存仓库仅做去重和绝对路径化，与文件仓库行为保持一致。
            const seen = new Set();
            const normalizedWorkspaceDirs = (workspaceDirs ?? [])
                .map((workspaceDir) => path_1.default.resolve(String(workspaceDir ?? "").trim()))
                .filter(Boolean)
                .filter((workspaceDir) => {
                if (seen.has(workspaceDir))
                    return false;
                seen.add(workspaceDir);
                return true;
            });
            workspaceDirsByUsername.set(normalizedUsername, normalizedWorkspaceDirs);
            return [...normalizedWorkspaceDirs];
        },
        async renameUserWorkspaceOwner(username, nextUsername) {
            const normalizedUsername = normalizeUsername(username);
            if (!normalizedUsername)
                throw new Error("username is required");
            const normalizedNextUsername = normalizeUsername(nextUsername);
            if (!normalizedNextUsername)
                throw new Error("next username is required");
            if (normalizedUsername === normalizedNextUsername)
                return [...(workspaceDirsByUsername.get(normalizedUsername) ?? [])];
            const workspaceDirs = workspaceDirsByUsername.get(normalizedUsername) ?? [];
            workspaceDirsByUsername.delete(normalizedUsername);
            workspaceDirsByUsername.set(normalizedNextUsername, [...workspaceDirs]);
            return [...workspaceDirs];
        },
        async deleteUserWorkspaceDirs(username) {
            const normalizedUsername = normalizeUsername(username);
            if (!normalizedUsername)
                throw new Error("username is required");
            workspaceDirsByUsername.delete(normalizedUsername);
        },
    };
}
function createInMemoryUserSettingsStore() {
    // 用户配置内存仓库：测试默认值，避免依赖真实数据库。
    const settingsByUsername = new Map();
    const normalizeUsername = (username) => String(username ?? "").trim();
    return {
        async getUserSettings(username) {
            const normalizedUsername = normalizeUsername(username);
            if (!normalizedUsername)
                return (0, userSettingsTypes_1.normalizeUserSettings)(null);
            return (0, userSettingsTypes_1.normalizeUserSettings)(settingsByUsername.get(normalizedUsername) ?? null);
        },
        async replaceUserSettings(username, settings) {
            const normalizedUsername = normalizeUsername(username);
            if (!normalizedUsername)
                throw new Error("username is required");
            const normalizedSettings = (0, userSettingsTypes_1.normalizeUserSettings)(settings);
            settingsByUsername.set(normalizedUsername, normalizedSettings);
            return (0, userSettingsTypes_1.normalizeUserSettings)(normalizedSettings);
        },
        async renameUserSettingsOwner(username, nextUsername) {
            const normalizedUsername = normalizeUsername(username);
            if (!normalizedUsername)
                throw new Error("username is required");
            const normalizedNextUsername = normalizeUsername(nextUsername);
            if (!normalizedNextUsername)
                throw new Error("next username is required");
            if (normalizedUsername === normalizedNextUsername)
                return (0, userSettingsTypes_1.normalizeUserSettings)(settingsByUsername.get(normalizedUsername) ?? null);
            const previousSettings = settingsByUsername.get(normalizedUsername) ?? null;
            settingsByUsername.delete(normalizedUsername);
            if (previousSettings) {
                settingsByUsername.set(normalizedNextUsername, previousSettings);
            }
            return (0, userSettingsTypes_1.normalizeUserSettings)(previousSettings);
        },
        async deleteUserSettings(username) {
            const normalizedUsername = normalizeUsername(username);
            if (!normalizedUsername)
                throw new Error("username is required");
            settingsByUsername.delete(normalizedUsername);
        },
    };
}
function createInMemoryWorkspaceStatusStore() {
    /**
     * rowByUserAndThreadKey：内存态线程状态表，测试环境避免依赖真实 SQLite。
     */
    const rowByUserAndThreadKey = new Map();
    /**
     * 规范化 key：用于唯一定位 `username + threadId` 的状态行。
     */
    const toRowKey = (username, threadId) => `${String(username ?? "").trim()}::${String(threadId ?? "").trim()}`;
    /**
     * 写回或删除单行内存状态：无状态时直接删除，保持测试数据紧凑。
     */
    const writeRow = (row) => {
        const key = toRowKey(row.username, row.threadId);
        if (!row.isRunning && !row.isPending && !row.hasCompletedUnread) {
            rowByUserAndThreadKey.delete(key);
            return;
        }
        rowByUserAndThreadKey.set(key, row);
    };
    return {
        async setThreadRunningForUsers(input) {
            const updatedAtMs = Number.isFinite(Number(input.updatedAtMs)) ? Math.floor(Number(input.updatedAtMs)) : Date.now();
            for (const rawUsername of input.usernames ?? []) {
                const username = String(rawUsername ?? "").trim();
                const threadId = String(input.threadId ?? "").trim();
                const cwd = String(input.cwd ?? "").trim();
                if (!username || !threadId || !cwd)
                    continue;
                const previousRow = rowByUserAndThreadKey.get(toRowKey(username, threadId));
                writeRow({
                    username,
                    threadId,
                    cwd,
                    isRunning: input.isRunning,
                    isPending: previousRow?.isPending ?? false,
                    hasCompletedUnread: input.isRunning ? false : (previousRow?.hasCompletedUnread ?? false),
                    updatedAtMs,
                });
            }
        },
        async setThreadPendingForUsers(input) {
            const updatedAtMs = Number.isFinite(Number(input.updatedAtMs)) ? Math.floor(Number(input.updatedAtMs)) : Date.now();
            for (const rawUsername of input.usernames ?? []) {
                const username = String(rawUsername ?? "").trim();
                const threadId = String(input.threadId ?? "").trim();
                const cwd = String(input.cwd ?? "").trim();
                if (!username || !threadId || !cwd)
                    continue;
                const previousRow = rowByUserAndThreadKey.get(toRowKey(username, threadId));
                writeRow({
                    username,
                    threadId,
                    cwd,
                    isRunning: previousRow?.isRunning ?? false,
                    isPending: input.isPending,
                    hasCompletedUnread: previousRow?.hasCompletedUnread ?? false,
                    updatedAtMs,
                });
            }
        },
        async markThreadCompletedUnreadForUsers(input) {
            const updatedAtMs = Number.isFinite(Number(input.updatedAtMs)) ? Math.floor(Number(input.updatedAtMs)) : Date.now();
            for (const rawUsername of input.usernames ?? []) {
                const username = String(rawUsername ?? "").trim();
                const threadId = String(input.threadId ?? "").trim();
                const cwd = String(input.cwd ?? "").trim();
                if (!username || !threadId || !cwd)
                    continue;
                const previousRow = rowByUserAndThreadKey.get(toRowKey(username, threadId));
                writeRow({
                    username,
                    threadId,
                    cwd,
                    isRunning: false,
                    isPending: previousRow?.isPending ?? false,
                    hasCompletedUnread: true,
                    updatedAtMs,
                });
            }
        },
        async markThreadSeen(usernameRaw, threadIdRaw, updatedAtMsRaw) {
            const threadId = String(threadIdRaw ?? "").trim();
            // usernameRaw：保留参数仅用于兼容旧调用点/表达“某用户触发已读”，内存实现按 thread 维度全局清理。
            void String(usernameRaw ?? "").trim();
            if (!threadId)
                return;
            const updatedAtMs = Number.isFinite(Number(updatedAtMsRaw)) ? Math.floor(Number(updatedAtMsRaw)) : Date.now();
            /**
             * 只更新原本命中 completedUnread 的行，避免无意义的 updatedAtMs 触碰。
             */
            const keysToUpdate = [];
            for (const [key, row] of rowByUserAndThreadKey.entries()) {
                if (row.threadId !== threadId)
                    continue;
                if (!row.hasCompletedUnread)
                    continue;
                keysToUpdate.push(key);
            }
            for (const key of keysToUpdate) {
                const row = rowByUserAndThreadKey.get(key);
                if (!row)
                    continue;
                writeRow({
                    ...row,
                    hasCompletedUnread: false,
                    updatedAtMs,
                });
            }
        },
        async listWorkspaceStatusByUsername(usernameRaw) {
            const username = String(usernameRaw ?? "").trim();
            if (!username)
                return [];
            const summaryByCwd = new Map();
            for (const row of rowByUserAndThreadKey.values()) {
                if (row.username !== username)
                    continue;
                const existingSummary = summaryByCwd.get(row.cwd) ?? {
                    cwd: row.cwd,
                    hasRunning: false,
                    hasPending: false,
                    hasCompletedUnread: false,
                    updatedAtMs: 0,
                };
                existingSummary.hasRunning = existingSummary.hasRunning || row.isRunning;
                existingSummary.hasPending = existingSummary.hasPending || row.isPending;
                existingSummary.hasCompletedUnread = existingSummary.hasCompletedUnread || row.hasCompletedUnread;
                existingSummary.updatedAtMs = Math.max(existingSummary.updatedAtMs, row.updatedAtMs);
                summaryByCwd.set(row.cwd, existingSummary);
            }
            return Array.from(summaryByCwd.values()).sort((leftSummary, rightSummary) => rightSummary.updatedAtMs - leftSummary.updatedAtMs);
        },
        async renameUsername(usernameRaw, nextUsernameRaw) {
            const username = String(usernameRaw ?? "").trim();
            if (!username)
                throw new Error("username is required");
            const nextUsername = String(nextUsernameRaw ?? "").trim();
            if (!nextUsername)
                throw new Error("next username is required");
            if (username === nextUsername)
                return;
            const rowsToMove = [...rowByUserAndThreadKey.values()].filter((row) => row.username === username);
            for (const row of rowsToMove) {
                rowByUserAndThreadKey.delete(toRowKey(row.username, row.threadId));
                writeRow({
                    ...row,
                    username: nextUsername,
                });
            }
        },
        async deleteUsername(usernameRaw) {
            const username = String(usernameRaw ?? "").trim();
            if (!username)
                throw new Error("username is required");
            const keysToDelete = [...rowByUserAndThreadKey.keys()].filter((key) => key.startsWith(`${username}::`));
            for (const key of keysToDelete) {
                rowByUserAndThreadKey.delete(key);
            }
        },
    };
}
function createApp(opts) {
    const app = (0, express_1.default)();
    app.use(express_1.default.json({ limit: "1mb" }));
    // 基础安全头：减少常见浏览器侧攻击面（不影响 API/前端功能）。
    app.use((_req, res, next) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-Frame-Options", "DENY");
        res.setHeader("Referrer-Policy", "same-origin");
        next();
    });
    const userStore = opts.userStore ?? createInMemoryUserStore();
    const userWorkspaceStore = opts.userWorkspaceStore ?? createInMemoryUserWorkspaceStore();
    const workspaceStatusStore = opts.workspaceStatusStore ?? createInMemoryWorkspaceStatusStore();
    const userSettingsStore = opts.userSettingsStore ?? createInMemoryUserSettingsStore();
    const gitCredentialStore = opts.gitCredentialStore ?? null;
    const adminUserMaintenanceService = (0, adminUserMaintenanceService_1.createAdminUserMaintenanceService)({
        userStore,
        userWorkspaceStore,
        userSettingsStore,
        workspaceStatusStore,
        gitCredentialStore,
    });
    const gitPushMetadataStore = opts.gitPushMetadataStore ?? (0, gitPushMetadataStore_1.createInMemoryGitPushMetadataStore)();
    const gitAuthenticatedCommandRunner = opts.gitAuthenticatedCommandRunner ??
        (async (input) => (0, gitAuthenticatedCommand_1.runGitCommandWithCredential)({
            ...input,
            credentialStore: gitCredentialStore,
        }));
    const adminBootstrap = (0, bootstrapAdmin_1.bootstrapAdmin)(userStore);
    const threadListServerCache = (0, threadListServerCache_1.createThreadListServerCache)();
    let resolvedThreadListStore = null;
    let threadListStoreInitError = null;
    let resolvedThreadListService = opts.threadListService ?? null;
    let threadListServiceInitError = null;
    const resolveThreadListStore = () => {
        if (resolvedThreadListStore)
            return resolvedThreadListStore;
        if (threadListStoreInitError)
            return null;
        try {
            resolvedThreadListStore = (0, sqliteHistoryStore_1.createSqliteHistoryStore)({ dbPath: (0, env_1.getWebHistoryDbPath)() });
            return resolvedThreadListStore;
        }
        catch (err) {
            threadListStoreInitError = String(err?.message ?? err ?? "init failed");
            return null;
        }
    };
    const resolveThreadListService = () => {
        if (resolvedThreadListService)
            return resolvedThreadListService;
        if (threadListServiceInitError)
            return null;
        if (!opts.codex)
            return null;
        const threadListStore = resolveThreadListStore();
        if (!threadListStore)
            return null;
        try {
            resolvedThreadListService = (0, threadListService_1.createThreadListService)({
                store: threadListStore,
                listThreadsFromCli: async () => {
                    // 显式拉取更多线程，避免 codex 默认条数截断导致旧会话（含置顶）在刷新后“消失”。
                    const latestThreads = await opts.codex.listThreads(threadListCliLimit_1.THREAD_LIST_CLI_LIMIT);
                    threadListServerCache.set(latestThreads);
                    return latestThreads;
                },
            });
            return resolvedThreadListService;
        }
        catch (err) {
            threadListServiceInitError = String(err?.message ?? err ?? "init failed");
            return null;
        }
    };
    const clearThreadListServerCache = () => {
        threadListServerCache.clear();
    };
    // 登录限流：按 IP + username 做简单窗口限制，降低暴力破解风险（每 app 实例独立）。
    const loginRateWindowMs = 30_000;
    const loginRateMaxAttempts = 20;
    const loginAttemptsByKey = new Map();
    const getLoginRateKey = (req, username) => {
        const xfwd = typeof req.headers["x-forwarded-for"] === "string" ? req.headers["x-forwarded-for"] : "";
        const ip = xfwd.split(",")[0]?.trim() || String(req.socket?.remoteAddress ?? "unknown");
        return `${ip}::${username}`;
    };
    const checkAndBumpLoginAttempt = (key) => {
        const nowMs = Date.now();
        // best-effort 清理过期 entry，避免长时间运行导致内存增长。
        if (loginAttemptsByKey.size > 10_000) {
            for (const [k, v] of loginAttemptsByKey.entries()) {
                if (nowMs >= v.resetAtMs)
                    loginAttemptsByKey.delete(k);
            }
        }
        const existing = loginAttemptsByKey.get(key);
        if (!existing || nowMs >= existing.resetAtMs) {
            loginAttemptsByKey.set(key, { count: 1, resetAtMs: nowMs + loginRateWindowMs });
            return false;
        }
        existing.count += 1;
        return existing.count > loginRateMaxAttempts;
    };
    const startedAtMs = opts.startedAtMs ?? Date.now();
    const webDist = (0, env_1.getCodexWebDistDir)();
    app.get("/api/health", (_req, res) => res.json({ ok: true }));
    app.get("/api/status", (_req, res) => {
        const nowMs = Date.now();
        const snapshot = opts.getStatusSnapshot?.() ?? {};
        const webUiVersion = getWebUiVersion(webDist);
        res.setHeader("Cache-Control", "no-store");
        res.json({
            ok: true,
            nowMs,
            server: { pid: process.pid, startedAtMs, uptimeMs: Math.max(0, nowMs - startedAtMs) },
            webUi: { version: webUiVersion },
            ...snapshot,
        });
    });
    app.get("/api/auth/bootstrap-admin/status", (req, res) => {
        void (async () => {
            // 等待 bootstrap 完成，避免 setup/status 与 bootstrap 并发导致用户仓库写入冲突。
            await adminBootstrap;
            // 读取 admin 初始化状态：用于前端决定是否展示“首次设置密码”入口。
            const state = await (0, adminInit_1.readAdminInitState)(userStore);
            res.setHeader("Cache-Control", "no-store");
            res.json({ ok: true, ...state });
        })().catch((err) => {
            res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
        });
    });
    app.post("/api/auth/bootstrap-admin/setup", (req, res) => {
        void (async () => {
            // 等待 bootstrap 完成，避免 setup/status 与 bootstrap 并发导致用户仓库写入冲突。
            await adminBootstrap;
            // setup 请求体：只关心新密码字段（前端可做二次确认校验）。
            const body = (req.body ?? {});
            const username = body.username;
            const password = body.password;
            const workspace = body.workspace;
            const result = await (0, adminInit_1.setupAdminPassword)({ store: userStore, username, password, workspace });
            if (!result.ok) {
                if (result.status === "already_configured") {
                    res.status(409).json({ ok: false, error: "already_configured" });
                    return;
                }
                if (result.status === "invalid_username") {
                    res.status(400).json({ ok: false, error: "invalid_request", details: result.details });
                    return;
                }
                if (result.status === "invalid_workspace") {
                    res.status(400).json({ ok: false, error: "invalid_request", details: result.details });
                    return;
                }
                res.status(400).json({ ok: false, error: "invalid_request", details: result.details });
                return;
            }
            // 初始化成功后直接建立会话 cookie，避免用户再手动登录一次。
            const secure = isSecureRequest(req);
            const sessionUsername = String(result.user.username ?? "").trim() || "admin";
            const cookieValue = (0, session_1.createSessionCookieValue)({ username: sessionUsername, role: "admin" }, opts.sessionSecret);
            res.setHeader("Set-Cookie", (0, session_1.buildSessionSetCookieHeader)(cookieValue, { maxAgeSeconds: session_1.DEFAULT_SESSION_TTL_SECONDS, secure }));
            res.json({ ok: true, status: result.status });
        })().catch((err) => {
            res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
        });
    });
    app.post("/api/auth/login", (req, res) => {
        void (async () => {
            await adminBootstrap;
            const body = (req.body ?? {});
            const username = String(body.username ?? "").trim();
            const password = String(body.password ?? "");
            if (!username || !password) {
                res.status(401).json({ ok: false, error: "invalid_credentials" });
                return;
            }
            const rateLimitKey = getLoginRateKey(req, username);
            const limited = checkAndBumpLoginAttempt(rateLimitKey);
            if (limited) {
                res.status(429).json({ ok: false, error: "rate_limited" });
                return;
            }
            const user = await userStore.getUserByUsername(username);
            if (!user) {
                res.status(401).json({ ok: false, error: "invalid_credentials" });
                return;
            }
            const ok = await (0, password_1.verifyPassword)(password, user.passwordHash);
            if (!ok) {
                res.status(401).json({ ok: false, error: "invalid_credentials" });
                return;
            }
            // 成功登录后清理该 key，避免正常用户被之前失败尝试影响。
            loginAttemptsByKey.delete(rateLimitKey);
            const secure = isSecureRequest(req);
            const cookieValue = (0, session_1.createSessionCookieValue)({ username: user.username, role: user.role }, opts.sessionSecret);
            res.setHeader("Set-Cookie", (0, session_1.buildSessionSetCookieHeader)(cookieValue, { maxAgeSeconds: session_1.DEFAULT_SESSION_TTL_SECONDS, secure }));
            res.json({ ok: true });
        })().catch((err) => {
            res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
        });
    });
    app.post("/api/auth/change-password", (req, res) => {
        return (0, httpAuth_1.requireAuth)(opts.sessionSecret, userStore)(req, res, () => {
            void (async () => {
                /**
                 * 当前已认证用户；仅允许修改自己的密码。
                 */
                const username = String(req.user?.username ?? "").trim();
                if (!username) {
                    res.status(401).json({ ok: false, error: "unauthorized" });
                    return;
                }
                /**
                 * 请求体中的旧密码与新密码。
                 */
                const body = (req.body ?? {});
                const result = await (0, changePassword_1.changePassword)({
                    userStore,
                    username,
                    currentPassword: body.currentPassword,
                    newPassword: body.newPassword,
                });
                if (!result.ok) {
                    const statusCode = result.status === "unauthorized" ? 401 : 400;
                    res.status(statusCode).json({ ok: false, error: result.status === "unauthorized" ? "unauthorized" : "invalid_request", details: result.details });
                    return;
                }
                res.json({ ok: true });
            })().catch((err) => {
                res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
            });
        });
    });
    app.post("/api/auth/logout", (req, res) => {
        const secure = isSecureRequest(req);
        res.setHeader("Set-Cookie", (0, session_1.buildSessionClearCookieHeader)({ secure }));
        res.json({ ok: true });
    });
    app.get("/api/auth/me", (req, res) => {
        void (async () => {
            const cookies = (0, session_1.parseCookieHeader)(req.headers.cookie);
            const raw = cookies[session_1.SESSION_COOKIE_NAME];
            const session = raw ? (0, session_1.verifySessionCookieValueWithRole)(raw, opts.sessionSecret) : { username: "local-user", role: "admin" };
            if (!session) {
                res.status(401).json({ ok: false, error: "unauthorized" });
                return;
            }
            const stored = await userStore.getUserByUsername(session.username);
            if (!stored) {
                res.status(401).json({ ok: false, error: "unauthorized" });
                return;
            }
            const role = stored.role;
            const storedWorkspaces = stored.workspaces ?? [];
            // 原始分配目录：仅用于前端提示“已分配但未生效”，不参与本接口鉴权判定。
            const assignedWorkspaces = storedWorkspaces;
            // 返回给前端的工作区列表必须是“当前用户实际可用”的工作区：
            // - member：由管理员分配 workspaces；
            // - admin：默认授权根目录为 `/`（右模糊/前缀匹配可覆盖所有路径）；若用户数据中显式配置了 workspaces，则以其为准。
            const access = (0, accessControl_1.resolveAllowedRootsForUser)({ role, workspaces: storedWorkspaces });
            const workspaces = access.allowAnyRoot ? (storedWorkspaces.length ? storedWorkspaces : ["/"]) : access.roots;
            // 兼容旧版前端：保留 `user` 字段为 string。
            // 对外返回给前端的路径列表：剥离 Windows `\\?\` 前缀，避免 UI 展示异常。
            const sanitizedWorkspaces = workspaces.map((workspacePath) => (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(String(workspacePath ?? "")));
            const sanitizedAssignedWorkspaces = assignedWorkspaces.map((workspacePath) => (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(String(workspacePath ?? "")));
            res.json({
                ok: true,
                user: session.username,
                username: session.username,
                role,
                workspaces: sanitizedWorkspaces,
                assignedWorkspaces: sanitizedAssignedWorkspaces,
            });
        })().catch((err) => {
            res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
        });
    });
    app.use("/api", (req, res, next) => {
        if (req.path === "/health")
            return next();
        if (req.path === "/status")
            return next();
        if (req.path.startsWith("/auth/"))
            return next();
        return (0, httpAuth_1.requireAuth)(opts.sessionSecret, userStore)(req, res, next);
    });
    app.use("/api/admin", (0, userAdminRoutes_1.createUserAdminRoutes)({ userStore, adminUserMaintenanceService }));
    app.use("/api/admin/mcp", (0, mcpAdminRoutes_1.createMcpAdminRoutes)({ codexMcp: opts.codexMcp ?? null }));
    app.use("/api/workspaces", (0, userWorkspaceRoutes_1.createUserWorkspaceRoutes)({ userWorkspaceStore }));
    app.use("/api/workspaces", (0, workspaceStatusRoutes_1.createWorkspaceStatusRoutes)({ workspaceStatusStore }));
    app.use("/api/user-settings", (0, userSettingsRoutes_1.createUserSettingsRoutes)({ userSettingsStore }));
    const uploadHandler = async (req, res) => {
        const username = String(req.user?.username ?? "").trim();
        if (!username) {
            res.status(401).json({ ok: false, error: "unauthorized" });
            return;
        }
        try {
            const result = await receiveAttachmentUpload(req, { username, maxBytes: (0, env_1.getWebMaxUploadBytes)() });
            res.json({ ok: true, ...result });
        }
        catch (err) {
            const e = err;
            const status = typeof e?.status === "number" && Number.isFinite(e.status) ? Math.floor(e.status) : 400;
            res.status(status).json({ ok: false, error: "upload_failed", details: String(e?.message ?? err) });
        }
    };
    app.post("/api/uploads/attachment", uploadHandler);
    // Back-compat for older UIs.
    app.post("/api/uploads/image", uploadHandler);
    app.post("/api/uploads/local-path", async (req, res) => {
        const username = String(req.user?.username ?? "").trim();
        const rawPath = String(req.body?.path ?? "").trim();
        const workspace = String(req.user?.workspaces?.[0] ?? "").trim();
        if (!username || !rawPath || !workspace) {
            res.status(400).json({ ok: false, error: "invalid_local_path" });
            return;
        }
        const sourcePath = path_1.default.resolve(rawPath);
        if (!(0, accessControl_1.isPathWithinRoot)(workspace, sourcePath)) {
            res.status(403).json({ ok: false, error: "path_not_allowed" });
            return;
        }
        try {
            const stat = await fs_1.default.promises.stat(sourcePath);
            if (!stat.isFile())
                throw new Error("not a file");
            const originalName = path_1.default.basename(sourcePath);
            const filename = `att-${Date.now()}-${crypto_1.default.randomBytes(8).toString("hex")}${safeExtFromFilename(originalName)}`;
            const { dir, withinCodexCwd } = (0, adminUserUploads_1.getUserUploadsDir)(username);
            await fs_1.default.promises.mkdir(dir, { recursive: true });
            const localPath = path_1.default.join(dir, filename);
            await fs_1.default.promises.copyFile(sourcePath, localPath);
            const ext = path_1.default.extname(originalName).toLowerCase();
            const mime = [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext) ? `image/${ext === ".jpg" ? "jpeg" : ext.slice(1)}` : "application/octet-stream";
            res.json({ ok: true, apiUrl: `/api/uploads/${encodeURIComponent(filename)}`, localPath, filename, originalName, mime, size: stat.size, withinCodexCwd });
        }
        catch (err) {
            res.status(400).json({ ok: false, error: "local_path_upload_failed", details: String(err?.message ?? err) });
        }
    });
    app.get("/api/uploads/:filename", async (req, res) => {
        const username = String(req.user?.username ?? "").trim();
        if (!username) {
            res.status(401).json({ ok: false, error: "unauthorized" });
            return;
        }
        const raw = String(req.params.filename ?? "");
        const filename = sanitizeUploadedFilename(raw);
        if (!filename) {
            res.status(404).end();
            return;
        }
        const { dir } = (0, adminUserUploads_1.getUserUploadsDir)(username);
        const fullPath = path_1.default.join(dir, filename);
        try {
            const st = await fs_1.default.promises.stat(fullPath);
            if (!st.isFile()) {
                res.status(404).end();
                return;
            }
        }
        catch {
            res.status(404).end();
            return;
        }
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/\"/g, "")}"`);
        res.sendFile(fullPath);
    });
    app.get("/api/config", async (_req, res) => {
        const approvalPolicy = (0, env_1.getCodexApprovalPolicy)();
        const sandboxMode = (0, env_1.getCodexSandboxMode)();
        const historyPageLimit = (0, env_1.getWebHistoryPageLimit)();
        let model = null;
        let reasoningEffort = null;
        let serviceTier = null;
        if (opts.codex) {
            try {
                const [collabRes, modelRes] = await Promise.allSettled([opts.codex.listCollaborationModes(), opts.codex.listModels()]);
                const collabData = collabRes.status === "fulfilled" ? collabRes.value : null;
                const collabItems = Array.isArray(collabData?.data) ? collabData.data : [];
                const lowerIncludes = (s, needle) => String(s ?? "").toLowerCase().includes(needle);
                const defaultCollab = collabItems.find((m) => m && typeof m === "object" && m.mode === "default") ??
                    collabItems.find((m) => m && typeof m === "object" && lowerIncludes(m.name, "default")) ??
                    null;
                const collabModel = String(defaultCollab?.model ?? "").trim();
                const collabEffortRaw = defaultCollab?.reasoning_effort;
                const collabEffort = typeof collabEffortRaw === "string" ? collabEffortRaw.trim() : collabEffortRaw ?? null;
                if (collabModel)
                    model = collabModel;
                if (typeof collabEffort === "string" && collabEffort.trim())
                    reasoningEffort = collabEffort.trim();
                const modelData = modelRes.status === "fulfilled" ? modelRes.value : null;
                const modelItems = Array.isArray(modelData?.data) ? modelData.data : [];
                const defaultModel = modelItems.find((m) => m && typeof m === "object" && Boolean(m.isDefault)) ??
                    modelItems.find((m) => m && typeof m === "object" && String(m.id ?? "").toLowerCase().includes("default")) ??
                    null;
                if (!model) {
                    const fallbackModel = String(defaultModel?.model ?? defaultModel?.id ?? "").trim();
                    if (fallbackModel)
                        model = fallbackModel;
                }
                if (!reasoningEffort) {
                    const d = String(defaultModel?.defaultReasoningEffort ?? "").trim();
                    if (d)
                        reasoningEffort = d;
                }
            }
            catch {
                // Best-effort only: still return env-derived defaults below.
            }
        }
        // Security: avoid leaking server directory structure (e.g. CODEX_CWD) to clients.
        // Keep the web client aligned with the configured personal provider.
        // Do not surface Codex/ChatGPT account defaults in this DeepSeek-only UI.
        res.json({ approvalPolicy, sandboxMode, model: "deepseek-v4-flash", reasoningEffort: reasoningEffort || "medium", serviceTier, historyPageLimit });
    });
    app.get("/api/deepseek/stats", async (_req, res) => {
        const apiKey = String(process.env.DEEPSEEK_API_KEY ?? "").trim();
        let balance = null;
        if (apiKey) {
            try {
                const response = await fetch("https://api.deepseek.com/user/balance", { headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` } });
                if (response.ok) {
                    const data = await response.json();
                    const item = Array.isArray(data?.balance_infos) ? data.balance_infos.find((x) => x?.currency === "CNY") ?? data.balance_infos[0] : null;
                    if (item)
                        balance = { currency: String(item.currency ?? "CNY"), total: Number(item.total_balance ?? 0) };
                }
            }
            catch {
                // The usage panel remains functional even when balance lookup is unavailable.
            }
        }
        res.json({ ok: true, balance });
    });
    app.get("/api/cwd/suggest", async (req, res) => {
        const q = typeof req.query?.q === "string" ? String(req.query.q) : "";
        const limit = typeof req.query?.limit === "string" ? Number(req.query.limit) : undefined;
        const access = (0, accessControl_1.resolveAllowedRootsForUser)(req.user);
        if (!access.allowAnyRoot && !access.roots.length) {
            res.status(403).json({ ok: false, error: "path_not_allowed" });
            return;
        }
        try {
            const suggestions = await (0, cwdSuggest_1.suggestCwds)({
                query: q,
                limit,
                allowAnyRoot: access.allowAnyRoot,
                allowedRoots: access.allowAnyRoot ? undefined : access.roots,
            });
            res.json({ ok: true, suggestions });
        }
        catch (err) {
            if (err instanceof cwdSuggest_1.CwdSuggestError) {
                const status = err.code === "path_not_allowed" ? 403 : 400;
                res.status(status).json({ ok: false, error: err.code });
                return;
            }
            res.status(500).json({ ok: false, error: "request_failed" });
        }
    });
    app.get("/api/model/list", async (_req, res) => {
        // This personal installation is intentionally pinned to the configured
        // DeepSeek provider instead of Codex's ChatGPT-account model catalog.
        res.json({
            ok: true,
            data: [{
                    id: "deepseek-v4-flash",
                    model: "deepseek-v4-flash",
                    displayName: "DeepSeek V4 Flash",
                    description: "DeepSeek API · 1M context",
                    hidden: false,
                    supportedReasoningEfforts: [
                        { reasoningEffort: "low", description: "快速" },
                        { reasoningEffort: "medium", description: "平衡" },
                        { reasoningEffort: "high", description: "深度分析" },
                    ],
                    defaultReasoningEffort: "medium",
                    inputModalities: ["text"],
                    supportsPersonality: false,
                    additionalSpeedTiers: [],
                    serviceTiers: [],
                    defaultServiceTier: null,
                    isDefault: true,
                }],
            nextCursor: null,
        });
        return;
        if (!opts.codex) {
            res.status(501).json({ ok: false, error: "not_supported" });
            return;
        }
        try {
            const result = await opts.codex.listModels();
            res.json({ ok: true, ...result });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
        }
    });
    app.get("/api/experimental/list", async (_req, res) => {
        if (!opts.codex) {
            res.status(501).json({ ok: false, error: "not_supported" });
            return;
        }
        try {
            const result = await opts.codex.listExperimentalFeatures();
            res.json({ ok: true, ...result });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
        }
    });
    app.get("/api/collaboration/list", async (_req, res) => {
        if (!opts.codex) {
            res.status(501).json({ ok: false, error: "not_supported" });
            return;
        }
        try {
            const result = await opts.codex.listCollaborationModes();
            res.json({ ok: true, ...result });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
        }
    });
    app.post("/api/experimental/set", async (req, res) => {
        if (!opts.codex) {
            res.status(501).json({ ok: false, error: "not_supported" });
            return;
        }
        if (!(0, roles_1.isAdminRole)(req.user?.role)) {
            res.status(403).json({ ok: false, error: "forbidden" });
            return;
        }
        const body = (req.body ?? {});
        const name = String(body.name ?? "").trim();
        const enabled = Boolean(body.enabled);
        if (!name) {
            res.status(400).json({ ok: false, error: "invalid_request" });
            return;
        }
        try {
            const result = await opts.codex.setConfigValue({ keyPath: `features.${name}`, value: enabled, mergeStrategy: "replace" });
            res.json({ ok: true, ...result });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
        }
    });
    app.get("/api/skills/list", async (_req, res) => {
        if (!opts.codex) {
            res.status(501).json({ ok: false, error: "not_supported" });
            return;
        }
        try {
            const result = await opts.codex.listSkills();
            res.json({ ok: true, ...result });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
        }
    });
    app.post("/api/skills/set", async (req, res) => {
        if (!opts.codex) {
            res.status(501).json({ ok: false, error: "not_supported" });
            return;
        }
        if (!(0, roles_1.isAdminRole)(req.user?.role)) {
            res.status(403).json({ ok: false, error: "forbidden" });
            return;
        }
        const body = (req.body ?? {});
        const skillPath = String(body.path ?? "").trim();
        const enabled = Boolean(body.enabled);
        if (!skillPath) {
            res.status(400).json({ ok: false, error: "invalid_request" });
            return;
        }
        try {
            const result = await opts.codex.setSkillEnabled({ path: skillPath, enabled });
            res.json({ ok: true, ...result });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
        }
    });
    app.get("/api/thread/list", async (req, res) => {
        if (!opts.codex) {
            res.status(501).json({ ok: false, error: "not_supported" });
            return;
        }
        const user = req.user;
        if (!user) {
            res.status(401).json({ ok: false, error: "unauthorized" });
            return;
        }
        const requestedCwd = typeof req.query?.cwd === "string" ? String(req.query.cwd) : "";
        let workspaceFilterCwd = null;
        try {
            workspaceFilterCwd = await (0, threadListVisibility_1.resolveThreadListWorkspaceFilter)(requestedCwd, user);
        }
        catch {
            (0, cwdSwitchLogger_1.logCwdSwitch)({
                event: "http_thread_list_filter_rejected",
                username: String(req.user?.username ?? "").trim(),
                role: user.role,
                requestedCwd,
                workspacesCount: user.workspaces.length,
            });
            // 统一返回 path_not_allowed，避免暴露目录是否存在等细节。
            res.status(403).json({ ok: false, error: "path_not_allowed" });
            return;
        }
        try {
            if (requestedCwd.trim()) {
                (0, cwdSwitchLogger_1.logCwdSwitch)({
                    event: "http_thread_list_filter",
                    username: String(req.user?.username ?? "").trim(),
                    role: user.role,
                    requestedCwd,
                    workspaceFilterCwd,
                    workspacesCount: user.workspaces.length,
                });
            }
            const routingSnapshot = await userStore
                .listUsers()
                .then((users) => (0, threadListVisibility_1.buildWorkspaceRoutingSnapshot)(users))
                .catch(() => null);
            const threadListService = resolveThreadListService();
            if (!threadListService) {
                res.status(501).json({ ok: false, error: "not_supported" });
                return;
            }
            const refreshRequested = String(req.query?.refresh ?? "").trim();
            const shouldRefreshThreadList = refreshRequested === "1" || refreshRequested.toLowerCase() === "true";
            /**
             * 分页参数：
             * - limit 默认 30
             * - cursor 为空表示第一页
             */
            const limit = (0, threadListHttpQuery_1.parseThreadListPageLimit)(req.query?.limit, threadListHttpQuery_1.DEFAULT_THREAD_LIST_PAGE_LIMIT);
            const cursor = (0, threadListHttpQuery_1.parseThreadListCursor)(req.query?.cursor);
            if (cursor === "invalid") {
                res.status(400).json({ ok: false, error: "invalid_request", details: "invalid cursor" });
                return;
            }
            /**
             * includeThreadIds：
             * - 典型用于“置顶线程补齐”
             * - 仅在第一页生效，避免每页重复返回同一批置顶线程
             */
            const includeThreadIdsFromQuery = cursor === null ? (0, threadListHttpQuery_1.parseIncludeThreadIds)(req.query?.includeThreadIds) : [];
            const includeThreadIdsFromSettings = [];
            if (cursor === null) {
                const username = String(req.user?.username ?? "").trim();
                if (username) {
                    try {
                        const settings = await userSettingsStore.getUserSettings(username);
                        const pinnedOverrides = settings?.threadPinOverrides ?? {};
                        for (const [threadId, pinned] of Object.entries(pinnedOverrides)) {
                            if (pinned !== true)
                                continue;
                            const normalizedThreadId = String(threadId ?? "").trim();
                            if (!normalizedThreadId)
                                continue;
                            includeThreadIdsFromSettings.push(normalizedThreadId);
                            if (includeThreadIdsFromSettings.length >= 200)
                                break;
                        }
                    }
                    catch {
                        // 用户配置读取失败不应影响线程列表；按不补齐处理。
                    }
                }
            }
            const includeThreadIds = (() => {
                const seen = new Set();
                const merged = [];
                for (const id of includeThreadIdsFromSettings) {
                    if (seen.has(id))
                        continue;
                    seen.add(id);
                    merged.push(id);
                }
                for (const id of includeThreadIdsFromQuery) {
                    if (seen.has(id))
                        continue;
                    seen.add(id);
                    merged.push(id);
                }
                return merged;
            })();
            const threadListResult = await threadListService.listThreadsPage({
                refresh: shouldRefreshThreadList,
                limit,
                cursor,
                cwd: workspaceFilterCwd,
                includeThreadIds,
            });
            const visibleThreads = threadListResult.threads.filter((thread) => (0, threadListVisibility_1.shouldIncludeThreadForList)({
                thread,
                user,
                workspaceFilterCwd,
                routingSnapshot,
            }));
            // 对外返回给前端的线程列表：剥离 Windows `\\?\` 前缀，避免 UI 展示与路径比较异常。
            const sanitizedThreads = visibleThreads.map((thread) => (0, threadSanitize_1.sanitizeThreadForClient)(thread));
            // Return saved display names as the actual preview. The client periodically
            // refreshes this list, so a client-only rename would otherwise revert.
            let threadNameOverrides = {};
            try {
                const username = String(req.user?.username ?? "").trim();
                const settings = username ? await userSettingsStore.getUserSettings(username) : null;
                threadNameOverrides = settings?.threadNameOverrides ?? {};
            }
            catch { /* the original thread title remains available */ }
            const displayThreads = sanitizedThreads.map((thread) => {
                const savedName = String(threadNameOverrides?.[thread.id] ?? "").trim();
                return savedName ? { ...thread, preview: savedName } : thread;
            });
            const nextCursor = threadListResult.nextCursor ? (0, threadListCursor_1.encodeThreadListCursor)(threadListResult.nextCursor) : null;
            res.setHeader("Cache-Control", "no-store");
            res.json({
                ok: true,
                threads: displayThreads,
                cwd: workspaceFilterCwd,
                warmingUp: threadListResult.warmingUp,
                warmupFailed: threadListResult.warmupFailed,
                nextCursor,
            });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
        }
    });
    // 线程写接口统一鉴权：member 必须在其分配 workspaces 内操作 thread.cwd。
    // 说明：历史/线程接口会高频触发该校验；为避免每次都走 codex.readThread + fs.stat/realpath，
    // 这里做一个短 TTL 的 per-user/per-thread 缓存（缓存命中后直接放行）。
    const THREAD_ACCESS_CACHE_TTL_MS = 30_000;
    const THREAD_ACCESS_CACHE_MAX_PER_USER = 500;
    const threadAccessCacheByUsername = new Map();
    const resolveUserWorkspacesKey = (user) => {
        const rawWorkspaces = Array.isArray(user?.workspaces) ? user.workspaces : [];
        // workspacesKey：用于在“用户被重新分配工作区”时自动失效缓存（同一 username 下的权限可能变更）。
        return rawWorkspaces.map((w) => String(w ?? "").trim()).filter(Boolean).sort().join("|");
    };
    const requireThreadAccess = async (req, res, threadId) => {
        const user = req.user;
        if (!user) {
            res.status(401).json({ ok: false, error: "unauthorized" });
            return false;
        }
        try {
            const username = String(user.username ?? "").trim();
            const nowMs = Date.now();
            // 非 admin：优先走缓存，减少对 codex/app-server 与文件系统的重复访问。
            if (username && !(0, roles_1.isAdminRole)(user.role)) {
                const workspacesKey = resolveUserWorkspacesKey(user);
                const cacheForUser = threadAccessCacheByUsername.get(username);
                const cached = cacheForUser?.get(threadId);
                if (cached &&
                    cached.workspacesKey === workspacesKey &&
                    Number.isFinite(cached.ts) &&
                    nowMs - cached.ts < THREAD_ACCESS_CACHE_TTL_MS) {
                    return true;
                }
            }
            await (0, threadAccess_1.assertThreadAllowedForUser)({ threadId, user, codex: opts.codex });
            if (username && !(0, roles_1.isAdminRole)(user.role)) {
                const workspacesKey = resolveUserWorkspacesKey(user);
                const cacheForUser = threadAccessCacheByUsername.get(username) ?? new Map();
                threadAccessCacheByUsername.set(username, cacheForUser);
                // best-effort 限制缓存大小，避免长时间运行导致内存增长。
                if (cacheForUser.size > THREAD_ACCESS_CACHE_MAX_PER_USER)
                    cacheForUser.clear();
                cacheForUser.set(threadId, { ts: nowMs, workspacesKey });
            }
            return true;
        }
        catch {
            // 不区分 thread 不存在 / 越权等细节，避免信息泄露。
            res.status(403).json({ ok: false, error: "forbidden" });
            return false;
        }
    };
    // fallbackHistoryQuery：当 `opts.historyQuery` 未注入/不支持 file-changes 时，按需直连 SQLite 读取 file_change_entries 索引表。
    // 说明：用于解决“历史已落库，但部署未启用 /api/history 或注入的 HistoryQueryService 版本较旧”的兼容问题。
    let fallbackHistoryQuery = null;
    // fallbackHistoryQueryInitError：记录初始化失败原因，避免每次请求都重复尝试打开 DB。
    let fallbackHistoryQueryInitError = null;
    // 获取 fallbackHistoryQuery：按需创建，避免每次请求都打开 SQLite DB。
    const resolveFallbackHistoryQuery = () => {
        if (fallbackHistoryQuery)
            return fallbackHistoryQuery;
        if (fallbackHistoryQueryInitError)
            return null;
        try {
            // historyDbPath：SQLite 历史库路径（与 index.ts 创建 history runtime 的 dbPath 一致）。
            const historyDbPath = (0, env_1.getWebHistoryDbPath)();
            // historyStore：SQLite history store（包含 file_change_entries 索引表）。
            const historyStore = (0, sqliteHistoryStore_1.createSqliteHistoryStore)({ dbPath: historyDbPath });
            // historyQuery：复用 query service 的聚合逻辑，避免在路由里重复拼装 items。
            const historyQuery = (0, historyQueryService_1.createHistoryQueryService)({ store: historyStore });
            fallbackHistoryQuery = historyQuery;
            return fallbackHistoryQuery;
        }
        catch (err) {
            fallbackHistoryQueryInitError = String(err?.message ?? err ?? "init failed");
            return null;
        }
    };
    /**
     * 判断是否应当对某些 history 查询错误进行 fallback：
     * - worker 进程崩溃/退出；
     * - worker client 已关闭；
     * - worker 请求超时（避免卡死导致历史不可用）。
     */
    const shouldFallbackHistoryQueryError = (error) => {
        const message = String(error?.message ?? error ?? "");
        if (!message)
            return false;
        if (message.includes("history worker is closed"))
            return true;
        if (message.includes("history worker closed"))
            return true;
        if (message.includes("history worker exited"))
            return true;
        if (message.includes("history worker request timeout"))
            return true;
        return false;
    };
    // 历史读取接口：复用线程访问权限校验，避免绕过现有工作区隔离规则。
    if (opts.historyQuery) {
        const injectedHistoryQuery = opts.historyQuery;
        // resilientHistoryQuery：当注入的 query（通常为 worker pool）不可用时，按需回退主线程直连 SQLite。
        const resilientHistoryQuery = {
            async listMessages(input) {
                try {
                    return await injectedHistoryQuery.listMessages(input);
                }
                catch (err) {
                    if (!shouldFallbackHistoryQueryError(err))
                        throw err;
                    const fallback = resolveFallbackHistoryQuery();
                    if (!fallback)
                        throw err;
                    return fallback.listMessages(input);
                }
            },
            async getMessageDiff(input) {
                try {
                    // injectedHistoryQuery.getMessageDiff：worker query 可能实现也可能未实现。
                    const fn = injectedHistoryQuery.getMessageDiff;
                    if (typeof fn === "function")
                        return await fn(input);
                    const fallback = resolveFallbackHistoryQuery();
                    if (!fallback || typeof fallback.getMessageDiff !== "function")
                        return null;
                    return fallback.getMessageDiff(input);
                }
                catch (err) {
                    if (!shouldFallbackHistoryQueryError(err))
                        throw err;
                    const fallback = resolveFallbackHistoryQuery();
                    if (!fallback || typeof fallback.getMessageDiff !== "function")
                        throw err;
                    return fallback.getMessageDiff(input);
                }
            },
            // listThreadFileChanges：优先注入（若有）；否则回退到 sqlite query（若可用）。
            async listThreadFileChanges(threadId) {
                const injectedFn = injectedHistoryQuery.listThreadFileChanges;
                if (typeof injectedFn === "function")
                    return injectedFn(threadId);
                const fallback = resolveFallbackHistoryQuery();
                if (!fallback || typeof fallback.listThreadFileChanges !== "function")
                    return [];
                return fallback.listThreadFileChanges(threadId);
            },
        };
        app.use("/api/history", (0, historyRoutes_1.createHistoryRoutes)({
            historyQuery: resilientHistoryQuery,
            requireThreadAccess,
        }));
        // 兼容别名：部分旧前端/反代环境使用 `/history/*`（无 `/api` 前缀）。
        app.use("/history", 
        // 兼容别名同样需要鉴权中间件，否则 `req.user` 为空会导致 401。
        // 注意：这里不需要放行 health/status/auth 等路径（与 `/api/history` 不同），因为该别名仅用于历史查询接口。
        (req, res, next) => (0, httpAuth_1.requireAuth)(opts.sessionSecret, userStore)(req, res, next), (0, historyRoutes_1.createHistoryRoutes)({
            historyQuery: resilientHistoryQuery,
            requireThreadAccess,
        }));
    }
    // file-changes 别名接口：部分部署环境可能未转发 `/api/history/*`，这里提供 `/api/thread/*` 前缀下的等价入口。
    app.get("/api/thread/:threadId/file-changes", async (req, res) => {
        const threadId = String(req.params.threadId ?? "").trim();
        if (!threadId) {
            res.status(400).json({ ok: false, error: "invalid_request" });
            return;
        }
        // historyQuery：优先注入的 query；否则回退直连 SQLite 的 fallback query。
        const injected = opts.historyQuery ?? null;
        const historyQuery = injected && typeof injected.listThreadFileChanges === "function" ? injected : resolveFallbackHistoryQuery();
        if (!historyQuery || typeof historyQuery.listThreadFileChanges !== "function") {
            res.status(404).json({ ok: false, error: "not_found" });
            return;
        }
        try {
            if (!(await requireThreadAccess(req, res, threadId)))
                return;
            const items = await Promise.resolve(historyQuery.listThreadFileChanges(threadId));
            res.json({ ok: true, items });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
        }
    });
    // Git API：基于工作目录（cwd）进行操作（不依赖线程）。
    app.use("/api/git", (0, gitRoutes_1.createGitRoutes)({
        gitCredentialStore,
        gitPushMetadataStore,
        gitAuthenticatedCommandRunner,
    }));
    /**
     * 后台静默生成 Git 提交总结：
     * - 前端只传 cwd + 已勾选文件路径；
     * - 服务端通过 `codex exec` 直接返回 assistant 文本（无需依赖 thread/history 管道）；
     * - 通过 `-c project_doc_max_bytes=...` 等覆盖项减少 `AGENTS.md` 注入体积，加快总结；
     * - 不切换当前 UI 线程，适合“填充 commit message”场景。
     */
    app.post("/api/git/commit-summary", async (req, res) => {
        const user = req.user;
        if (!user) {
            res.status(401).json({ ok: false, error: "unauthorized" });
            return;
        }
        const body = (req.body ?? {});
        // requestedCwd：Git 总结对应的工作目录。
        const requestedCwd = typeof body.cwd === "string" ? body.cwd : "";
        // requestedFiles：前端勾选的相对路径列表。
        const requestedFiles = Array.isArray(body.files) ? body.files : [];
        // model：本次总结显式指定的模型；空串按未指定处理。
        const model = typeof body.model === "string" ? body.model.trim() || undefined : undefined;
        // effort：本次总结显式指定的思考强度；只接受 Git 总结已知值。
        const effort = (0, gitCommitSummaryRuntimeOptions_1.normalizeGitCommitSummaryReasoningEffort)(body.effort);
        if (!requestedCwd.trim()) {
            res.status(400).json({ ok: false, error: "invalid_request", details: "cwd is required" });
            return;
        }
        if (!requestedFiles.length) {
            res.status(400).json({ ok: false, error: "invalid_request", details: "files is required" });
            return;
        }
        // effectiveModel/effectiveEffort：本次调用最终生效的模型与思考强度；用于成功/失败日志统一复用。
        let effectiveModel = model;
        let effectiveEffort = effort;
        try {
            // sandbox：按当前用户角色收敛，保证与其他 Codex 调用一致。
            const sandbox = (0, executionPolicy_1.coerceSandboxModeForUser)({
                userRole: user.role,
                requested: undefined,
                fallback: (0, env_1.getCodexSandboxMode)(),
            });
            // persistedEffort：数据库里已保存的 Git 总结默认强度；仅在请求未显式指定时参与兜底。
            let persistedEffort;
            // 说明：当前端未显式传参时，从数据库用户配置中读取 `gitCommitSummaryDefaults` 作为兜底，确保设置“保存即生效”。
            if (!effectiveModel || !effectiveEffort) {
                const settings = await userSettingsStore.getUserSettings(user.username);
                const defaults = settings?.gitCommitSummaryDefaults ?? {};
                if (!effectiveModel) {
                    const persistedModel = String(defaults.model ?? "").trim();
                    effectiveModel = persistedModel || undefined;
                }
                persistedEffort = typeof defaults.reasoningEffort === "string" ? defaults.reasoningEffort : undefined;
            }
            effectiveEffort = (0, gitCommitSummaryRuntimeOptions_1.resolveGitCommitSummaryEffectiveReasoningEffort)({
                requestedEffort: effort,
                persistedEffort,
            });
            (0, commandLogger_1.logGitCommitSummaryRoute)({
                stage: "request-received",
                username: user.username,
                cwd: requestedCwd,
                fileCount: requestedFiles.length,
                model: effectiveModel ?? null,
                effort: effectiveEffort ?? null,
                sandbox,
            });
            const canonicalCwd = await (0, accessControl_1.assertCwdAllowedForUser)({ cwd: requestedCwd, user });
            const result = await (0, gitCommitSummaryCliService_1.summarizeGitCommitViaCodexExec)({
                codexBin: (0, env_1.getCodexBin)(),
                cwd: canonicalCwd,
                requestedFiles,
                sandbox,
                model: effectiveModel,
                effort: effectiveEffort,
                runCommand: opts.runCodexCommand,
            });
            (0, commandLogger_1.logGitCommitSummaryRoute)({
                stage: "request-succeeded",
                username: user.username,
                cwd: canonicalCwd,
                fileCount: requestedFiles.length,
                model: effectiveModel ?? null,
                effort: effectiveEffort ?? null,
                sandbox,
                threadId: result.threadId,
            });
            clearThreadListServerCache();
            res.json({ ok: true, summary: result });
        }
        catch (err) {
            const message = String(err?.message ?? err ?? "");
            (0, commandLogger_1.logGitCommitSummaryRouteError)({
                stage: "request-failed",
                username: user.username,
                cwd: requestedCwd,
                fileCount: requestedFiles.length,
                model: effectiveModel ?? null,
                effort: effectiveEffort ?? null,
                error: err,
            });
            if (message.includes("cwd not allowed")) {
                res.status(403).json({ ok: false, error: "path_not_allowed", details: message });
                return;
            }
            if (message.includes("cwd not found") || message.includes("cwd is not a directory") || message.includes("invalid cwd")) {
                res.status(400).json({ ok: false, error: "invalid_request", details: message });
                return;
            }
            if (message.includes("no valid files selected")) {
                res.status(400).json({ ok: false, error: "invalid_request", details: message });
                return;
            }
            res.status(500).json({ ok: false, error: "request_failed", details: message });
        }
    });
    /**
     * 新建线程（仅创建，不返回 thread_opened 快照）。
     *
     * 设计：
     * - 创建线程走 HTTP（便于反代与权限校验一致化）；
     * - 打开线程/流式输出仍走 WS（复用现有 `thread_opened` 协议与增量事件）。
     */
    app.post("/api/thread/start", async (req, res) => {
        if (!opts.codex) {
            res.status(501).json({ ok: false, error: "not_supported" });
            return;
        }
        const user = req.user;
        if (!user) {
            res.status(401).json({ ok: false, error: "unauthorized" });
            return;
        }
        const body = (req.body ?? {});
        const requestedCwd = typeof body.cwd === "string" ? body.cwd : "";
        const model = "deepseek-v4-flash";
        const serviceTier = body.serviceTier === "fast" ? body.serviceTier : undefined;
        try {
            const canonicalCwd = await (0, accessControl_1.assertCwdAllowedForUser)({ cwd: requestedCwd, user });
            const codexCwd = (0, windowsVerbatimPath_1.coerceCwdForCodex)(canonicalCwd);
            const approvalPolicy = (0, executionPolicy_1.coerceApprovalPolicyForUser)({
                userRole: user.role,
                requested: body.approvalPolicy,
                fallback: (0, env_1.getCodexApprovalPolicy)(),
            });
            const sandbox = (0, executionPolicy_1.coerceSandboxModeForUser)({
                userRole: user.role,
                requested: body.sandbox,
                fallback: (0, env_1.getCodexSandboxMode)(),
            });
            (0, cwdSwitchLogger_1.logCwdSwitch)({
                event: "http_thread_start_new",
                username: String(user.username ?? "").trim(),
                role: user.role,
                requestedCwd,
                canonicalCwd,
                codexCwd,
                workspacesCount: user.workspaces.length,
            });
            const thread = await opts.codex.startThread({ cwd: codexCwd, approvalPolicy, sandbox, model, serviceTier });
            const threadId = String(thread?.id ?? "").trim();
            const threadStartSummary = (0, threadStartSummary_1.buildThreadStartSummary)({
                thread,
                fallbackThreadId: threadId,
                fallbackCwd: canonicalCwd,
                fallbackModelProvider: model,
            });
            const threadListStore = resolveThreadListStore();
            if (threadListStore && threadStartSummary) {
                threadListStore.upsertThreadSummary(threadStartSummary);
            }
            clearThreadListServerCache();
            res.json({ ok: true, threadId: threadId || undefined, cwd: canonicalCwd });
        }
        catch (err) {
            const message = String(err?.message ?? err ?? "");
            if (message.includes("cwd not allowed")) {
                res.status(403).json({ ok: false, error: "path_not_allowed", details: message });
                return;
            }
            if (message.includes("cwd not found") || message.includes("cwd is not a directory") || message.includes("invalid cwd")) {
                res.status(400).json({ ok: false, error: "invalid_request", details: message });
                return;
            }
            res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
        }
    });
    /**
     * 发送一条用户输入（submit turn），通过 HTTP 触发 codex 执行。
     * 注意：该接口只负责“触发执行 + 立即返回”，后续流式输出仍由 WS 通道推送到前端。
     */
    app.post("/api/thread/submit", async (req, res) => {
        if (!opts.codex) {
            res.status(501).json({ ok: false, error: "not_supported" });
            return;
        }
        const user = req.user;
        if (!user) {
            res.status(401).json({ ok: false, error: "unauthorized" });
            return;
        }
        const body = (req.body ?? {});
        const threadId = String(body.threadId ?? "").trim();
        const text = typeof body.text === "string" ? body.text : "";
        const clientMessageId = String(body.clientMessageId ?? "").trim();
        if (!threadId || !text.trim()) {
            res.status(400).json({ ok: false, error: "invalid_request" });
            return;
        }
        try {
            if (!(await requireThreadAccess(req, res, threadId)))
                return;
            const requestedApprovalPolicy = body.approvalPolicy;
            const requestedSandbox = body.sandbox;
            // turn 级别的执行策略必须按角色收敛，避免 member 通过 API 提升权限。
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
            const effort = typeof body.effort === "string"
                ? body.effort
                : typeof body.reasoningEffort === "string"
                    ? body.reasoningEffort
                    : undefined;
            const turnOpts = {
                model: typeof body.model === "string" ? body.model : undefined,
                effort,
                serviceTier: body.serviceTier === "fast" ? body.serviceTier : undefined,
                approvalPolicy,
                sandbox,
                collaborationMode: body.collaborationMode && typeof body.collaborationMode === "object" ? body.collaborationMode : undefined,
            };
            await (0, threadBusySubmit_1.submitTurnWithBusyInterruption)({
                codex: opts.codex,
                threadId,
                text,
                turnOpts,
                getStatusSnapshot: opts.getStatusSnapshot,
                getActiveTurnIds: opts.getActiveTurnIds,
            });
            res.json({ ok: true, threadId, clientMessageId: clientMessageId || undefined });
        }
        catch (err) {
            if (err instanceof threadBusySubmit_1.ThreadBusySubmitError) {
                res.status(409).json({ ok: false, error: err.code, details: err.message });
                return;
            }
            res.status(500).json({ ok: false, error: "request_failed", details: String(err?.message ?? err) });
        }
    });
    app.post("/api/thread/name/set", async (req, res) => {
        if (!opts.codex) {
            res.status(501).json({ ok: false, error: "not_supported" });
            return;
        }
        const body = (req.body ?? {});
        const threadId = String(body.threadId ?? "").trim();
        const name = String(body.name ?? "").trim();
        if (!threadId || !name) {
            res.status(400).json({ ok: false, error: "invalid_request" });
            return;
        }
        try {
            if (!(await requireThreadAccess(req, res, threadId)))
                return;
            const result = await opts.codex.setThreadName({ threadId, name });
            clearThreadListServerCache();
            res.json({ ok: true, ...result });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
        }
    });
    app.post("/api/review/start", async (req, res) => {
        if (!opts.codex) {
            res.status(501).json({ ok: false, error: "not_supported" });
            return;
        }
        const body = (req.body ?? {});
        const threadId = String(body.threadId ?? "").trim();
        const target = body.target ?? { type: "uncommittedChanges" };
        if (!threadId) {
            res.status(400).json({ ok: false, error: "invalid_request" });
            return;
        }
        try {
            if (!(await requireThreadAccess(req, res, threadId)))
                return;
            const result = await opts.codex.startReview({ threadId, target });
            clearThreadListServerCache();
            res.json({ ok: true, ...result });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
        }
    });
    app.post("/api/thread/compact/start", async (req, res) => {
        if (!opts.codex) {
            res.status(501).json({ ok: false, error: "not_supported" });
            return;
        }
        const body = (req.body ?? {});
        const threadId = String(body.threadId ?? "").trim();
        if (!threadId) {
            res.status(400).json({ ok: false, error: "invalid_request" });
            return;
        }
        try {
            if (!(await requireThreadAccess(req, res, threadId)))
                return;
            const result = await opts.codex.startCompact({ threadId });
            clearThreadListServerCache();
            res.json({ ok: true, ...result });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
        }
    });
    app.post("/api/thread/fork", async (req, res) => {
        if (!opts.codex) {
            res.status(501).json({ ok: false, error: "not_supported" });
            return;
        }
        const body = (req.body ?? {});
        const threadId = String(body.threadId ?? "").trim();
        if (!threadId) {
            res.status(400).json({ ok: false, error: "invalid_request" });
            return;
        }
        try {
            if (!(await requireThreadAccess(req, res, threadId)))
                return;
            const result = await opts.codex.forkThread({ threadId });
            const thread = result?.thread ?? result;
            const forkedId = String(thread?.id ?? "");
            const sanitizedThread = (0, threadSanitize_1.sanitizeThreadForClient)(thread);
            clearThreadListServerCache();
            res.json({ ok: true, threadId: forkedId || undefined, thread: sanitizedThread });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
        }
    });
    app.post("/api/thread/archive", async (req, res) => {
        if (!opts.codex) {
            res.status(501).json({ ok: false, error: "not_supported" });
            return;
        }
        const body = (req.body ?? {});
        const threadId = String(body.threadId ?? "").trim();
        if (!threadId) {
            res.status(400).json({ ok: false, error: "invalid_request" });
            return;
        }
        try {
            if (!(await requireThreadAccess(req, res, threadId)))
                return;
            // 先删除本地完整历史，确保无论 CLI 归档是否成功，数据库都立即反映“已移除”状态。
            resolveThreadListStore()?.deleteThreadHistory(threadId);
            clearThreadListServerCache();
            const result = await opts.codex.archiveThread({ threadId });
            res.json({ ok: true, ...result });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
        }
    });
    app.post("/api/thread/unarchive", async (req, res) => {
        if (!opts.codex) {
            res.status(501).json({ ok: false, error: "not_supported" });
            return;
        }
        const body = (req.body ?? {});
        const threadId = String(body.threadId ?? "").trim();
        if (!threadId) {
            res.status(400).json({ ok: false, error: "invalid_request" });
            return;
        }
        try {
            if (!(await requireThreadAccess(req, res, threadId)))
                return;
            const result = await opts.codex.unarchiveThread({ threadId });
            clearThreadListServerCache();
            res.json({ ok: true, ...result });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
        }
    });
    app.post("/api/thread/rollback", async (req, res) => {
        if (!opts.codex) {
            res.status(501).json({ ok: false, error: "not_supported" });
            return;
        }
        const body = (req.body ?? {});
        const threadId = String(body.threadId ?? "").trim();
        const numTurns = Number(body.numTurns ?? 0);
        if (!threadId || !Number.isFinite(numTurns) || numTurns < 1) {
            res.status(400).json({ ok: false, error: "invalid_request" });
            return;
        }
        try {
            if (!(await requireThreadAccess(req, res, threadId)))
                return;
            const result = await opts.codex.rollbackThread({ threadId, numTurns: Math.floor(numTurns) });
            clearThreadListServerCache();
            res.json({ ok: true, ...result });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
        }
    });
    // API 路由兜底：未命中的 `/api/*` 统一返回 JSON 404，避免落到 HTML SPA fallback。
    app.use("/api", (_req, res) => {
        res.status(404).json({ ok: false, error: "not_found" });
    });
    if (fs_1.default.existsSync(webDist)) {
        app.use(express_1.default.static(webDist, { index: false }));
        app.get("*", (_req, res) => {
            res.setHeader("Cache-Control", "no-cache");
            res.sendFile(path_1.default.join(webDist, "index.html"));
        });
    }
    return app;
}
function isSecureRequest(req) {
    if (req.secure)
        return true;
    const xfProto = String(req.headers["x-forwarded-proto"] ?? "");
    return xfProto.toLowerCase() === "https";
}
function sanitizeUploadedFilename(input) {
    const name = input.trim();
    if (!name)
        return null;
    if (name.includes("/") || name.includes("\\") || name.includes("\0"))
        return null;
    // Only allow our generated names.
    if (!/^(?:img|att)-\d{13}-[a-f0-9]{16}(?:\.[a-z0-9]{1,10})?$/i.test(name))
        return null;
    return name;
}
function safeExtFromFilename(filename) {
    const ext = path_1.default.extname(filename || "").toLowerCase();
    if (!ext)
        return "";
    if (ext.length > 12)
        return "";
    if (!/^\.[a-z0-9]+$/.test(ext))
        return "";
    return ext;
}
function normalizeUploadedDisplayName(value) {
    const name = String(value ?? "").trim();
    // Some multipart clients send a UTF-8 filename that Busboy exposes as Latin-1.
    if (!name || !/[\u0080-\u00ff]/.test(name) || [...name].some((char) => char.charCodeAt(0) > 255))
        return name;
    try {
        const decoded = Buffer.from(name, "latin1").toString("utf8");
        return decoded && !decoded.includes("�") ? decoded : name;
    }
    catch {
        return name;
    }
}
function getWebUiVersion(webDist) {
    const indexPath = path_1.default.join(webDist, "index.html");
    try {
        const stat = fs_1.default.statSync(indexPath);
        if (!stat.isFile())
            return null;
        return `${Math.floor(stat.mtimeMs)}-${stat.size}`;
    }
    catch {
        return null;
    }
}
async function receiveAttachmentUpload(req, opts) {
    const contentType = String(req.headers["content-type"] ?? "");
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
        throw Object.assign(new Error("expected multipart/form-data"), { status: 415 });
    }
    const { dir, withinCodexCwd } = (0, adminUserUploads_1.getUserUploadsDir)(opts.username);
    await fs_1.default.promises.mkdir(dir, { recursive: true });
    const bb = (0, busboy_1.default)({
        headers: req.headers,
        limits: { files: 1, fileSize: Math.max(1, Math.floor(opts.maxBytes)) },
    });
    let done = false;
    let fileFound = false;
    let uploadError = null;
    let localPathToCleanup = null;
    let saved = null;
    let writeStream = null;
    let writePromise = null;
    let writeReject = null;
    const finishWrite = async () => {
        if (!writePromise)
            return;
        await writePromise;
    };
    const abortWrite = async (err) => {
        if (done)
            return;
        done = true;
        uploadError = err;
        if (writeReject)
            writeReject(err);
        try {
            writeStream?.destroy();
        }
        catch {
            // ignore
        }
    };
    bb.on("file", (_fieldname, file, info) => {
        fileFound = true;
        const originalName = normalizeUploadedDisplayName(info?.filename ?? "attachment") || "attachment";
        const mime = String(info?.mimeType ?? info?.mimetype ?? "application/octet-stream").trim().toLowerCase();
        const ext = safeExtFromFilename(originalName);
        const filename = `att-${Date.now()}-${crypto_1.default.randomBytes(8).toString("hex")}${ext}`;
        const localPath = path_1.default.join(dir, filename);
        const apiUrl = `/api/uploads/${encodeURIComponent(filename)}`;
        localPathToCleanup = localPath;
        let size = 0;
        writeStream = fs_1.default.createWriteStream(localPath, { flags: "wx" });
        writePromise = new Promise((resolve, reject) => {
            writeReject = reject;
            writeStream.on("error", reject);
            writeStream.on("finish", resolve);
        });
        // Avoid Node's PromiseRejectionHandledWarning when we intentionally reject early (e.g. size limit).
        writePromise.catch(() => { });
        file.on("data", (chunk) => {
            size += Buffer.byteLength(chunk);
        });
        file.on("limit", () => {
            file.unpipe(writeStream);
            file.resume();
            void abortWrite(Object.assign(new Error("file too large"), { status: 413 }));
        });
        file.on("error", (err) => {
            void abortWrite(err);
        });
        file.on("end", () => {
            if (file.truncated) {
                void abortWrite(Object.assign(new Error("file too large"), { status: 413 }));
                return;
            }
            saved = { filename, originalName, mime, size, localPath, apiUrl };
        });
        file.pipe(writeStream);
    });
    try {
        const result = await new Promise((resolve, reject) => {
            bb.on("error", reject);
            bb.on("finish", () => resolve(saved));
            req.pipe(bb);
        });
        await finishWrite();
        if (uploadError)
            throw uploadError;
        if (!fileFound || !result) {
            throw Object.assign(new Error("no file uploaded"), { status: 400 });
        }
        if (result.size <= 0) {
            throw Object.assign(new Error("empty upload"), { status: 400 });
        }
        localPathToCleanup = null;
        return { ...result, withinCodexCwd };
    }
    catch (err) {
        if (localPathToCleanup) {
            try {
                await fs_1.default.promises.unlink(localPathToCleanup);
            }
            catch {
                // ignore
            }
        }
        throw err;
    }
}
//# sourceMappingURL=app.js.map
