import type { CodexHistoryPersistence } from "./codex/cliArgs";
import type { WebHistoryMode } from "./history/types";
export declare const WORKSPACE_ROOT: string;
export { type WebHistoryMode };
/**
 * 获取 Web 监听地址。
 * Get web bind host.
 */
export declare function getHost(): string;
/**
 * 获取 Web 监听端口。
 * Get web bind port.
 */
export declare function getPort(): number;
/**
 * 获取会话签名密钥。
 * Get session token secret.
 */
export declare function getSessionToken(): string;
/**
 * 获取 Codex 可执行命令。
 * Get codex executable command.
 */
export declare function getCodexBin(): string;
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
export declare function getCodexAppServerArgs(): string[];
/**
 * 获取 Codex 工作目录。
 * Get codex working directory.
 */
export declare function getCodexCwd(): string;
/**
 * 获取 Web 静态资源目录。
 * Get bundled/static web dist directory.
 */
export declare function getCodexWebDistDir(): string;
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
export declare function getWebHistoryMode(): WebHistoryMode;
/**
 * 获取 Web 历史 SQLite 路径；支持相对路径并统一转绝对路径。
 * Get web history sqlite path as an absolute path.
 */
export declare function getWebHistoryDbPath(): string;
/**
 * 获取历史消息分页默认大小（仅按 user/assistant 边界计数）。
 * Get default history messages page limit (counts user/assistant boundaries only).
 */
export declare function getWebHistoryPageLimit(): number;
/**
 * 获取 history SQLite worker 数量：
 * - 0：禁用 worker（回退主线程直连 SQLite）；
 * - >=1：启用 worker pool。
 *
 * 说明：默认启用 1 个 worker（写入与查询共用），以减少 better-sqlite3 同步调用对主线程的阻塞。
 */
export declare function getWebHistoryWorkerCount(): number;
/**
 * 获取打开线程时的 turns 数量上限。
 * Get open-thread turns limit.
 */
export declare function getWebOpenThreadTurnsLimit(): number;
/**
 * 获取认证/工作区设置 SQLite 路径。
 * Get auth/settings sqlite path.
 */
export declare function getCodexWebAuthDbPath(): string;
/**
 * 获取用户仓库存储文件路径。
 * Get legacy user-store json path.
 */
export declare function getCodexWebUsersFile(): string;
/**
 * 获取用户工作区仓库存储文件路径。
 * Get legacy user-workspace-store json path.
 */
export declare function getCodexWebUserWorkspacesFile(): string;
/**
 * 获取全局允许的 cwd 根目录列表。
 * Get globally allowed cwd roots.
 */
export declare function getCodexAllowedCwdRoots(): string[];
/**
 * 获取 Codex 审批策略。
 * Get codex approval policy.
 */
export declare function getCodexApprovalPolicy(): "untrusted" | "on-failure" | "on-request" | "never";
/**
 * 获取 Codex 沙箱模式。
 * Get codex sandbox mode.
 */
export declare function getCodexSandboxMode(): "read-only" | "workspace-write" | "danger-full-access";
/**
 * 可选覆盖 Codex 的 history.persistence。
 * Optional override for codex history.persistence.
 */
export declare function getCodexHistoryPersistence(): CodexHistoryPersistence | null;
/**
 * 可选覆盖 Codex 的 disable_response_storage。
 * Optional override for codex disable_response_storage.
 */
export declare function getCodexDisableResponseStorage(): boolean | null;
/**
 * 获取上传单文件最大体积（字节）。
 * Get max upload bytes for a single file.
 */
export declare function getWebMaxUploadBytes(): number;
/**
 * 获取上传目录根路径（按用户子目录继续划分）。
 * Get upload base directory (per-user subdirs are created under it).
 */
export declare function getWebUploadBaseDir(): string;
/**
 * 是否启用“cwd/工作目录切换”调试日志（默认关闭）。
 *
 * 支持的真值：`1`/`true`/`on`/`yes`（忽略大小写与首尾空格）。
 */
export declare function getWebLogCwdSwitchEnabled(): boolean;
