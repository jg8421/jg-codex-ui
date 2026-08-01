/**
 * Git 提交总结允许使用的推理强度枚举。
 */
export type GitCommitSummaryReasoningEffort = "low" | "medium" | "high" | "xhigh";
/**
 * 规范化 Git 总结推理强度；仅接受已知值，避免脏值透传到 codex exec。
 */
export declare function normalizeGitCommitSummaryReasoningEffort(input: unknown): GitCommitSummaryReasoningEffort | undefined;
/**
 * 解析 Git 总结专用的服务端默认推理强度。
 */
export declare function resolveGitCommitSummaryDefaultReasoningEffort(): GitCommitSummaryReasoningEffort;
/**
 * 解析 Git 总结本次调用最终生效的推理强度。
 */
export declare function resolveGitCommitSummaryEffectiveReasoningEffort(input: {
    requestedEffort?: unknown;
    persistedEffort?: unknown;
}): GitCommitSummaryReasoningEffort;
/**
 * 解析 Git 总结超时时间；未配置时返回 `null`，表示不设置硬超时。
 */
export declare function resolveGitCommitSummaryTimeoutMs(): number | null;
