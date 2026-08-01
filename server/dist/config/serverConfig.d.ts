import type { CodexHistoryPersistence } from "../codex/cliArgs";
import type { WebHistoryMode } from "../history/types";
/**
 * 默认数据库目录。
 * Default database directory.
 */
export declare const DEFAULT_CODEX_WEB_DB_DIR: string;
/**
 * 默认历史数据库路径。
 * Default history db path.
 */
export declare const DEFAULT_CODEX_WEB_HISTORY_DB_PATH: string;
/**
 * 默认认证数据库路径。
 * Default auth db path.
 */
export declare const DEFAULT_CODEX_WEB_AUTH_DB_PATH: string;
/**
 * 服务端集中配置类型。
 * Centralized server configuration type.
 */
export type ServerConfig = {
    /**
     * Web 服务配置。
     * Web service settings.
     */
    web: {
        /**
         * Web 服务监听地址。
         * Web server bind host.
         */
        host: string;
        /**
         * Web 服务监听端口。
         * Web server bind port.
         */
        port: number;
        /**
         * 首次打开线程的 turns 上限。
         * Initial turn limit when opening a thread.
         */
        openThreadTurnsLimit: number;
        /**
         * 单文件上传体积上限（字节）。
         * Max bytes for a single upload file.
         */
        maxUploadBytes: number;
        /**
         * 上传目录根路径（相对路径时基于 CODEX_CWD）。
         * Upload base directory (relative path resolves from CODEX_CWD).
         */
        uploadBaseDir: string;
        /**
         * Web 历史配置。
         * Web history settings.
         */
        history: {
            /**
             * 历史模式（off/shadow/primary）。
             * History mode (off/shadow/primary).
             */
            mode: WebHistoryMode;
            /**
             * SQLite 历史文件路径（相对路径时基于仓库根目录）。
             * SQLite history db path (relative path resolves from workspace root).
             */
            dbPath: string;
            /**
             * 历史消息分页默认大小（仅按 user/assistant 边界计数）。
             * Default page limit for history messages (counts user/assistant boundaries only).
             */
            pageLimit: number;
        };
    };
    /**
     * 认证与用户数据配置。
     * Auth and user data settings.
     */
    auth: {
        /**
         * 会话签名密钥；为空时运行期自动生成。
         * Session signing token; auto-generated at runtime when empty.
         */
        sessionToken: string;
        /**
         * 旧版用户仓库文件路径（仅用于迁移导入；相对路径时基于 CODEX_CWD）。
         * Legacy user store file path (import compatibility only; relative path resolves from CODEX_CWD).
         */
        usersFile: string;
        /**
         * 旧版用户工作区仓库文件路径（仅用于迁移导入；相对路径时基于 CODEX_CWD）。
         * Legacy user workspace file path (import compatibility only; relative path resolves from CODEX_CWD).
         */
        userWorkspacesFile: string;
        /**
         * 认证与工作区设置 SQLite 路径（相对路径时基于 CODEX_CWD）。
         * Auth/settings SQLite db path (relative path resolves from CODEX_CWD).
         */
        dbPath: string;
    };
    /**
     * Codex 运行配置。
     * Codex runtime settings.
     */
    codex: {
        /**
         * Codex 可执行命令名。
         * Codex executable name.
         */
        bin: string;
        /**
         * Codex App Server 启动参数（子命令 + 参数数组）。
         *
         * 说明：
         * - 默认对应 `codex app-server --listen stdio://`；
         * - 原生 Windows 环境下若 Codex CLI 的子命令/参数不同，可通过该字段覆盖。
         *
         * Codex App Server launch args (subcommand + args array).
         *
         * Notes:
         * - Defaults map to `codex app-server --listen stdio://`;
         * - On native Windows, override this if Codex CLI subcommands/flags differ.
         */
        appServerArgs: string[];
        /**
         * Codex 工作目录（相对路径时基于仓库根目录）。
         * Codex working directory (relative path resolves from workspace root).
         */
        cwd: string;
        /**
         * 全局允许的工作目录根列表（为空时按默认策略回退）。
         * Global allowed cwd roots (fallbacks to default policy when empty).
         */
        allowedCwdRoots: string[];
        /**
         * Codex 审批策略。
         * Codex approval policy.
         */
        approvalPolicy: "untrusted" | "on-failure" | "on-request" | "never";
        /**
         * Codex 沙箱模式。
         * Codex sandbox mode.
         */
        sandboxMode: "read-only" | "workspace-write" | "danger-full-access";
        /**
         * Codex history.persistence 默认覆盖值；null 表示不覆盖。
         * Default override for codex history.persistence; null means no override.
         */
        historyPersistence: CodexHistoryPersistence | null;
        /**
         * Codex disable_response_storage 默认覆盖值；null 表示不覆盖。
         * Default override for codex disable_response_storage; null means no override.
         */
        disableResponseStorage: boolean | null;
    };
};
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
export declare const SERVER_CONFIG: ServerConfig;
