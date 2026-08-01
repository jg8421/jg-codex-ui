import type { CodexAppServer } from "../codex/codexAppServer";
import type { HistoryQueryService } from "../history/query/historyQueryService";
/**
 * Git 提交总结结果。
 */
export type GitCommitSummaryResult = {
    threadId: string;
    message: string;
    rawText: string;
};
/**
 * Git 提交总结的“预处理结果”：
 * - 统一复用 repoRoot 解析、status 白名单过滤、CRUD 标签补齐与 prompt 组装逻辑；
 * - 便于在不同执行引擎（app-server / codex exec）之间共享输入准备流程。
 */
export type PreparedGitCommitSummary = {
    repoRoot: string;
    branchName: string;
    promptText: string;
    promptFiles: Array<{
        path: string;
        crudLabel: string;
    }>;
};
/**
 * 准备 Git 提交总结所需的 prompt 与文件清单（不触发 Codex 调用）。
 */
export declare function prepareGitCommitSummary(input: {
    cwd: string;
    requestedFiles: unknown[];
}): Promise<PreparedGitCommitSummary>;
/**
 * 对外暴露的 Git 静默提交总结服务。
 */
export declare function summarizeGitCommit(input: {
    repoRoot: string;
    codexCwd: string;
    requestedFiles: unknown[];
    codex: Pick<CodexAppServer, "startThread" | "startTurn" | "archiveThread">;
    historyQuery: Pick<HistoryQueryService, "listMessages">;
    isThreadActive?: (threadId: string) => boolean;
    approvalPolicy: "untrusted" | "on-failure" | "on-request" | "never";
    sandbox: "read-only" | "workspace-write" | "danger-full-access";
    model?: string;
    effort?: string;
    serviceTier?: "fast";
    timeoutMs?: number;
    pollIntervalMs?: number;
    completionGraceMs?: number;
}): Promise<GitCommitSummaryResult>;
