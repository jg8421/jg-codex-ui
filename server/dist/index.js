"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const node_net_1 = __importDefault(require("node:net"));
const socket_io_1 = require("socket.io");
const ws_1 = require("ws");
const bootstrapAdmin_1 = require("./auth/bootstrapAdmin");
const adminInit_1 = require("./auth/adminInit");
const userStore_1 = require("./auth/userStore");
const env_1 = require("./env");
const app_1 = require("./app");
const authDb_1 = require("./auth/sqlite/authDb");
const legacyImport_1 = require("./auth/sqlite/legacyImport");
const history_1 = require("./history");
const sqliteHistoryStore_1 = require("./history/sqlite/sqliteHistoryStore");
const codexTaskTracker_1 = require("./status/codexTaskTracker");
const wsHub_1 = require("./ws/wsHub");
const socketIoBridge_1 = require("./ws/socketIoBridge");
const upstreamWsUrl_1 = require("./ws/upstreamWsUrl");
const userWorkspaceStore_1 = require("./workspace/userWorkspaceStore");
const userSettingsStore_1 = require("./settings/userSettingsStore");
const gitCredentialStore_1 = require("./git/gitCredentialStore");
const gitPushMetadataStore_1 = require("./git/gitPushMetadataStore");
const workspaceStatusStore_1 = require("./workspace/workspaceStatusStore");
const workspaceStatusSync_1 = require("./workspace/workspaceStatusSync");
const configArg_1 = require("./cli/configArg");
const codexMcpCli_1 = require("./codex/codexMcpCli");
const webBindArgs_1 = require("./cli/webBindArgs");
const createCodexAppServer_1 = require("./codex/createCodexAppServer");
async function main() {
    // 启动最早阶段先处理命令行 config 参数，确保后续 env 读取拿到最终配置。
    // Parse config arg at startup earliest stage so env readers see final value.
    (0, configArg_1.applyConfigArgToEnv)(process.argv.slice(2));
    // 启动最早阶段处理 Web 监听参数，便于通过 `ccw` CLI 直接覆盖 host/port。
    // Parse web bind args early so `ccw` can override host/port via CLI.
    (0, webBindArgs_1.applyWebBindArgsToEnv)(process.argv.slice(2));
    const host = (0, env_1.getHost)();
    const port = (0, env_1.getPort)();
    const sessionSecret = (0, env_1.getSessionToken)();
    const startedAtMs = Date.now();
    // 认证配置统一写入 auth.db，避免多 JSON 文件分散维护。
    const authDb = (0, authDb_1.createAuthDb)({ dbPath: (0, env_1.getCodexWebAuthDbPath)() });
    // DB 为空时尝试从 legacy JSON 导入，保证升级不丢历史账号与工作区配置。
    await (0, legacyImport_1.maybeImportLegacyJsonSettings)({
        authDb,
        usersFilePath: (0, env_1.getCodexWebUsersFile)(),
        userWorkspacesFilePath: (0, env_1.getCodexWebUserWorkspacesFile)(),
    });
    const userStore = await (0, userStore_1.createUserStore)({ authDb });
    // 当监听非 loopback 时，阻止“默认口令”对外暴露（误部署防呆）。
    await assertSafeAdminPasswordForHost(host, userStore);
    // 用户工作目录仓库：与鉴权 workspaces 分离，避免语义耦合。
    const userWorkspaceStore = await (0, userWorkspaceStore_1.createUserWorkspaceStore)({ authDb });
    // 工作目录状态仓库：持久化“运行中 / 待处理 / 尚未被任何用户查看的刚结束（全局已读）”。
    const workspaceStatusStore = await (0, workspaceStatusStore_1.createWorkspaceStatusStore)({ authDb });
    // 用户配置仓库：用于跨端同步主题/模型等偏好设置。
    const userSettingsStore = await (0, userSettingsStore_1.createUserSettingsStore)({ authDb });
    // Git 凭证仓库：启动时总是可用，主密钥由 auth.db 内部自动生成并持久化。
    const gitCredentialStore = await (0, gitCredentialStore_1.createGitCredentialStore)({ authDb });
    // Git push 元数据仓库：记录应用内成功 push 的提交时间。
    const gitPushMetadataStore = (0, gitPushMetadataStore_1.createGitPushMetadataStore)({ authDb });
    // 线程摘要仓库：供运行态同步补写列表摘要，避免“左轨状态已更新但会话列表为空”。
    const threadListStore = (0, sqliteHistoryStore_1.createSqliteHistoryStore)({ dbPath: (0, env_1.getWebHistoryDbPath)() });
    await (0, bootstrapAdmin_1.bootstrapAdmin)(userStore);
    const codex = (0, createCodexAppServer_1.createCodexAppServerFromEnv)();
    /**
     * hub：WS hub 实例引用；用于在“线程完成”时排除当前正在查看该线程的用户。
     */
    let hub = null;
    const codexTasks = new codexTaskTracker_1.CodexTaskTracker({
        onThreadRunningStateChange: (change) => {
            void (0, workspaceStatusSync_1.syncWorkspaceStatusForThreadRunningStateChange)(change, {
                codex,
                userStore,
                workspaceStatusStore,
                threadListStore,
                listActiveThreadViewUsernames: (threadId) => hub?.listThreadViewUsernames(threadId) ?? [],
            }).catch(() => {
                // 工作目录状态持久化失败不应影响主状态追踪链路。
            });
        },
    });
    const unsubscribeCodexTasks = codex.onNotification((n) => codexTasks.onNotification(n));
    // 按模式决定是否启用历史写入运行时。
    const historyRuntime = (0, history_1.createWebHistoryRuntime)({
        mode: (0, env_1.getWebHistoryMode)(),
        dbPath: (0, env_1.getWebHistoryDbPath)(),
        workerCount: (0, env_1.getWebHistoryWorkerCount)(),
    });
    let getWsClients = () => 0;
    const getStatusSnapshot = () => ({
        codex: codex.getStatus(),
        codexTask: codexTasks.getSnapshot(),
        ws: { clients: getWsClients() },
    });
    const app = (0, app_1.createApp)({
        sessionSecret,
        startedAtMs,
        getStatusSnapshot,
        getActiveTurnIds: (threadId) => codexTasks.getActiveTurnIds(threadId),
        codex,
        codexMcp: (0, codexMcpCli_1.createCodexMcpCli)({ codexBin: (0, env_1.getCodexBin)(), cwd: (0, env_1.getCodexCwd)() }),
        userStore,
        userWorkspaceStore,
        workspaceStatusStore,
        userSettingsStore,
        gitCredentialStore,
        gitPushMetadataStore,
        historyQuery: historyRuntime?.query ?? null,
    });
    const server = http_1.default.createServer(app);
    /**
     * 注意：不要用 `new WebSocketServer({ server, path: "/ws" })`。
     * 因为 ws 库在 path 不匹配时会对所有 upgrade 请求直接回 400（Bad Request），
     * 会误伤 Socket.IO 的 websocket upgrade（路径为 `/socket.io`）。
     *
     * 这里使用 `noServer` 模式，仅在 `/ws` 路径手动接管 upgrade。
     */
    const wss = new ws_1.WebSocketServer({ noServer: true });
    server.on("upgrade", (req, socket, head) => {
        try {
            const url = new URL(req.url ?? "", "http://localhost");
            if (url.pathname !== "/ws")
                return;
        }
        catch {
            return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req);
        });
    });
    getWsClients = () => wss.clients.size;
    const io = new socket_io_1.Server(server, {
        path: "/socket.io",
        transports: ["websocket", "polling"],
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    hub = new wsHub_1.WsHub(wss, codex, sessionSecret, getStatusSnapshot, {
        getActiveTurnIds: (threadId) => codexTasks.getActiveTurnIds(threadId),
        userStore,
        userWorkspaceStore,
        userSettingsStore,
        workspaceStatusStore,
        historyIngest: historyRuntime?.ingest ?? null,
    });
    const socketIoBridge = (0, socketIoBridge_1.createSocketIoBridge)({
        ioServer: io,
        upstreamWsUrlFactory: ({ socket, host: bridgeHost, port: bridgePort, rawWsPath }) => (0, upstreamWsUrl_1.buildScopedUpstreamWsUrl)({ socket, host: bridgeHost, port: bridgePort, rawWsPath }),
    });
    server.listen(port, host, () => {
        // eslint-disable-next-line no-console
        console.log(`codex-cli-web server listening on http://${host}:${port}`);
    });
    function shutdown(signal) {
        // eslint-disable-next-line no-console
        console.log(`shutting down (${signal})`);
        socketIoBridge.dispose();
        io.close();
        wss.close();
        server.close(() => process.exit(0));
        unsubscribeCodexTasks();
        hub?.dispose();
        threadListStore.close();
        void historyRuntime?.close();
        codex.dispose();
    }
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}
main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
});
/**
 * 判断监听地址是否为 loopback（仅本机可访问）。
 */
function isLoopbackHost(host) {
    const normalized = String(host ?? "").trim().toLowerCase();
    if (!normalized)
        return true;
    if (normalized === "localhost")
        return true;
    const ipVersion = node_net_1.default.isIP(normalized);
    if (ipVersion === 4)
        return normalized.startsWith("127.");
    if (ipVersion === 6)
        return normalized === "::1";
    return false;
}
/**
 * 当服务监听非 loopback 时，要求管理员初始化已完成，避免未初始化实例对外暴露。
 */
async function assertSafeAdminPasswordForHost(host, userStore) {
    if (isLoopbackHost(host))
        return;
    const state = await (0, adminInit_1.readAdminInitState)(userStore);
    if (!state.requiresSetup)
        return;
    throw new Error("Refusing to bind to a non-loopback host before admin initialization is completed on loopback.");
}
//# sourceMappingURL=index.js.map