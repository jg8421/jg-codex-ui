"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeGitCommitSummaryReasoningEffort = normalizeGitCommitSummaryReasoningEffort;
exports.resolveGitCommitSummaryDefaultReasoningEffort = resolveGitCommitSummaryDefaultReasoningEffort;
exports.resolveGitCommitSummaryEffectiveReasoningEffort = resolveGitCommitSummaryEffectiveReasoningEffort;
exports.resolveGitCommitSummaryTimeoutMs = resolveGitCommitSummaryTimeoutMs;
const DEFAULT_GIT_COMMIT_SUMMARY_REASONING_EFFORT = "low";
/**
 * 规范化 Git 总结推理强度；仅接受已知值，避免脏值透传到 codex exec。
 */
function normalizeGitCommitSummaryReasoningEffort(input) {
    // normalizedInput：统一转成小写字符串后再做枚举判断。
    const normalizedInput = String(input ?? "")
        .trim()
        .toLowerCase();
    if (normalizedInput === "low")
        return "low";
    if (normalizedInput === "medium")
        return "medium";
    if (normalizedInput === "high")
        return "high";
    if (normalizedInput === "xhigh")
        return "xhigh";
    return undefined;
}
/**
 * 解析 Git 总结专用的服务端默认推理强度。
 */
function resolveGitCommitSummaryDefaultReasoningEffort() {
    // envEffort：允许通过环境变量临时收敛/放宽 Git 总结强度。
    const envEffort = normalizeGitCommitSummaryReasoningEffort(process.env.CODEX_GIT_COMMIT_SUMMARY_DEFAULT_REASONING_EFFORT);
    if (envEffort)
        return envEffort;
    return DEFAULT_GIT_COMMIT_SUMMARY_REASONING_EFFORT;
}
/**
 * 解析 Git 总结本次调用最终生效的推理强度。
 */
function resolveGitCommitSummaryEffectiveReasoningEffort(input) {
    // requestedEffort：请求体显式传入的强度。
    const requestedEffort = normalizeGitCommitSummaryReasoningEffort(input.requestedEffort);
    if (requestedEffort)
        return requestedEffort;
    // persistedEffort：数据库保存的 Git 总结默认强度。
    const persistedEffort = normalizeGitCommitSummaryReasoningEffort(input.persistedEffort);
    if (persistedEffort)
        return persistedEffort;
    return resolveGitCommitSummaryDefaultReasoningEffort();
}
/**
 * 解析 Git 总结超时时间；未配置时返回 `null`，表示不设置硬超时。
 */
function resolveGitCommitSummaryTimeoutMs() {
    // rawTimeoutMs：环境变量里声明的原始超时毫秒数。
    const rawTimeoutMs = String(process.env.CODEX_GIT_COMMIT_SUMMARY_TIMEOUT_MS ?? "").trim();
    if (!rawTimeoutMs)
        return null;
    // parsedTimeoutMs：转换后的超时毫秒数；非法值或非正数都视为“不设超时”。
    const parsedTimeoutMs = Number(rawTimeoutMs);
    if (!Number.isFinite(parsedTimeoutMs))
        return null;
    if (parsedTimeoutMs <= 0)
        return null;
    return Math.max(1_000, Math.floor(parsedTimeoutMs));
}
//# sourceMappingURL=gitCommitSummaryRuntimeOptions.js.map