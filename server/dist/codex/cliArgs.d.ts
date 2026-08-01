/**
 * Codex 历史持久化策略。
 */
export type CodexHistoryPersistence = "none" | "save-all" | "resume-based";
/**
 * 构建 Codex 启动参数时可选的覆盖项。
 */
export type CodexLaunchArgOverrides = {
    historyPersistence?: CodexHistoryPersistence | null;
    disableResponseStorage?: boolean | null;
    baseArgs?: string[];
};
/**
 * 按 Codex CLI 约定构建最终启动参数。
 * 注意：全局 `-c` 参数必须位于子命令（如 `app-server`）之前。
 */
export declare function buildCodexLaunchArgs(overrides: CodexLaunchArgOverrides): string[];
