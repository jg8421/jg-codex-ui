"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVER_CONFIG = exports.DEFAULT_CODEX_WEB_AUTH_DB_PATH = exports.DEFAULT_CODEX_WEB_HISTORY_DB_PATH = exports.DEFAULT_CODEX_WEB_DB_DIR = void 0;
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
/**
 * 默认数据库目录。
 * Default database directory.
 */
exports.DEFAULT_CODEX_WEB_DB_DIR = path_1.default.join(os_1.default.homedir(), ".codex_cli_web");
/**
 * 默认历史数据库路径。
 * Default history db path.
 */
exports.DEFAULT_CODEX_WEB_HISTORY_DB_PATH = path_1.default.join(exports.DEFAULT_CODEX_WEB_DB_DIR, "history.db");
/**
 * 默认认证数据库路径。
 * Default auth db path.
 */
exports.DEFAULT_CODEX_WEB_AUTH_DB_PATH = path_1.default.join(exports.DEFAULT_CODEX_WEB_DB_DIR, "auth.db");
/**
 * 服务端集中配置（中英文注释）。
 * Centralized server config (with Chinese and English comments).
 *
 * 说明：
 * - 这是“默认配置”入口；
 * - 若同时设置了对应环境变量，环境变量仍会优先。
 *
 * Notes:
 * - This file is the source for default configuration;
 * - Matching env vars still take precedence when provided.
 */
exports.SERVER_CONFIG = {
    web: {
        host: "127.0.0.1",
        port: 8787,
        // openThreadTurnsLimit：打开线程时默认只下发最近一页 turns（默认 2），用户再按页向前翻历史。
        openThreadTurnsLimit: 2,
        maxUploadBytes: 100 * 1024 * 1024,
        uploadBaseDir: ".codex-web/uploads",
        history: {
            mode: "primary",
            dbPath: exports.DEFAULT_CODEX_WEB_HISTORY_DB_PATH,
            pageLimit: 2,
        },
    },
    auth: {
        sessionToken: "",
        usersFile: ".codex-web/users.json",
        userWorkspacesFile: ".codex-web/user-workspaces.json",
        dbPath: exports.DEFAULT_CODEX_WEB_AUTH_DB_PATH,
    },
    codex: {
        bin: "codex",
        appServerArgs: ["app-server", "--listen", "stdio://"],
        cwd: ".",
        allowedCwdRoots: [],
        approvalPolicy: "on-request",
        sandboxMode: "workspace-write",
        historyPersistence: null,
        disableResponseStorage: null,
    },
};
//# sourceMappingURL=serverConfig.js.map