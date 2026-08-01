"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKSPACE_ROOT = void 0;
exports.getHost = getHost;
exports.getPort = getPort;
exports.getSessionToken = getSessionToken;
exports.getCodexBin = getCodexBin;
exports.getCodexAppServerArgs = getCodexAppServerArgs;
exports.getCodexCwd = getCodexCwd;
exports.getCodexWebDistDir = getCodexWebDistDir;
exports.getWebHistoryMode = getWebHistoryMode;
exports.getWebHistoryDbPath = getWebHistoryDbPath;
exports.getWebHistoryPageLimit = getWebHistoryPageLimit;
exports.getWebHistoryWorkerCount = getWebHistoryWorkerCount;
exports.getWebOpenThreadTurnsLimit = getWebOpenThreadTurnsLimit;
exports.getCodexWebAuthDbPath = getCodexWebAuthDbPath;
exports.getCodexWebUsersFile = getCodexWebUsersFile;
exports.getCodexWebUserWorkspacesFile = getCodexWebUserWorkspacesFile;
exports.getCodexAllowedCwdRoots = getCodexAllowedCwdRoots;
exports.getCodexApprovalPolicy = getCodexApprovalPolicy;
exports.getCodexSandboxMode = getCodexSandboxMode;
exports.getCodexHistoryPersistence = getCodexHistoryPersistence;
exports.getCodexDisableResponseStorage = getCodexDisableResponseStorage;
exports.getWebMaxUploadBytes = getWebMaxUploadBytes;
exports.getWebUploadBaseDir = getWebUploadBaseDir;
exports.getWebLogCwdSwitchEnabled = getWebLogCwdSwitchEnabled;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const serverConfig_1 = require("./config/serverConfig");
exports.WORKSPACE_ROOT = path_1.default.resolve(__dirname, "..", "..");
/**
 * 服务端配置统一入口。
 * Single source of truth for server configuration access.
 *
 * 说明：
 * - 默认值来自 `server/src/config/serverConfig.ts`；
 * - `CODEX_CONFIG` 可一次性覆盖默认值（支持 JSON 字符串或 JSON 文件路径）；
 * - 对应环境变量存在时，环境变量优先。
 *
 * Notes:
 * - Default values are sourced from `server/src/config/serverConfig.ts`;
 * - `CODEX_CONFIG` can override defaults in one place (inline JSON or JSON file path);
 * - Matching environment variables still take precedence.
 */
/**
 * 缓存最近一次解析的 `CODEX_CONFIG` 原始值。
 * Cache the last raw `CODEX_CONFIG` value.
 */
let cachedCodexConfigRaw = "__UNSET__";
/**
 * 缓存最近一次合并后的运行时配置。
 * Cache the last merged runtime configuration.
 */
let cachedRuntimeConfig = serverConfig_1.SERVER_CONFIG;
/**
 * 运行时配置获取器。
 * Runtime configuration accessor.
 */
function getRuntimeServerConfig() {
    // 支持单变量配置入口：`CODEX_CONFIG`。
    // Support single-entry config via `CODEX_CONFIG`.
    const rawCodexConfig = String(process.env.CODEX_CONFIG ?? "").trim();
    // 原始值未变化时直接走缓存，避免重复解析文件/JSON。
    // Reuse cache when raw value is unchanged.
    if (rawCodexConfig === cachedCodexConfigRaw)
        return cachedRuntimeConfig;
    const parsedCodexConfig = loadCodexConfigOverride(rawCodexConfig);
    const mergedRuntimeConfig = mergeServerConfig(serverConfig_1.SERVER_CONFIG, parsedCodexConfig);
    cachedCodexConfigRaw = rawCodexConfig;
    cachedRuntimeConfig = mergedRuntimeConfig;
    return mergedRuntimeConfig;
}
/**
 * 解析 `CODEX_CONFIG` 覆盖内容。
 * Parse `CODEX_CONFIG` override value.
 */
function loadCodexConfigOverride(rawCodexConfig) {
    if (!rawCodexConfig)
        return null;
    try {
        // 形态 1：内联 JSON 字符串。
        // Form 1: inline JSON string.
        if (rawCodexConfig.startsWith("{")) {
            return JSON.parse(rawCodexConfig);
        }
        // 形态 2：JSON 文件路径。
        // Form 2: JSON file path.
        const resolvedConfigPath = path_1.default.isAbsolute(rawCodexConfig)
            ? rawCodexConfig
            : path_1.default.resolve(process.cwd(), rawCodexConfig);
        const configFileContent = fs_1.default.readFileSync(resolvedConfigPath, "utf8");
        return JSON.parse(configFileContent);
    }
    catch {
        // 解析失败时回退默认配置，避免启动失败。
        // Fallback to default config when parsing fails.
        return null;
    }
}
/**
 * 判断值是否为 plain object。
 * Check whether a value is a plain object.
 */
function isRecord(input) {
    return typeof input === "object" && input !== null && !Array.isArray(input);
}
/**
 * 读取字符串配置项。
 * Pick string config value.
 */
function pickString(defaultValue, candidateValue) {
    return typeof candidateValue === "string" ? candidateValue : defaultValue;
}
/**
 * 读取数值配置项。
 * Pick number config value.
 */
function pickNumber(defaultValue, candidateValue) {
    return typeof candidateValue === "number" && Number.isFinite(candidateValue) ? candidateValue : defaultValue;
}
/**
 * 读取字符串数组配置项。
 * Pick string-array config value.
 */
function pickStringArray(defaultValue, candidateValue) {
    if (!Array.isArray(candidateValue))
        return [...defaultValue];
    const normalizedValues = candidateValue
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
    return normalizedValues;
}
/**
 * 读取历史模式配置项。
 * Pick history mode config value.
 */
function pickWebHistoryMode(defaultValue, candidateValue) {
    if (candidateValue === "off" || candidateValue === "shadow" || candidateValue === "primary") {
        return candidateValue;
    }
    return defaultValue;
}
/**
 * 读取审批策略配置项。
 * Pick approval policy config value.
 */
function pickApprovalPolicy(defaultValue, candidateValue) {
    if (candidateValue === "untrusted" ||
        candidateValue === "on-failure" ||
        candidateValue === "on-request" ||
        candidateValue === "never") {
        return candidateValue;
    }
    return defaultValue;
}
/**
 * 读取沙箱模式配置项。
 * Pick sandbox mode config value.
 */
function pickSandboxMode(defaultValue, candidateValue) {
    if (candidateValue === "read-only" ||
        candidateValue === "workspace-write" ||
        candidateValue === "danger-full-access") {
        return candidateValue;
    }
    return defaultValue;
}
/**
 * 读取 history persistence 配置项。
 * Pick history persistence config value.
 */
function pickHistoryPersistence(defaultValue, candidateValue) {
    if (candidateValue === null)
        return null;
    if (candidateValue === "none" || candidateValue === "save-all" || candidateValue === "resume-based") {
        return candidateValue;
    }
    return defaultValue;
}
/**
 * 读取可空布尔配置项。
 * Pick nullable boolean config value.
 */
function pickBooleanOrNull(defaultValue, candidateValue) {
    if (candidateValue === null)
        return null;
    if (typeof candidateValue === "boolean")
        return candidateValue;
    return defaultValue;
}
/**
 * 合并默认配置与 `CODEX_CONFIG` 覆盖。
 * Merge default config with `CODEX_CONFIG` override.
 */
function mergeServerConfig(baseConfig, overrideConfig) {
    const overrideRoot = isRecord(overrideConfig) ? overrideConfig : {};
    const overrideWeb = isRecord(overrideRoot.web) ? overrideRoot.web : {};
    const overrideWebHistory = isRecord(overrideWeb.history) ? overrideWeb.history : {};
    const overrideAuth = isRecord(overrideRoot.auth) ? overrideRoot.auth : {};
    const overrideCodex = isRecord(overrideRoot.codex) ? overrideRoot.codex : {};
    return {
        web: {
            host: pickString(baseConfig.web.host, overrideWeb.host),
            port: pickNumber(baseConfig.web.port, overrideWeb.port),
            openThreadTurnsLimit: pickNumber(baseConfig.web.openThreadTurnsLimit, overrideWeb.openThreadTurnsLimit),
            maxUploadBytes: pickNumber(baseConfig.web.maxUploadBytes, overrideWeb.maxUploadBytes),
            uploadBaseDir: pickString(baseConfig.web.uploadBaseDir, overrideWeb.uploadBaseDir),
            history: {
                mode: pickWebHistoryMode(baseConfig.web.history.mode, overrideWebHistory.mode),
                dbPath: pickString(baseConfig.web.history.dbPath, overrideWebHistory.dbPath),
                pageLimit: pickNumber(baseConfig.web.history.pageLimit, overrideWebHistory.pageLimit),
            },
        },
        auth: {
            sessionToken: pickString(baseConfig.auth.sessionToken, overrideAuth.sessionToken),
            usersFile: pickString(baseConfig.auth.usersFile, overrideAuth.usersFile),
            userWorkspacesFile: pickString(baseConfig.auth.userWorkspacesFile, overrideAuth.userWorkspacesFile),
            dbPath: pickString(baseConfig.auth.dbPath, overrideAuth.dbPath),
        },
        codex: {
            bin: pickString(baseConfig.codex.bin, overrideCodex.bin),
            appServerArgs: pickStringArray(baseConfig.codex.appServerArgs, overrideCodex.appServerArgs),
            cwd: pickString(baseConfig.codex.cwd, overrideCodex.cwd),
            allowedCwdRoots: pickStringArray(baseConfig.codex.allowedCwdRoots, overrideCodex.allowedCwdRoots),
            approvalPolicy: pickApprovalPolicy(baseConfig.codex.approvalPolicy, overrideCodex.approvalPolicy),
            sandboxMode: pickSandboxMode(baseConfig.codex.sandboxMode, overrideCodex.sandboxMode),
            historyPersistence: pickHistoryPersistence(baseConfig.codex.historyPersistence, overrideCodex.historyPersistence),
            disableResponseStorage: pickBooleanOrNull(baseConfig.codex.disableResponseStorage, overrideCodex.disableResponseStorage),
        },
    };
}
/**
 * 获取 Web 监听地址。
 * Get web bind host.
 */
function getHost() {
    const runtimeConfig = getRuntimeServerConfig();
    // 默认仅绑定 loopback，避免误部署导致服务对外暴露。
    // Default binds loopback only to reduce accidental exposure.
    return process.env.CODEX_WEB_HOST ?? runtimeConfig.web.host;
}
/**
 * 获取 Web 监听端口。
 * Get web bind port.
 */
function getPort() {
    const runtimeConfig = getRuntimeServerConfig();
    const defaultPort = Number(runtimeConfig.web.port);
    const rawPort = process.env.CODEX_WEB_PORT ?? String(defaultPort);
    const parsedPort = Number(rawPort);
    if (!Number.isFinite(parsedPort) || parsedPort <= 0)
        return defaultPort;
    return Math.floor(parsedPort);
}
/**
 * 获取会话签名密钥。
 * Get session token secret.
 */
function getSessionToken() {
    const runtimeConfig = getRuntimeServerConfig();
    const configuredSessionToken = String(process.env.SESSION_TOKEN ?? runtimeConfig.auth.sessionToken ?? "").trim();
    if (configuredSessionToken)
        return configuredSessionToken;
    return crypto_1.default.randomBytes(24).toString("hex");
}
/**
 * 获取 Codex 可执行命令。
 * Get codex executable command.
 */
function getCodexBin() {
    const runtimeConfig = getRuntimeServerConfig();
    return process.env.CODEX_BIN ?? runtimeConfig.codex.bin;
}
/**
 * 获取 Codex App Server 启动参数（子命令 + 参数数组）。
 *
 * 说明：
 * - `CODEX_APP_SERVER_ARGS` 支持两种形式：
 *   1) JSON 数组：`["app-server","--listen","stdio://"]`
 *   2) 逗号/换行/分号分隔：`app-server,--listen,stdio://`
 * - 未设置 env 时，回退到 `CODEX_CONFIG.codex.appServerArgs`（或内置默认值）。
 *
 * Get codex app-server launch args (subcommand + args array).
 */
function getCodexAppServerArgs() {
    const runtimeConfig = getRuntimeServerConfig();
    const rawEnv = String(process.env.CODEX_APP_SERVER_ARGS ?? "").trim();
    if (rawEnv) {
        // 形态 1：JSON 数组。
        // Form 1: JSON array.
        if (rawEnv.startsWith("[")) {
            try {
                const parsed = JSON.parse(rawEnv);
                if (Array.isArray(parsed)) {
                    const out = parsed.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
                    if (out.length)
                        return out;
                }
            }
            catch {
                // ignore and fallback to list parsing below
            }
        }
        // 形态 2：逗号/换行/分号分隔。
        // Form 2: comma/newline/semicolon-delimited list.
        const list = splitArgvEnvList(rawEnv);
        if (list.length)
            return list;
    }
    const configured = (runtimeConfig.codex.appServerArgs ?? []).map((v) => String(v ?? "").trim()).filter(Boolean);
    if (configured.length)
        return configured;
    return ["app-server", "--listen", "stdio://"];
}
/**
 * 获取 Codex 工作目录。
 * Get codex working directory.
 */
function getCodexCwd() {
    const runtimeConfig = getRuntimeServerConfig();
    const envCwd = process.env.CODEX_CWD;
    if (envCwd)
        return envCwd;
    // 配置文件中的相对路径统一按仓库根目录解析。
    // Relative path in config file resolves from workspace root.
    return path_1.default.resolve(exports.WORKSPACE_ROOT, runtimeConfig.codex.cwd);
}
/**
 * 获取 Web 静态资源目录。
 * Get bundled/static web dist directory.
 */
function getCodexWebDistDir() {
    const envWebDistDir = String(process.env.CODEX_WEB_DIST_DIR ?? "").trim();
    if (envWebDistDir)
        return path_1.default.resolve(envWebDistDir);
    return path_1.default.resolve(exports.WORKSPACE_ROOT, "web", "dist");
}
/**
 * 获取 Web 历史模式：
 * - off: 完全关闭 SQLite 历史链路。
 * - shadow: 保留旧读取链路，仅做 SQLite 双写。
 * - primary: 读取优先走 SQLite 历史接口。
 *
 * Get web history mode:
 * - off: disable sqlite history runtime.
 * - shadow: keep old read path with sqlite dual-write.
 * - primary: use sqlite as primary read path.
 */
function getWebHistoryMode() {
    const runtimeConfig = getRuntimeServerConfig();
    const rawMode = String(process.env.CODEX_WEB_HISTORY_MODE ?? runtimeConfig.web.history.mode ?? "")
        .trim()
        .toLowerCase();
    if (rawMode === "off" || rawMode === "shadow" || rawMode === "primary")
        return rawMode;
    // 默认启用主读（同时保留双写），减少首次部署时遗漏配置导致历史不可读。
    // Default to primary read mode for safer first deployment.
    return "primary";
}
/**
 * 获取 Web 历史 SQLite 路径；支持相对路径并统一转绝对路径。
 * Get web history sqlite path as an absolute path.
 */
function getWebHistoryDbPath() {
    const runtimeConfig = getRuntimeServerConfig();
    const configuredHistoryDbPath = String(process.env.CODEX_WEB_HISTORY_DB_PATH ?? runtimeConfig.web.history.dbPath ?? "").trim();
    if (!configuredHistoryDbPath)
        return path_1.default.resolve(serverConfig_1.DEFAULT_CODEX_WEB_HISTORY_DB_PATH);
    if (path_1.default.isAbsolute(configuredHistoryDbPath))
        return path_1.default.resolve(configuredHistoryDbPath);
    return path_1.default.resolve(exports.WORKSPACE_ROOT, configuredHistoryDbPath);
}
/**
 * 获取历史消息分页默认大小（仅按 user/assistant 边界计数）。
 * Get default history messages page limit (counts user/assistant boundaries only).
 */
function getWebHistoryPageLimit() {
    const runtimeConfig = getRuntimeServerConfig();
    const configuredDefault = Number(runtimeConfig.web.history.pageLimit);
    const defaultLimit = Number.isFinite(configuredDefault) ? Math.max(1, Math.floor(configuredDefault)) : 2;
    const rawLimit = String(process.env.CODEX_WEB_HISTORY_PAGE_LIMIT ?? defaultLimit).trim();
    const parsedLimit = Number(rawLimit);
    if (!Number.isFinite(parsedLimit) || parsedLimit <= 0)
        return defaultLimit;
    return Math.min(500, Math.max(1, Math.floor(parsedLimit)));
}
/**
 * 获取 history SQLite worker 数量：
 * - 0：禁用 worker（回退主线程直连 SQLite）；
 * - >=1：启用 worker pool。
 *
 * 说明：默认启用 1 个 worker（写入与查询共用），以减少 better-sqlite3 同步调用对主线程的阻塞。
 */
function getWebHistoryWorkerCount() {
    const raw = String(process.env.CODEX_WEB_HISTORY_WORKERS ?? "1").trim();
    if (!raw)
        return 1;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0)
        return 1;
    // 上限保护：避免误配置启动过多 worker。
    return Math.min(16, Math.floor(parsed));
}
/**
 * 获取打开线程时的 turns 数量上限。
 * Get open-thread turns limit.
 */
function getWebOpenThreadTurnsLimit() {
    const runtimeConfig = getRuntimeServerConfig();
    const defaultTurnsLimit = Number(runtimeConfig.web.openThreadTurnsLimit);
    const rawTurnsLimit = String(process.env.CODEX_WEB_OPEN_THREAD_TURNS_LIMIT ?? defaultTurnsLimit).trim().toLowerCase();
    if (!rawTurnsLimit)
        return defaultTurnsLimit;
    if (rawTurnsLimit === "all" || rawTurnsLimit === "unlimited" || rawTurnsLimit === "infinite")
        return Number.MAX_SAFE_INTEGER;
    const parsedTurnsLimit = Number(rawTurnsLimit);
    if (!Number.isFinite(parsedTurnsLimit) || parsedTurnsLimit <= 0)
        return defaultTurnsLimit;
    return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(parsedTurnsLimit));
}
/**
 * 获取认证/工作区设置 SQLite 路径。
 * Get auth/settings sqlite path.
 */
function getCodexWebAuthDbPath() {
    const runtimeConfig = getRuntimeServerConfig();
    const envAuthDbPath = process.env.CODEX_WEB_AUTH_DB_PATH?.trim();
    if (envAuthDbPath)
        return path_1.default.resolve(envAuthDbPath);
    const configuredAuthDbPath = String(runtimeConfig.auth.dbPath ?? "").trim();
    if (!configuredAuthDbPath)
        return path_1.default.resolve(serverConfig_1.DEFAULT_CODEX_WEB_AUTH_DB_PATH);
    if (path_1.default.isAbsolute(configuredAuthDbPath))
        return path_1.default.resolve(configuredAuthDbPath);
    return path_1.default.resolve(getCodexCwd(), configuredAuthDbPath);
}
/**
 * 获取用户仓库存储文件路径。
 * Get legacy user-store json path.
 */
function getCodexWebUsersFile() {
    const runtimeConfig = getRuntimeServerConfig();
    const envUsersFile = process.env.CODEX_WEB_USERS_FILE?.trim();
    if (envUsersFile)
        return path_1.default.resolve(envUsersFile);
    const configuredUsersFile = String(runtimeConfig.auth.usersFile).trim();
    if (path_1.default.isAbsolute(configuredUsersFile))
        return path_1.default.resolve(configuredUsersFile);
    const defaultUsersFile = path_1.default.join(getCodexCwd(), configuredUsersFile);
    return path_1.default.resolve(defaultUsersFile);
}
/**
 * 获取用户工作区仓库存储文件路径。
 * Get legacy user-workspace-store json path.
 */
function getCodexWebUserWorkspacesFile() {
    const runtimeConfig = getRuntimeServerConfig();
    const envUserWorkspacesFile = process.env.CODEX_WEB_USER_WORKSPACES_FILE?.trim();
    if (envUserWorkspacesFile)
        return path_1.default.resolve(envUserWorkspacesFile);
    const configuredUserWorkspacesFile = String(runtimeConfig.auth.userWorkspacesFile).trim();
    if (path_1.default.isAbsolute(configuredUserWorkspacesFile))
        return path_1.default.resolve(configuredUserWorkspacesFile);
    const defaultUserWorkspacesFile = path_1.default.join(getCodexCwd(), configuredUserWorkspacesFile);
    return path_1.default.resolve(defaultUserWorkspacesFile);
}
/**
 * 转义正则特殊字符。
 * Escape regexp special characters.
 */
function escapeRegExp(input) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/**
 * 解析环境变量列表（逗号/换行/path.delimiter 分隔）。
 * Parse env list split by comma/newline/path.delimiter.
 */
function splitEnvList(raw) {
    const trimmedRaw = raw.trim();
    if (!trimmedRaw)
        return [];
    const delimiterPattern = escapeRegExp(path_1.default.delimiter);
    const listParts = trimmedRaw.split(new RegExp(`[,\n${delimiterPattern}]`, "g"));
    return listParts.map((part) => part.trim()).filter(Boolean);
}
/**
 * 解析“参数数组”类环境变量（逗号/换行/分号分隔）。
 *
 * 说明：
 * - 不能使用 `path.delimiter`（Linux/macOS 为 `:`），否则会误拆 `stdio://` 这类值；
 * - Windows 下常见分隔符为 `;`，因此这里显式支持分号。
 *
 * Parse argv-like env list (comma/newline/semicolon delimited).
 */
function splitArgvEnvList(raw) {
    const trimmedRaw = raw.trim();
    if (!trimmedRaw)
        return [];
    const listParts = trimmedRaw.split(/[,\n;]/g);
    return listParts.map((part) => part.trim()).filter(Boolean);
}
/**
 * 获取全局允许的 cwd 根目录列表。
 * Get globally allowed cwd roots.
 */
function getCodexAllowedCwdRoots() {
    const runtimeConfig = getRuntimeServerConfig();
    const rawAllowedRootsEnv = process.env.CODEX_ALLOWED_CWD_ROOTS ?? "";
    const parsedAllowedRootsFromEnv = splitEnvList(rawAllowedRootsEnv);
    const configuredAllowedRoots = (runtimeConfig.codex.allowedCwdRoots ?? []).map((root) => String(root ?? "").trim()).filter(Boolean);
    const defaultRoot = getCodexCwd();
    const candidateRoots = parsedAllowedRootsFromEnv.length
        ? parsedAllowedRootsFromEnv
        : configuredAllowedRoots.length
            ? configuredAllowedRoots
            : [defaultRoot, path_1.default.dirname(defaultRoot)];
    const seenResolvedRoots = new Set();
    const resolvedRoots = [];
    for (const candidateRoot of candidateRoots) {
        const resolvedRoot = path_1.default.resolve(candidateRoot);
        if (seenResolvedRoots.has(resolvedRoot))
            continue;
        seenResolvedRoots.add(resolvedRoot);
        resolvedRoots.push(resolvedRoot);
    }
    return resolvedRoots;
}
/**
 * 获取 Codex 审批策略。
 * Get codex approval policy.
 */
function getCodexApprovalPolicy() {
    const runtimeConfig = getRuntimeServerConfig();
    const defaultApprovalPolicy = runtimeConfig.codex.approvalPolicy;
    const configuredApprovalPolicy = process.env.CODEX_APPROVAL_POLICY ?? defaultApprovalPolicy;
    if (configuredApprovalPolicy === "untrusted" ||
        configuredApprovalPolicy === "on-failure" ||
        configuredApprovalPolicy === "on-request" ||
        configuredApprovalPolicy === "never") {
        return configuredApprovalPolicy;
    }
    return defaultApprovalPolicy;
}
/**
 * 获取 Codex 沙箱模式。
 * Get codex sandbox mode.
 */
function getCodexSandboxMode() {
    const runtimeConfig = getRuntimeServerConfig();
    const defaultSandboxMode = runtimeConfig.codex.sandboxMode;
    const configuredSandboxMode = process.env.CODEX_SANDBOX_MODE ?? defaultSandboxMode;
    if (configuredSandboxMode === "read-only" ||
        configuredSandboxMode === "workspace-write" ||
        configuredSandboxMode === "danger-full-access") {
        return configuredSandboxMode;
    }
    return defaultSandboxMode;
}
/**
 * 可选覆盖 Codex 的 history.persistence。
 * Optional override for codex history.persistence.
 */
function getCodexHistoryPersistence() {
    const runtimeConfig = getRuntimeServerConfig();
    const configuredHistoryPersistence = process.env.CODEX_HISTORY_PERSISTENCE ?? runtimeConfig.codex.historyPersistence ?? "";
    const normalizedHistoryPersistence = String(configuredHistoryPersistence).trim().toLowerCase();
    if (!normalizedHistoryPersistence)
        return null;
    if (normalizedHistoryPersistence === "none" ||
        normalizedHistoryPersistence === "save-all" ||
        normalizedHistoryPersistence === "resume-based") {
        return normalizedHistoryPersistence;
    }
    return null;
}
/**
 * 可选覆盖 Codex 的 disable_response_storage。
 * Optional override for codex disable_response_storage.
 */
function getCodexDisableResponseStorage() {
    const runtimeConfig = getRuntimeServerConfig();
    const configuredDisableResponseStorage = process.env.CODEX_DISABLE_RESPONSE_STORAGE;
    if (typeof configuredDisableResponseStorage === "string") {
        const normalizedEnvValue = configuredDisableResponseStorage.trim().toLowerCase();
        if (!normalizedEnvValue)
            return null;
        if (normalizedEnvValue === "1" || normalizedEnvValue === "true" || normalizedEnvValue === "yes")
            return true;
        if (normalizedEnvValue === "0" || normalizedEnvValue === "false" || normalizedEnvValue === "no")
            return false;
        return null;
    }
    const defaultDisableResponseStorage = runtimeConfig.codex.disableResponseStorage;
    if (typeof defaultDisableResponseStorage === "boolean")
        return defaultDisableResponseStorage;
    return null;
}
/**
 * 获取上传单文件最大体积（字节）。
 * Get max upload bytes for a single file.
 */
function getWebMaxUploadBytes() {
    const runtimeConfig = getRuntimeServerConfig();
    const defaultMaxUploadBytes = Number(runtimeConfig.web.maxUploadBytes);
    const rawMaxUploadBytes = process.env.CODEX_WEB_MAX_UPLOAD_BYTES ?? String(defaultMaxUploadBytes);
    const parsedMaxUploadBytes = Number(rawMaxUploadBytes);
    if (!Number.isFinite(parsedMaxUploadBytes) || parsedMaxUploadBytes <= 0)
        return defaultMaxUploadBytes;
    return Math.floor(parsedMaxUploadBytes);
}
/**
 * 获取上传目录根路径（按用户子目录继续划分）。
 * Get upload base directory (per-user subdirs are created under it).
 */
function getWebUploadBaseDir() {
    const runtimeConfig = getRuntimeServerConfig();
    const rawUploadBaseDir = String(process.env.CODEX_WEB_UPLOAD_BASE_DIR ?? runtimeConfig.web.uploadBaseDir ?? "").trim();
    if (!rawUploadBaseDir)
        return path_1.default.resolve(getCodexCwd(), ".codex-web", "uploads");
    if (path_1.default.isAbsolute(rawUploadBaseDir))
        return path_1.default.resolve(rawUploadBaseDir);
    return path_1.default.resolve(getCodexCwd(), rawUploadBaseDir);
}
/**
 * 是否启用“cwd/工作目录切换”调试日志（默认关闭）。
 *
 * 支持的真值：`1`/`true`/`on`/`yes`（忽略大小写与首尾空格）。
 */
function getWebLogCwdSwitchEnabled() {
    const raw = String(process.env.CODEX_WEB_LOG_CWD_SWITCH ?? "").trim().toLowerCase();
    return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}
//# sourceMappingURL=env.js.map