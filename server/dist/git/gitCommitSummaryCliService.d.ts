import { runCodexCommand } from "../codex/codexSpawn";
import { type GitCommitSummaryResult } from "./gitCommitSummaryService";
type RunCodexCommandLike = typeof runCodexCommand;
/**
 * 构建本次 `codex exec` 的 argv。
 */
export declare function buildGitCommitSummaryCodexExecArgs(input: {
    cwd: string;
    promptText: string;
    model?: string;
    effort?: string;
    sandbox: "read-only" | "workspace-write" | "danger-full-access";
    outputLastMessagePath?: string;
}): string[];
/**
 * 使用 `codex exec` 生成 Git 提交智能总结：
 * - 通过 `-c project_doc_max_bytes=...` 等覆盖项，减少 `AGENTS.md` 注入体积；
 * - 仅依赖 stdout 返回的 assistant 文本，不依赖 app-server 的 thread/history 管道。
 */
export declare function summarizeGitCommitViaCodexExec(input: {
    codexBin: string;
    cwd: string;
    requestedFiles: unknown[];
    sandbox: "read-only" | "workspace-write" | "danger-full-access";
    model?: string;
    effort?: string;
    timeoutMs?: number | null;
    runCommand?: RunCodexCommandLike;
}): Promise<GitCommitSummaryResult>;
export {};
