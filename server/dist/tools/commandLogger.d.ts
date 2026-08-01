export type CommandLogInput = {
    source: "codex-exec" | "codex-app-server" | "git";
    command: string;
    args: string[];
    cwd?: string | null;
};
export type CodexTurnStartLogInput = {
    threadId: string;
    text: string;
    model?: string | null;
    effort?: string | null;
    serviceTier?: string | null;
    approvalPolicy?: string | null;
    sandbox?: string | null;
};
export type CodexCommandExecutionLogInput = {
    threadId?: string | null;
    turnId?: string | null;
    itemId?: string | null;
    command: string;
};
export type CodexTurnErrorLogInput = {
    threadId: string;
    method: string;
    error: unknown;
};
export type CodexCommandExecutionErrorLogInput = {
    threadId?: string | null;
    turnId?: string | null;
    itemId?: string | null;
    command: string;
    exitCode?: number | null;
    status?: string | null;
    details?: string | null;
};
export type GitCommitSummaryRouteLogInput = {
    stage: "request-received" | "request-succeeded";
    username?: string | null;
    cwd?: string | null;
    fileCount?: number | null;
    model?: string | null;
    effort?: string | null;
    sandbox?: string | null;
    threadId?: string | null;
};
export type GitCommitSummaryRouteErrorLogInput = {
    stage: "request-failed";
    username?: string | null;
    cwd?: string | null;
    fileCount?: number | null;
    model?: string | null;
    effort?: string | null;
    sandbox?: string | null;
    error: unknown;
};
export type GitCommitSummaryCliLogInput = {
    stage: "codex-exec-start" | "codex-exec-finished";
    cwd?: string | null;
    repoRoot?: string | null;
    fileCount?: number | null;
    model?: string | null;
    effort?: string | null;
    sandbox?: string | null;
    exitCode?: number | null;
    hasRawText?: boolean | null;
    hasMessage?: boolean | null;
    rawTextPreview?: string | null;
};
/**
 * 将命令与参数拼接为稳定、可读的日志文本。
 */
export declare function formatCommandForLog(command: string, args: string[]): string;
/**
 * 打印后端实际执行的外部命令日志。
 *
 * 说明：
 * - 只输出命令文本与 cwd，不打印环境变量，避免敏感信息泄漏；
 * - 使用统一前缀，便于在服务端日志里筛选。
 */
export declare function logCommandExecution(input: CommandLogInput): void;
/**
 * 打印用户发消息后触发的 `turn/start` 请求摘要。
 */
export declare function logCodexTurnStart(input: CodexTurnStartLogInput): void;
/**
 * 打印 Codex 在执行过程中实际跑起的命令。
 */
export declare function logCodexCommandExecution(input: CodexCommandExecutionLogInput): void;
/**
 * 打印 `turn/start` 等请求失败日志。
 */
export declare function logCodexTurnError(input: CodexTurnErrorLogInput): void;
/**
 * 打印执行中的命令失败日志，补充退出码和错误输出摘要。
 */
export declare function logCodexCommandExecutionError(input: CodexCommandExecutionErrorLogInput): void;
/**
 * 打印 Git 智能总结路由层日志，便于区分“请求已到达”和“是否已产出总结结果”。
 */
export declare function logGitCommitSummaryRoute(input: GitCommitSummaryRouteLogInput): void;
/**
 * 打印 Git 智能总结路由层错误日志，便于识别“尚未进入 codex exec 就失败”的场景。
 */
export declare function logGitCommitSummaryRouteError(input: GitCommitSummaryRouteErrorLogInput): void;
/**
 * 打印 Git 智能总结在 `codex exec` 执行前后的阶段日志。
 */
export declare function logGitCommitSummaryCli(input: GitCommitSummaryCliLogInput): void;
